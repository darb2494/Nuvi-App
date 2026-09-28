import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import {
  Save, FlaskConical, Ruler, Dumbbell, Activity,
  ChevronDown, ChevronUp, Check, Info, BarChart2, Trash2, Printer, X
} from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import { supabase } from '../lib/supabaseClient'
import ReporteISAKPrint from './ReporteISAKPrint'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ZAxis, ReferenceLine
} from 'recharts'

// =============================================================================
// HELPERS
// =============================================================================
const n   = (v) => parseFloat(v) || 0
const fmt = (v, dec = 1) => (v != null && isFinite(v) && v !== 0 ? Number(v).toFixed(dec) : '--')
const fmtZ = (v) => (v != null && isFinite(v) ? (v >= 0 ? `+${Number(v).toFixed(2)}` : Number(v).toFixed(2)) : '--')

const STORAGE_KEY = 'nuvi_antropometria_draft'

const FORM_DEFAULT = {
  edad: '', sexo: '',
  masa: '', talla: '', tallaSentado: '', envergadura: '',
  pTriceps: '', pSubescapular: '', pBiceps: '', pCrestaIliaca: '',
  pSupraespinal: '', pAbdominal: '', pMuslo: '', pPierna: '',
  perBrazoRel: '', perBrazoCon: '', perCintura: '', perCaderas: '', perMuslo: '', perPierna: '',
  dHumero: '', dMuneca: '', dFemur: '',
  notas: '',
  fechaMedicion: new Date().toISOString().split('T')[0]
}

// =============================================================================
// DICCIONARIO PHANTOM — Ross & Ward (1982)
// Z = (1/S) * (val * (170.18 / talla_cm)^d - P)
// =============================================================================
const PHANTOM = {
  pTriceps:      { P: 15.4, S: 4.47, d: 1 },
  pSubescapular: { P: 17.2, S: 5.07, d: 1 },
  pBiceps:       { P:  8.0, S: 2.86, d: 1 },
  pCrestaIliaca: { P: 22.4, S: 6.22, d: 1 },
  pSupraespinal: { P: 15.4, S: 4.47, d: 1 },
  pAbdominal:    { P: 25.4, S: 7.78, d: 1 },
  pMuslo:        { P: 27.0, S: 8.33, d: 1 },
  pPierna:       { P: 16.0, S: 4.67, d: 1 },
  perBrazoRel:   { P: 26.9, S: 2.33, d: 1 },
  perBrazoCon:   { P: 28.5, S: 2.50, d: 1 },
  perCintura:    { P: 69.6, S: 5.15, d: 1 },
  perCaderas:    { P: 87.9, S: 5.72, d: 1 },
  perMuslo:      { P: 52.6, S: 3.66, d: 1 },
  perPierna:     { P: 34.8, S: 2.54, d: 1 },
  dHumero:       { P:  6.48, S: 0.35, d: 1 },
  dMuneca:       { P:  5.21, S: 0.28, d: 1 },
  dFemur:        { P:  9.52, S: 0.48, d: 1 },
}

function calcZ(key, rawVal, tallaCm) {
  if (!rawVal || !tallaCm || !PHANTOM[key]) return null
  const { P, S, d } = PHANTOM[key]
  return (1 / S) * (rawVal * Math.pow(170.18 / tallaCm, d) - P)
}

// =============================================================================
// SUB-COMPONENTES — definidos FUERA del componente principal para evitar
// que React los desmonte/monte en cada re-render y pierda el foco de los inputs
// =============================================================================

// ── SectionCard ──────────────────────────────────────────────────────────────
function SectionCard({ title, color, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
          <Icon className="w-4 h-4 text-slate-500" />
          <span className="font-bold text-slate-800 text-sm uppercase tracking-wider">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="px-6 pb-6">{children}</div>}
    </div>
  )
}

// ── ZBadge ───────────────────────────────────────────────────────────────────
function ZBadge({ z }) {
  if (z == null) return <span className="text-slate-300 text-[11px] font-bold ml-1">Z: —</span>
  const abs = Math.abs(z)
  const color = abs <= 1 ? 'text-emerald-600' : abs <= 2 ? 'text-amber-600' : 'text-rose-600'
  return <span className={`text-[11px] font-bold ml-1 ${color}`}>Z: {fmtZ(z)}</span>
}

// ── Field ────────────────────────────────────────────────────────────────────
// Recibe todos sus datos como props — no cierra sobre nada del componente padre
function Field({ label, name, value, onChange, zScore, showZ = false, step = '0.1' }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={`isak-${name}`} className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
          {label}
        </label>
        {showZ && <ZBadge z={zScore ?? null} />}
      </div>
      <input
        id={`isak-${name}`}
        type="number"
        name={name}
        value={value}
        onChange={onChange}
        step={step}
        min="0"
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
        placeholder="—"
      />
    </div>
  )
}

// ── ResultCard ───────────────────────────────────────────────────────────────
function ResultCard({ label, value, unit, color = 'text-slate-900', bg = 'bg-slate-50', note, noteColor = 'text-slate-400' }) {
  return (
    <div className={`${bg} rounded-xl p-4 border border-slate-100`}>
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-black ${color} leading-none`}>
        {value} <span className="text-sm font-semibold text-slate-400">{unit}</span>
      </p>
      {note && <p className={`text-xs mt-1 font-semibold ${noteColor}`}>{note}</p>}
    </div>
  )
}

// ── ProgressBar ──────────────────────────────────────────────────────────────
function ProgressBar({ value, max, color }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ── CustomPieTooltip ──────────────────────────────────────────────────────────
function CustomPieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-bold text-slate-900">{d?.name || 'Desconocido'}</p>
      <p className="text-slate-600">{fmt(d?.value, 1)} kg <span className="text-slate-400">({fmt(d?.payload?.pct, 1)}%)</span></p>
    </div>
  )
}

const PIE_COLORS_MOL = ['#f59e0b', '#0f766e'] // Amber, Teal
const PIE_COLORS_TIS = ['#f59e0b', '#ef4444', '#3b82f6', '#94a3b8'] // Amber, Red, Blue, Slate

// =============================================================================
// MOTOR DE CÁLCULOS ISAK (puro — sin side-effects)
// =============================================================================
function calcularISAK(f, propsSexo) {
  const edad    = n(f.edad)
  const sexo    = f.sexo || propsSexo // Usa el valor del form, o el prop por defecto
  const masa    = n(f.masa)
  const tallaCm = n(f.talla)
  const talla   = tallaCm / 100

  // Pliegues
  const pTriceps      = n(f.pTriceps)
  const pSubescapular = n(f.pSubescapular)
  const pBiceps       = n(f.pBiceps)
  const pCrestaIliaca = n(f.pCrestaIliaca)
  const pSupraespinal = n(f.pSupraespinal)
  const pAbdominal    = n(f.pAbdominal)
  const pMuslo        = n(f.pMuslo)
  const pPierna       = n(f.pPierna)
  const suma6 = pTriceps + pSubescapular + pSupraespinal + pAbdominal + pMuslo + pPierna
  const suma8 = suma6 + pBiceps + pCrestaIliaca

  // Perímetros
  const perBrazoRel = n(f.perBrazoRel)
  const perCintura  = n(f.perCintura)
  const perCaderas  = n(f.perCaderas)
  const perMuslo    = n(f.perMuslo)
  const perPierna   = n(f.perPierna)

  // Perímetros corregidos
  const brazoCorregido  = perBrazoRel > 0 ? perBrazoRel - (pTriceps / 10) * Math.PI : 0
  const musloCorregido  = perMuslo    > 0 ? perMuslo    - (pMuslo   / 10) * Math.PI : 0
  const piernaCorregida = perPierna   > 0 ? perPierna   - (pPierna  / 10) * Math.PI : 0

  // Diámetros
  const dHumero = n(f.dHumero)
  const dFemur  = n(f.dFemur)
  const tallaSentado = n(f.tallaSentado)
  const envergadura  = n(f.envergadura)

  // Índices básicos
  const imc = talla > 0 && masa > 0 ? masa / (talla * talla) : 0
  const icc = perCaderas > 0 ? perCintura / perCaderas : 0
  const ict = tallaCm > 0 ? perCintura / tallaCm : 0

  // Fraccionamiento tisular
  let masaAdiposa = 0
  if (masa > 0 && suma8 > 0) masaAdiposa = masa * (0.1933 * suma8) / 170.18
  const pctGrasa = masa > 0 ? (masaAdiposa / masa) * 100 : 0

  let masaOsea = 0
  if (talla > 0 && dHumero > 0 && dFemur > 0)
    masaOsea = 3.02 * Math.pow(talla * talla * (dHumero / 100) * (dFemur / 100) * 400, 0.712)

  const esSexoM = sexo === 'masculino' || sexo === 'M'
  const sexoNum = esSexoM ? 1 : 0
  let masaMuscular = 0
  if (tallaCm > 0 && brazoCorregido > 0 && musloCorregido > 0 && piernaCorregida > 0) {
    masaMuscular = talla * ( // Talla en metros para la fórmula de Lee (2000)
      0.00744 * brazoCorregido ** 2 +
      0.00088 * musloCorregido ** 2 +
      0.00441 * piernaCorregida ** 2
    ) + 2.4 * sexoNum - 0.048 * 30 + 7.8
    masaMuscular = Math.max(0, masaMuscular)
  }
  const masaResidual = Math.max(0, masa - masaAdiposa - masaOsea - masaMuscular)
  
  // Durnin-Womersley (1974) para Fraccionamiento Molecular
  const suma4Durnin = pTriceps + pBiceps + pSubescapular + pCrestaIliaca
  let masaGrasaMolecular = 0
  let masaLibreDeGrasaMolecular = 0
  // Validación Defensiva: Requiere edad y sexo obligatoriamente para calcular
  if (masa > 0 && suma4Durnin > 0 && edad > 0 && sexo) {
    const logS4 = Math.log10(suma4Durnin)
    let c = 0, m = 0
    if (esSexoM) {
      if (edad < 30) { c = 1.1620; m = 0.0630 }
      else if (edad < 40) { c = 1.1422; m = 0.0544 }
      else if (edad < 50) { c = 1.1620; m = 0.0700 }
      else { c = 1.1715; m = 0.0779 }
    } else {
      if (edad < 30) { c = 1.1549; m = 0.0678 }
      else if (edad < 40) { c = 1.1423; m = 0.0632 }
      else if (edad < 50) { c = 1.1333; m = 0.0612 }
      else { c = 1.1339; m = 0.0645 }
    }
    const d = c - m * logS4
    const pctGrasaDurnin = (4.95 / d - 4.50) * 100
    masaGrasaMolecular = Math.max(0, (pctGrasaDurnin / 100) * masa)
    masaLibreDeGrasaMolecular = Math.max(0, masa - masaGrasaMolecular)
  }

  // Índices de composición
  const indiceAdipMuscular = masaMuscular > 0 ? masaAdiposa / masaMuscular : 0
  const clasifIAM =
    indiceAdipMuscular === 0 ? '--' :
    indiceAdipMuscular < 0.4 ? 'Bajo · Buena muscularidad' :
    indiceAdipMuscular < 0.8 ? 'Medio · Balance adecuado' : 'Alto · Predominio adiposo'

  const indiceMusOseo = masaOsea > 0 ? masaMuscular / masaOsea : 0

  const indiceCormico = tallaCm > 0 && tallaSentado > 0 ? (tallaSentado / tallaCm) * 100 : 0
  const clasifCormico =
    indiceCormico === 0 ? '--' :
    indiceCormico < 50  ? 'Braquicórmico (tronco corto)' :
    indiceCormico < 53  ? 'Mesocórmico (proporción media)' : 'Macrocórmico (tronco largo)'

  const longitudPiernas = tallaSentado > 0 ? tallaCm - tallaSentado : 0
  const indiceManouvrier = longitudPiernas > 0 ? (tallaSentado / longitudPiernas) * 100 : 0
  const clasifManouvrier =
    indiceManouvrier === 0 ? '--' :
    indiceManouvrier < 84  ? 'Braquicélico (piernas largas)' :
    indiceManouvrier < 90  ? 'Mesocélico (proporción normal)' : 'Macrocélico (tronco largo)'

  const envergaduraRelativa = tallaCm > 0 && envergadura > 0 ? (envergadura / tallaCm) * 100 : 0
  const clasifEnvergadura =
    envergaduraRelativa === 0 ? '--' :
    envergaduraRelativa < 97  ? 'Corta (< talla)' :
    envergaduraRelativa < 103 ? 'Proporcional' : 'Larga (> talla)'

  const indiceConicidad = talla > 0 && masa > 0 && perCintura > 0
    ? (perCintura / 100) / (0.109 * Math.sqrt(masa / talla)) : 0
  const umbralConic = esSexoM ? 1.25 : 1.18
  const clasifConicidad =
    indiceConicidad === 0 ? '--' :
    indiceConicidad < umbralConic ? 'Sin riesgo cardiovascular' : 'Riesgo cardiovascular elevado'

  const indiceDistribGrasa = pSubescapular > 0 ? pAbdominal / pSubescapular : 0
  const clasifIDG =
    indiceDistribGrasa === 0 ? '--' :
    indiceDistribGrasa >= 1  ? 'Adiposidad central (android)' : 'Adiposidad periférica (ginoid)'

  // Somatotipo Heath-Carter
  const suma4P = pTriceps + pSubescapular + pSupraespinal + pMuslo
  let endomorfia = 0
  if (suma4P > 0 && tallaCm > 0) {
    const s = suma4P * (170.18 / tallaCm)
    endomorfia = Math.max(0.5, -0.7182 + 0.1451*s - 0.00068*s*s + 0.0000014*s*s*s)
  }
  let mesomorfia = 0
  if (dHumero > 0 && dFemur > 0 && brazoCorregido > 0 && piernaCorregida > 0 && tallaCm > 0)
    mesomorfia = Math.max(0.5, 0.858*dHumero + 0.601*dFemur + 0.188*brazoCorregido + 0.161*piernaCorregida - 0.131*tallaCm + 4.5)

  let ectomorfia = 0
  if (imc > 0 && masa > 0 && tallaCm > 0) {
    const iep = tallaCm / Math.pow(masa, 1/3)
    ectomorfia = iep >= 40.75 ? 0.732*iep - 28.58 : iep > 38.25 ? 0.463*iep - 17.63 : 0.5
  }

  // Clasificación somatotipo
  const getSomatoCompleto = (endo, meso, ecto) => {
    if (!endo && !meso && !ecto) return { label: '--', desc: 'Completa los datos para calcular el somatotipo.' }
    const d = (a, b) => Math.abs(a - b)
    const dom = 1.5
    if (d(endo,meso) <= dom && d(meso,ecto) <= dom && d(endo,ecto) <= dom)
      return { label: 'Central', desc: 'Ningún componente domina significativamente.' }
    if (meso > endo && meso > ecto)
      return d(endo,ecto) <= dom
        ? { label: 'Mesomorfo Balanceado', desc: 'Alta muscularidad relativa, grasa y linealidad similares.' }
        : endo > ecto
          ? { label: 'Endo-Mesomorfo', desc: 'Alta muscularidad con tendencia al tejido adiposo.' }
          : { label: 'Meso-Ectomorfo', desc: 'Alta muscularidad con tendencia lineal y baja grasa.' }
    if (endo > meso && endo > ecto)
      return d(meso,ecto) <= dom
        ? { label: 'Endomorfo Balanceado', desc: 'Alta adiposidad relativa con muscularidad y linealidad similares.' }
        : meso > ecto
          ? { label: 'Endo-Mesomorfo', desc: 'Predominio adiposo con buena masa muscular.' }
          : { label: 'Endomorfo Ectomorfo', desc: 'Alta adiposidad con tendencia lineal.' }
    return d(endo,meso) <= dom
      ? { label: 'Ecto-Endomorfo', desc: 'Linealidad alta con adiposidad relativa.' }
      : meso > endo
        ? { label: 'Meso-Ectomorfo', desc: 'Linealidad con buena masa muscular relativa.' }
        : { label: 'Ectomorfo Balanceado', desc: 'Alta linealidad con baja adiposidad y muscularidad.' }
  }

  const endoDesc = endomorfia < 2 ? 'Adiposidad muy baja' : endomorfia < 3 ? 'Adiposidad baja' : endomorfia < 5 ? 'Adiposidad moderada' : endomorfia < 7 ? 'Adiposidad alta' : 'Adiposidad muy alta'
  const mesoDesc = mesomorfia < 2 ? 'Muscularidad muy baja' : mesomorfia < 3 ? 'Muscularidad baja' : mesomorfia < 5 ? 'Musculatura moderada' : mesomorfia < 7 ? 'Musculatura alta' : 'Musculatura muy alta'
  const ectoDesc = ectomorfia < 2 ? 'Linealidad muy baja' : ectomorfia < 3 ? 'Linealidad baja' : ectomorfia < 5 ? 'Linealidad moderada' : ectomorfia < 7 ? 'Linealidad alta' : 'Linealidad muy alta'

  // Z-Scores Phantom (17 variables)
  const zScores = {}
  if (tallaCm > 0) {
    Object.keys(PHANTOM).forEach(k => { zScores[k] = calcZ(k, n(f[k]), tallaCm) })
  }

  const calcZMass = (val, P, S) => {
    if (!val || !tallaCm) return null
    return (1 / S) * (val * Math.pow(170.18 / tallaCm, 3) - P)
  }
  const zMasaGrasaMol = calcZMass(masaGrasaMolecular, 12.2, 3.2) // Aprox para grasa molecular
  const zMasaAdiposa  = calcZMass(masaAdiposa, 16.29, 5.25)
  const zMasaMuscular = calcZMass(masaMuscular, 25.55, 2.6)
  const zMasaOsea     = calcZMass(masaOsea, 10.49, 1.57)

  // Coordenadas Somatocarta
  const somatoX = endomorfia > 0 || ectomorfia > 0 ? ectomorfia - endomorfia : null
  const somatoY = mesomorfia > 0 ? 2 * mesomorfia - (endomorfia + ectomorfia) : null

  return {
    suma6, suma8,
    brazoCorregido, musloCorregido, piernaCorregida,
    masaAdiposa, masaMuscular, masaOsea, masaResidual, pctGrasa,
    masaGrasaMolecular, masaLibreDeGrasaMolecular,
    indiceAdipMuscular, clasifIAM, indiceMusOseo,
    indiceCormico, clasifCormico,
    indiceManouvrier, clasifManouvrier,
    envergaduraRelativa, clasifEnvergadura,
    indiceConicidad, clasifConicidad, umbralConic,
    indiceDistribGrasa, clasifIDG,
    imc, icc, ict,
    endomorfia, mesomorfia, ectomorfia,
    endoDesc, mesoDesc, ectoDesc,
    somatoCompleto: getSomatoCompleto(endomorfia, mesomorfia, ectomorfia),
    somatoX, somatoY,
    zScores,
    zMasaGrasaMol, zMasaAdiposa, zMasaMuscular, zMasaOsea
  }
}

// Clasificaciones índices salud
const imcLabel = (v) => v <= 0 ? '' : v < 18.5 ? 'Bajo peso' : v < 25 ? 'Peso normal' : v < 30 ? 'Sobrepeso' : 'Obesidad'
const iccLabel = (v) => v <= 0 ? '' : v < 0.85 ? 'Riesgo bajo' : v < 0.95 ? 'Riesgo moderado' : 'Riesgo alto'
const ictLabel = (v) => v <= 0 ? '' : v < 0.5 ? 'Sin riesgo metabólico' : 'Riesgo metabólico'

// Componente para graficar el Puntuación Z en la tabla
function ZDot({ z }) {
  if (z == null || !isFinite(z)) return <div className="w-16"></div>
  const clamped = Math.max(-3, Math.min(3, z))
  const pos = ((clamped + 3) / 6) * 100
  return (
    <div className="w-20 h-4 relative flex items-center mx-2">
      <div className="absolute inset-0 flex justify-between items-center px-0.5">
         <div className="h-full w-px bg-slate-100"></div>
         <div className="h-full w-px bg-slate-100"></div>
         <div className="h-full w-px bg-teal-500 opacity-30"></div>
         <div className="h-full w-px bg-slate-100"></div>
         <div className="h-full w-px bg-slate-100"></div>
      </div>
      <div className="absolute w-1.5 h-1.5 bg-teal-600 rounded-full shadow-sm" style={{ left: `calc(${pos}% - 3px)` }}></div>
    </div>
  )
}

const fmtZTable = (v) => (v != null && isFinite(v) ? Number(v).toFixed(2).replace('.', ',') : '--')
const fmtKg = (v) => (v != null && isFinite(v) && v > 0 ? Number(v).toFixed(2).replace('.', ',') : '--')

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================
export default function AntropometriaISAK({ anamnesisId, pacienteSexo, tenantId, onGuardado }) {
  // PARTE 2: LÓGICA DE ESTADO (ARRAY DE EVALUACIONES)
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) return parsed
        // Migración por si había un objeto antiguo guardado
        if (Object.keys(parsed).length > 0) return [parsed]
      }
      return []
    } catch {
      return []
    }
  })

  const [activeIndex, setActiveIndex] = useState(history.length > 0 ? 0 : -1)
  const [form, setForm] = useState(history.length > 0 ? history[0] : FORM_DEFAULT)

  // PARTE 1 & 4: ESTADO Y REFERENCIA PARA EXPORTACIÓN PDF
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [printConfig, setPrintConfig] = useState({
    resumen: true,
    composicion: true,
    somatotipo: true,
    indices: false
  })
  const printRef = useRef(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Reporte_ISAK_${form.fechaMedicion || 'Export'}`,
    onAfterPrint: () => setShowPrintModal(false)
  })

  // Sincronizar el array de historial con localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
    } catch { /* ignorar silent fallback */ }
  }, [history])

  const [saving, setSaving]   = useState(false)
  const [savedOk, setSavedOk] = useState(false)

  const handleChange = useCallback((e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }, [])

  const handleLimpiar = useCallback(() => {
    if (!window.confirm('¿Borrar los datos del formulario actual? (No borrará el historial guardado, solo limpiará la pantalla)')) return
    setForm({ ...FORM_DEFAULT, fechaMedicion: new Date().toISOString().split('T')[0] })
  }, [])

  const calc = useMemo(() => calcularISAK(form, pacienteSexo), [form, pacienteSexo])

  const molecularData = useMemo(() => {
    const masa = n(form.masa)
    if (!masa || !calc.masaGrasaMolecular) return []
    return [
      { name: 'Masa Grasa', value: calc.masaGrasaMolecular, pct: (calc.masaGrasaMolecular / masa) * 100 },
      { name: 'Masa Libre de Grasa', value: calc.masaLibreDeGrasaMolecular, pct: (calc.masaLibreDeGrasaMolecular / masa) * 100 },
    ].filter(d => d.value > 0)
  }, [calc, form.masa])

  const tisularData = useMemo(() => {
    const masa = n(form.masa)
    if (!masa || !calc.masaAdiposa) return []
    return [
      { name: 'Tejido Adiposo',  value: calc.masaAdiposa,  pct: (calc.masaAdiposa  / masa) * 100 },
      { name: 'Tejido Muscular', value: calc.masaMuscular, pct: (calc.masaMuscular / masa) * 100 },
      { name: 'Tejido Óseo',     value: calc.masaOsea,     pct: (calc.masaOsea     / masa) * 100 },
      { name: 'Tejido Residual', value: calc.masaResidual, pct: (calc.masaResidual / masa) * 100 },
    ].filter(d => d.value > 0)
  }, [calc, form.masa])

  const handleGuardar = async () => {
    if (!anamnesisId || !tenantId) { alert('Falta el ID del expediente.'); return }
    setSaving(true)
    try {
      const payload = {
        anamnesis_id: anamnesisId,
        tenant_id:    tenantId,
        fecha_medicion:         form.fechaMedicion,
        peso_kg:                n(form.masa)          || null,
        talla_cm:               n(form.talla)         || null,
        pliegue_tricipital_mm:  n(form.pTriceps)      || null,
        pliegue_bicipital_mm:   n(form.pBiceps)       || null,
        pliegue_subescapular_mm:n(form.pSubescapular) || null,
        pliegue_suprailiaco_mm: n(form.pSupraespinal) || null,
        circunferencia_cintura_cm: n(form.perCintura) || null,
        circunferencia_cadera_cm:  n(form.perCaderas) || null,
        circunferencia_brazo_cm:   n(form.perBrazoRel)|| null,
        masa_muscular_kg: calc.masaMuscular > 0 ? +calc.masaMuscular.toFixed(2) : null,
        masa_grasa_kg:    calc.masaAdiposa  > 0 ? +calc.masaAdiposa.toFixed(2)  : null,
        masa_grasa_pct:   calc.pctGrasa     > 0 ? +calc.pctGrasa.toFixed(1)     : null,
        masa_osea_kg:     calc.masaOsea     > 0 ? +calc.masaOsea.toFixed(2)     : null,
        notas: form.notas || null
      }
      
      if (form.id) payload.id = form.id // UPSERT en supabase si ya existía

      const { data, error } = await supabase.from('medidas_antropometricas').upsert(payload).select().single()
      if (error) throw error
      
      const formGuardado = { ...form, id: data?.id || form.id }
      setForm(formGuardado) // Actualiza el form activo con el ID real
      
      // PARTE 4: LÓGICA DE GUARDADO INTELIGENTE (HISTORIAL)
      setHistory(prev => {
        const newHist = [...prev]
        if (activeIndex === -1) {
          // Evaluación nueva -> Agregar al inicio
          newHist.unshift(formGuardado)
          setActiveIndex(0)
        } else {
          // Editando evaluación existente -> Actualizarla
          newHist[activeIndex] = formGuardado
        }
        return newHist
      })

      setSavedOk(true)
      onGuardado?.()
      setTimeout(() => setSavedOk(false), 3000)
    } catch (err) {
      alert('Error al guardar: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const canSave = n(form.masa) > 0 && n(form.talla) > 0
  const z = calc.zScores   // alias corto

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-in fade-in duration-300">

      {/* TÍTULO PRINCIPAL */}
      <div>
        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <Dumbbell className="w-5 h-5 text-teal-600" /> Antropometría Avanzada
        </h2>
        <p className="text-sm text-slate-500 mt-1 mb-4">
          Gestión longitudinal de composición corporal · ISAK
        </p>
      </div>

      {/* CABECERA DE CONTROLES (SIEMPRE VISIBLE) */}
      <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 gap-4">
        
        {/* Izquierda: Select de Evaluaciones */}
        <div className="w-full sm:w-auto">
          <select
            value={activeIndex}
            onChange={(e) => {
              const idx = parseInt(e.target.value, 10)
              setActiveIndex(idx)
              if (idx === -1) {
                setForm({ ...FORM_DEFAULT, fechaMedicion: new Date().toISOString().split('T')[0] })
              } else {
                setForm(history[idx])
              }
            }}
            className="w-full sm:w-64 px-3 py-2 bg-white border border-slate-300 shadow-sm rounded-lg text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-teal-500/20"
          >
            <option value={-1}>Nueva Evaluación (Hoy)</option>
            {history.map((ev, i) => (
              <option key={i} value={i}>
                Evaluación: {ev.fechaMedicion}
              </option>
            ))}
          </select>
        </div>

        {/* Derecha: Grupo de Botones */}
        <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-3">
          <button
            onClick={() => setShowPrintModal(true)}
            disabled={!canSave}
            className="flex-1 sm:flex-none px-4 py-2 bg-white text-slate-700 border border-slate-300 font-bold rounded-lg text-sm transition-colors hover:bg-slate-50 whitespace-nowrap shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="w-4 h-4" /> Exportar PDF
          </button>

          <button
            onClick={() => {
              setActiveIndex(-1)
              setForm({ ...FORM_DEFAULT, fechaMedicion: new Date().toISOString().split('T')[0] })
            }}
            className="flex-1 sm:flex-none px-4 py-2 bg-white text-slate-700 border border-slate-300 font-bold rounded-lg text-sm transition-colors hover:bg-slate-50 whitespace-nowrap shadow-sm"
          >
            + Nueva Evaluación
          </button>
          
          <button
            onClick={handleGuardar}
            disabled={saving || !canSave}
            className={`flex-1 sm:flex-none px-5 py-2 font-bold rounded-lg shadow-sm text-sm flex items-center justify-center gap-2 transition-all whitespace-nowrap
              ${savedOk
                ? 'bg-emerald-500 text-white'
                : 'bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'}`}
          >
            {savedOk ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {savedOk ? 'Guardado' : saving ? 'Guardando...' : 'Guardar Evaluación'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* ══════════════ COLUMNA IZQUIERDA: FORMULARIO ══════════════ */}
        <div className="space-y-4">

          {/* A — Medidas Básicas */}
          <SectionCard title="A · Medidas Básicas" color="bg-teal-500" icon={Ruler}>
            <div className="grid grid-cols-2 gap-4 pt-2 mb-4 border-b border-slate-100 pb-4">
              <Field label="Edad (años)"         name="edad"         value={form.edad}         onChange={handleChange} />
              <div className="flex flex-col">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Sexo</label>
                <select name="sexo" value={form.sexo} onChange={handleChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all">
                  <option value="">Seleccione</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Masa corporal (kg)" name="masa"         value={form.masa}         onChange={handleChange} />
              <Field label="Talla (cm)"          name="talla"        value={form.talla}        onChange={handleChange} />
              <Field label="Talla sentado (cm)"  name="tallaSentado" value={form.tallaSentado} onChange={handleChange} />
              <Field label="Envergadura (cm)"    name="envergadura"  value={form.envergadura}  onChange={handleChange} />
            </div>
            {n(form.talla) === 0 && (
              <p className="text-[11px] text-amber-600 mt-3 flex items-center gap-1">
                <Info className="w-3 h-3" /> Ingresa la talla para activar las Puntuaciones Z Phantom.
              </p>
            )}
          </SectionCard>

          {/* B — Pliegues */}
          <SectionCard title="B · Pliegues Cutáneos (mm) + Z Phantom" color="bg-amber-500" icon={FlaskConical}>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <Field label="Tríceps"       name="pTriceps"      value={form.pTriceps}      onChange={handleChange} showZ zScore={z.pTriceps} />
              <Field label="Subescapular"  name="pSubescapular" value={form.pSubescapular} onChange={handleChange} showZ zScore={z.pSubescapular} />
              <Field label="Bíceps"        name="pBiceps"       value={form.pBiceps}       onChange={handleChange} showZ zScore={z.pBiceps} />
              <Field label="Cresta ilíaca" name="pCrestaIliaca" value={form.pCrestaIliaca} onChange={handleChange} showZ zScore={z.pCrestaIliaca} />
              <Field label="Supraespinal"  name="pSupraespinal" value={form.pSupraespinal} onChange={handleChange} showZ zScore={z.pSupraespinal} />
              <Field label="Abdominal"     name="pAbdominal"    value={form.pAbdominal}    onChange={handleChange} showZ zScore={z.pAbdominal} />
              <Field label="Muslo medio"   name="pMuslo"        value={form.pMuslo}        onChange={handleChange} showZ zScore={z.pMuslo} />
              <Field label="Pierna"        name="pPierna"       value={form.pPierna}       onChange={handleChange} showZ zScore={z.pPierna} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Σ 6 Pliegues</p>
                <p className="text-2xl font-black text-amber-700">{fmt(calc.suma6)}<span className="text-sm font-medium"> mm</span></p>
              </div>
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-center">
                <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">Σ 8 Pliegues</p>
                <p className="text-2xl font-black text-orange-700">{fmt(calc.suma8)}<span className="text-sm font-medium"> mm</span></p>
              </div>
            </div>
          </SectionCard>

          {/* C — Perímetros */}
          <SectionCard title="C · Perímetros (cm) + Z Phantom" color="bg-blue-500" icon={Activity}>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <Field label="Brazo relajado"       name="perBrazoRel" value={form.perBrazoRel} onChange={handleChange} showZ zScore={z.perBrazoRel} />
              <Field label="Brazo flex. contraído" name="perBrazoCon" value={form.perBrazoCon} onChange={handleChange} showZ zScore={z.perBrazoCon} />
              <Field label="Cintura"              name="perCintura"  value={form.perCintura}  onChange={handleChange} showZ zScore={z.perCintura} />
              <Field label="Caderas"              name="perCaderas"  value={form.perCaderas}  onChange={handleChange} showZ zScore={z.perCaderas} />
              <Field label="Muslo medio"          name="perMuslo"    value={form.perMuslo}    onChange={handleChange} showZ zScore={z.perMuslo} />
              <Field label="Pierna"               name="perPierna"   value={form.perPierna}   onChange={handleChange} showZ zScore={z.perPierna} />
            </div>
            <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-3">Perímetros Corregidos (−pliegue×π÷10)</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: 'Brazo', val: calc.brazoCorregido },
                  { label: 'Muslo', val: calc.musloCorregido },
                  { label: 'Pierna', val: calc.piernaCorregida },
                ].map(({ label, val }) => (
                  <div key={label}>
                    <p className="text-[10px] text-slate-500 font-semibold">{label}</p>
                    <p className="font-black text-blue-700">{fmt(val)} <span className="text-xs font-medium">cm</span></p>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          {/* D — Diámetros */}
          <SectionCard title="D · Diámetros Óseos (cm) + Z Phantom" color="bg-purple-500" icon={Dumbbell}>
            <div className="grid grid-cols-3 gap-4 pt-2">
              <Field label="Húmero"             name="dHumero" value={form.dHumero} onChange={handleChange} showZ zScore={z.dHumero} />
              <Field label="Muñeca (biestiloideo)" name="dMuneca" value={form.dMuneca} onChange={handleChange} showZ zScore={z.dMuneca} />
              <Field label="Fémur"              name="dFemur"  value={form.dFemur}  onChange={handleChange} showZ zScore={z.dFemur} />
            </div>
          </SectionCard>

          {/* Leyenda Z */}
          <div className="flex flex-wrap gap-4 px-1">
            {[
              { color: 'text-emerald-600', label: 'Z ≤ ±1 · Dentro del rango normal' },
              { color: 'text-amber-600',   label: 'Z ±1–2 · Atención' },
              { color: 'text-rose-600',    label: 'Z > ±2 · Fuera del rango' },
            ].map(l => (
              <span key={l.label} className={`text-[11px] font-bold ${l.color}`}>{l.label}</span>
            ))}
          </div>

          {/* Notas */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <label htmlFor="isak-notas" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">Notas Clínicas</label>
            <textarea
              id="isak-notas"
              name="notas" value={form.notas} onChange={handleChange} rows={3}
              placeholder="Observaciones de la evaluación..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none resize-none"
            />
          </div>
        </div>

        {/* ══════════════ COLUMNA DERECHA: RESULTADOS ══════════════ */}
        <div className="space-y-4">

          {/* TABLA CLÍNICA DE COMPOSICIÓN CORPORAL (ISAKmetry Standard) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-4">
            <div className="bg-slate-50/50 border-b border-slate-100 px-6 py-4 flex justify-between items-center text-slate-900">
              <span className="font-black text-sm uppercase tracking-wider">Composición corporal</span>
            </div>
            <table className="w-full text-xs text-left text-slate-800">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-2 px-3 font-bold bg-white w-1/2 text-teal-700">Fraccionamiento molecular</th>
                  <th className="py-2 px-3 font-bold text-center bg-white text-slate-500 uppercase text-[10px] tracking-wider">Resultados</th>
                  <th className="py-2 px-3 font-bold text-center bg-white text-slate-500 uppercase text-[10px] tracking-wider" colSpan={2}>Puntuación Z</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="py-2 px-3">Masa grasa (kg) (Durnin-Womersley, 1974)</td>
                  <td className="py-2 px-3 text-center">{fmtKg(calc.masaGrasaMolecular)}</td>
                  <td className="py-2 px-0"><ZDot z={calc.zMasaGrasaMol} /></td>
                  <td className="py-2 pr-3 text-right w-12">{fmtZTable(calc.zMasaGrasaMol)}</td>
                </tr>
                <tr className="border-b-2 border-slate-100">
                  <td className="py-2 px-3 font-medium text-slate-600">Masa libre de grasa (kg)</td>
                  <td className="py-2 px-3 text-center">{fmtKg(calc.masaLibreDeGrasaMolecular)}</td>
                  <td className="py-2 px-0"></td>
                  <td className="py-2 pr-3 text-right"></td>
                </tr>
                
                <tr className="border-b border-slate-200">
                  <th className="py-2 px-3 font-bold bg-white text-teal-700 pt-4">Fraccionamiento tisular</th>
                  <th className="py-2 px-3 font-bold text-center bg-white pt-4 text-slate-500 uppercase text-[10px] tracking-wider">Resultados</th>
                  <th className="py-2 px-3 font-bold text-center bg-white pt-4 text-slate-500 uppercase text-[10px] tracking-wider" colSpan={2}>Puntuación Z</th>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-2 px-3">Tejido adiposo (Kerr, 1991) (kg)</td>
                  <td className="py-2 px-3 text-center">{fmtKg(calc.masaAdiposa)}</td>
                  <td className="py-2 px-0"><ZDot z={calc.zMasaAdiposa} /></td>
                  <td className="py-2 pr-3 text-right">{fmtZTable(calc.zMasaAdiposa)}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-2 px-3">Tejido muscular (Lee, 2000) (kg)</td>
                  <td className="py-2 px-3 text-center">{fmtKg(calc.masaMuscular)}</td>
                  <td className="py-2 px-0"><ZDot z={calc.zMasaMuscular} /></td>
                  <td className="py-2 pr-3 text-right">{fmtZTable(calc.zMasaMuscular)}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-2 px-3">Tejido óseo (Rocha, 1974) (kg)</td>
                  <td className="py-2 px-3 text-center">{fmtKg(calc.masaOsea)}</td>
                  <td className="py-2 px-0"><ZDot z={calc.zMasaOsea} /></td>
                  <td className="py-2 pr-3 text-right">{fmtZTable(calc.zMasaOsea)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Gráficos de Fraccionamiento (PieCharts side by side) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-4">
            <div className="p-6">
              {tisularData.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Gráfico Molecular */}
                  <div>
                    <div className="flex items-center justify-center gap-2 mb-4 border-b border-slate-800 pb-1">
                      <p className="text-sm font-semibold text-slate-900">Fraccionamiento molecular</p>
                      <FlaskConical className="w-4 h-4 text-slate-500" />
                    </div>
                    <p className="text-xs font-bold text-black text-center mb-6">Actual</p>
                    {molecularData.length > 0 ? (
                      <>
                        <div className="h-[180px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={molecularData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                                paddingAngle={3} dataKey="value" animationDuration={1000}
                              >
                                {molecularData.map((_, i) => (
                                  <Cell key={`mol-${i}`} fill={PIE_COLORS_MOL[i % PIE_COLORS_MOL.length]} strokeWidth={0} />
                                ))}
                              </Pie>
                              <Tooltip content={<CustomPieTooltip />} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-1.5 mt-3">
                          {molecularData.map((d, i) => (
                            <div key={d.name} className="flex items-center justify-between text-[11px]">
                              <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: PIE_COLORS_MOL[i] }} />
                                <span className="font-bold text-slate-600">{d.name}</span>
                              </div>
                              <span className="text-slate-400">{fmt(d.value)} kg <span className="font-semibold text-slate-500">({fmt(d.pct)}%)</span></span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="h-[200px] flex flex-col items-center justify-center text-center px-4 border-2 border-dashed border-slate-100 rounded-xl">
                        <Info className="w-6 h-6 text-slate-300 mb-2" />
                        <p className="text-[11px] font-semibold text-slate-400">Datos insuficientes</p>
                        <p className="text-[10px] text-slate-400 mt-1">Ingresa Edad, Sexo y los 4 pliegues base para calcular Durnin-Womersley.</p>
                      </div>
                    )}
                  </div>

                  {/* Gráfico Tisular (ISAK) */}
                  <div>
                    <div className="flex items-center justify-center gap-2 mb-4 border-b border-slate-800 pb-1">
                      <p className="text-sm font-semibold text-slate-900">Fraccionamiento tisular</p>
                      <Activity className="w-4 h-4 text-slate-500" />
                    </div>
                    <p className="text-xs font-bold text-black text-center mb-6">Actual</p>
                    {tisularData.length > 0 ? (
                      <>
                        <div className="h-[180px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={tisularData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                                paddingAngle={3} dataKey="value" animationDuration={1000}
                              >
                                {tisularData.map((_, i) => (
                                  <Cell key={`tis-${i}`} fill={PIE_COLORS_TIS[i % PIE_COLORS_TIS.length]} strokeWidth={0} />
                                ))}
                              </Pie>
                              <Tooltip content={<CustomPieTooltip />} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-1.5 mt-3">
                          {tisularData.map((d, i) => (
                            <div key={d.name} className="flex items-center justify-between text-[11px]">
                              <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: PIE_COLORS_TIS[i] }} />
                                <span className="font-bold text-slate-600">{d.name}</span>
                              </div>
                              <span className="text-slate-400">{fmt(d.value)} kg <span className="font-semibold text-slate-500">({fmt(d.pct)}%)</span></span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="h-[200px] flex flex-col items-center justify-center text-center px-4 border-2 border-dashed border-slate-100 rounded-xl">
                        <Info className="w-6 h-6 text-slate-300 mb-2" />
                        <p className="text-[11px] font-semibold text-slate-400">Datos insuficientes</p>
                        <p className="text-[10px] text-slate-400 mt-1">Ingresa las medidas completas para el cálculo tisular.</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-[220px] flex flex-col items-center justify-center text-center">
                  <BarChart2 className="w-10 h-10 text-slate-200 mb-3" />
                  <p className="text-sm text-slate-400 font-medium">Completa los pliegues cutáneos<br />para generar los gráficos de composición.</p>
                </div>
              )}
            </div>
          </div>

          {/* Índices de Composición */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider">Índices de Composición</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-3">
                <ResultCard label="Masa Libre de Grasa" value={calc.masaLibreDeGrasaMolecular > 0 ? fmt(calc.masaLibreDeGrasaMolecular) : '--'} unit="kg" color="text-teal-700" bg="bg-teal-50" />
                <ResultCard label="Índice Adiposo/Muscular" value={calc.indiceAdipMuscular > 0 ? fmt(calc.indiceAdipMuscular, 2) : '--'} unit=""
                  color="text-amber-700" bg="bg-amber-50"
                  note={calc.indiceAdipMuscular > 0 ? calc.clasifIAM : ''}
                  noteColor={calc.indiceAdipMuscular < 0.4 ? 'text-emerald-600' : calc.indiceAdipMuscular < 0.8 ? 'text-amber-600' : 'text-rose-600'}
                />
                <ResultCard label="Índice Músculo/Óseo" value={calc.indiceMusOseo > 0 ? fmt(calc.indiceMusOseo, 2) : '--'} unit=""
                  color="text-blue-700" bg="bg-blue-50"
                  note={calc.indiceMusOseo > 0 ? (calc.indiceMusOseo < 4 ? 'Baja relación músculo-ósea' : calc.indiceMusOseo < 6 ? 'Relación normal' : 'Alta relación músculo-ósea') : ''}
                />
                <ResultCard label="Índice Córmico" value={calc.indiceCormico > 0 ? fmt(calc.indiceCormico, 1) : '--'} unit="%"
                  color="text-purple-700" bg="bg-purple-50"
                  note={calc.clasifCormico !== '--' ? calc.clasifCormico : ''}
                  noteColor="text-purple-600"
                />
              </div>
            </div>
          </div>

          {/* Somatotipo Heath-Carter + Somatocarta */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider">Somatotipo Heath-Carter</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: 'Endomorfia', val: calc.endomorfia, desc: calc.endoDesc, bg: 'bg-rose-50',  border: 'border-rose-100',  color: 'text-rose-600',  sub: 'text-rose-400'  },
                  { label: 'Mesomorfia', val: calc.mesomorfia, desc: calc.mesoDesc, bg: 'bg-teal-50',  border: 'border-teal-100',  color: 'text-teal-600',  sub: 'text-teal-400'  },
                  { label: 'Ectomorfia', val: calc.ectomorfia, desc: calc.ectoDesc, bg: 'bg-blue-50',  border: 'border-blue-100',  color: 'text-blue-600',  sub: 'text-blue-400'  },
                ].map(({ label, val, desc, bg, border, color, sub }) => (
                  <div key={label} className={`${bg} rounded-xl p-4 border ${border}`}>
                    <p className={`text-[10px] font-bold ${color} uppercase tracking-wider mb-1`}>{label}</p>
                    <p className={`text-3xl font-black ${color}`}>{val > 0 ? fmt(val) : '--'}</p>
                    {val > 0 && <p className={`text-[10px] ${sub} mt-1.5 leading-tight font-semibold`}>{desc}</p>}
                  </div>
                ))}
              </div>

              {calc.endomorfia > 0 && (
                <div className="bg-slate-900 rounded-xl p-4">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1 text-center">Clasificación Somatotípica</p>
                  <p className="text-lg font-black text-white text-center">{calc.somatoCompleto.label}</p>
                  <p className="text-[11px] text-slate-400 text-center mt-1">{calc.somatoCompleto.desc}</p>
                  <p className="text-[11px] text-slate-500 text-center mt-2 font-mono">
                    {fmt(calc.endomorfia)}−{fmt(calc.mesomorfia)}−{fmt(calc.ectomorfia)}
                  </p>
                </div>
              )}

              <div className="space-y-2.5">
                {[
                  { label: 'Endomorfia', val: calc.endomorfia, max: 8,  color: 'bg-rose-400' },
                  { label: 'Mesomorfia', val: calc.mesomorfia, max: 10, color: 'bg-teal-500' },
                  { label: 'Ectomorfia', val: calc.ectomorfia, max: 6,  color: 'bg-blue-400' },
                ].map(({ label, val, max, color }) => (
                  <div key={label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-600">{label}</span>
                      <span className="text-xs font-bold text-slate-800">{val > 0 ? fmt(val) : '--'} / {max}</span>
                    </div>
                    <ProgressBar value={val} max={max} color={color} />
                  </div>
                ))}
              </div>

              {/* Somatocarta */}
              {calc.somatoX !== null && (
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Somatocarta · X={fmt(calc.somatoX, 2)} · Y={fmt(calc.somatoY, 2)}
                  </p>
                  <div className="h-[240px] rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis type="number" dataKey="x" domain={[-8, 8]} ticks={[-8,-6,-4,-2,0,2,4,6,8]}
                          axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }}
                          label={{ value: 'Ecto → Endo', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 10 }}
                        />
                        <YAxis type="number" dataKey="y" domain={[-6, 10]} ticks={[-6,-4,-2,0,2,4,6,8,10]}
                          axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }}
                          label={{ value: 'Meso', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 10 }}
                        />
                        <ZAxis range={[100, 100]} />
                        <ReferenceLine x={0} stroke="#cbd5e1" strokeWidth={1.5} />
                        <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1.5} />
                        <Scatter name="Vértices"
                          data={[{ x: 0, y: 9 }, { x: -6, y: -4 }, { x: 6, y: -4 }]}
                          fill="#e2e8f0" shape="circle"
                        />
                        <Scatter name="Paciente"
                          data={[{ x: calc.somatoX, y: calc.somatoY }]}
                          fill="#0f766e" shape="circle"
                        />
                        <Tooltip cursor={false} content={(props) => {
                          if (!props || !props.active || !props.payload?.length) return null
                          const d = props.payload[0]?.payload
                          return (
                            <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
                              <p className="font-bold text-teal-700">X: {fmt(d?.x, 2)} · Y: {fmt(d?.y, 2)}</p>
                              <p className="text-slate-500">{calc?.somatoCompleto?.label || '--'}</p>
                            </div>
                          )
                        }} />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[10px] text-slate-400 text-center mt-1.5">
                    X = Ectomorfia − Endomorfia · Y = 2×Mesomorfia − (Endomorfia + Ectomorfia)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Índices de Salud */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider">Índices de Salud</h3>
            </div>
            <div className="p-6 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <ResultCard label="IMC" value={calc.imc > 0 ? fmt(calc.imc) : '--'} unit="kg/m²"
                  note={imcLabel(calc.imc)}
                  noteColor={calc.imc < 18.5 || calc.imc >= 30 ? 'text-rose-500' : calc.imc < 25 ? 'text-emerald-600' : 'text-amber-600'}
                />
                <ResultCard label="Índice C/C" value={calc.icc > 0 ? fmt(calc.icc, 2) : '--'} unit=""
                  note={iccLabel(calc.icc)}
                  noteColor={calc.icc >= 0.95 ? 'text-rose-500' : calc.icc >= 0.85 ? 'text-amber-600' : 'text-emerald-600'}
                />
                <ResultCard label="Índice C/T" value={calc.ict > 0 ? fmt(calc.ict, 2) : '--'} unit=""
                  note={ictLabel(calc.ict)}
                  noteColor={calc.ict >= 0.5 ? 'text-rose-500' : 'text-emerald-600'}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ResultCard label="Índice de Manouvrier" value={calc.indiceManouvrier > 0 ? fmt(calc.indiceManouvrier, 1) : '--'} unit=""
                  bg="bg-slate-50" note={calc.clasifManouvrier !== '--' ? calc.clasifManouvrier : ''} noteColor="text-slate-600"
                />
                <ResultCard label="Envergadura Relativa" value={calc.envergaduraRelativa > 0 ? fmt(calc.envergaduraRelativa, 1) : '--'} unit="%"
                  bg="bg-slate-50" note={calc.clasifEnvergadura !== '--' ? calc.clasifEnvergadura : ''} noteColor="text-slate-600"
                />
                <ResultCard label="Índice de Conicidad" value={calc.indiceConicidad > 0 ? fmt(calc.indiceConicidad, 3) : '--'} unit=""
                  bg="bg-slate-50" note={calc.clasifConicidad !== '--' ? calc.clasifConicidad : ''}
                  noteColor={calc.indiceConicidad > 0 && calc.indiceConicidad >= calc.umbralConic ? 'text-rose-600' : 'text-emerald-600'}
                />
                <ResultCard label="Índice Distrib. Grasa" value={calc.indiceDistribGrasa > 0 ? fmt(calc.indiceDistribGrasa, 2) : '--'} unit=""
                  bg="bg-slate-50" note={calc.clasifIDG !== '--' ? calc.clasifIDG : ''}
                  noteColor={calc.indiceDistribGrasa >= 1 ? 'text-rose-600' : 'text-emerald-600'}
                />
              </div>

              <div className="flex items-start gap-2.5 bg-slate-50 rounded-xl p-3.5 border border-slate-100 mt-1">
                <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Z-scores con <b>Modelo Phantom (Ross &amp; Ward, 1982)</b>. Fraccionamiento: <b>Kerr (1991)</b>,
                  <b> Lee et al. (2000)</b>, <b>Rocha (1975)</b>. Somatotipo: <b>Heath-Carter (1990)</b>.
                  Conicidad: <b>Valdez (1991)</b>. Los datos del formulario se guardan automáticamente en el navegador.
                </p>
              </div>
            </div>
          </div> {/* Fin Tarjeta Índices */}
        </div> {/* Fin de la columna derecha */}
      </div> {/* Fin Grid Principal */}

      {/* PARTE 1: MODAL DE CONFIGURACIÓN DE EXPORTACIÓN PDF */}
      {showPrintModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-black text-slate-800 flex items-center gap-2">
                <Printer className="w-5 h-5 text-teal-600" /> Opciones de Exportación
              </h3>
              <button onClick={() => setShowPrintModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-500 mb-4">Selecciona las secciones a incluir en el PDF para el paciente:</p>
              
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" checked={printConfig.resumen} onChange={e => setPrintConfig(prev => ({...prev, resumen: e.target.checked}))} className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500" />
                <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900">Resumen de Medidas Base y Z-Scores</span>
              </label>
              
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" checked={printConfig.composicion} onChange={e => setPrintConfig(prev => ({...prev, composicion: e.target.checked}))} className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500" />
                <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900">Fraccionamiento Tisular (ISAK)</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" checked={printConfig.somatotipo} onChange={e => setPrintConfig(prev => ({...prev, somatotipo: e.target.checked}))} className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500" />
                <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900">Somatotipo y Somatocarta</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" checked={printConfig.indices} onChange={e => setPrintConfig(prev => ({...prev, indices: e.target.checked}))} className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500" />
                <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900">Índices Clínicos y Proporcionalidad (Avanzado)</span>
              </label>
            </div>

            <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
              <button onClick={() => setShowPrintModal(false)} className="px-4 py-2 text-slate-600 font-bold text-sm hover:bg-slate-100 rounded-lg transition-colors">
                Cancelar
              </button>
              <button onClick={handlePrint} className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm rounded-lg shadow-sm transition-all flex items-center gap-2">
                <Printer className="w-4 h-4" /> Generar Documento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PARTE 2: COMPONENTE DE IMPRESIÓN (Plantilla renderizada fuera de pantalla) */}
      <div className="hidden print:block">
        <ReporteISAKPrint ref={printRef} data={{ form, history }} calc={calc} config={printConfig} />
      </div>

    </div>
  )
}
