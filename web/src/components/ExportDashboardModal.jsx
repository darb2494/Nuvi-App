import { useState } from 'react'
import {
  X, FileDown, User, BarChart2, Utensils, TrendingUp, Ruler, Compass,
  CheckSquare, Square, ChevronDown, ChevronUp
} from 'lucide-react'

// ── Configuración por defecto del Dossier ────────────────────────────────────
const DEFAULT_CONFIG = {
  // ── Para el Paciente (ON por defecto) ────────────────────────────────────
  datosGenerales:   true,   // Datos básicos, peso, talla, resumen
  graficaCompCorp:  true,   // Gráfica % Grasa vs Músculo
  planNutricional:  true,   // Menú por bloques y recetas
  graficaProgreso:  true,   // Gráfica de progreso histórico
  // ── Análisis Clínico Avanzado (OFF por defecto) ───────────────────────
  tablasISAK:       false,  // Tablas ISAK, pliegues, puntuaciones Z
  somatocarta:      false,  // Somatocarta y somatotipo
}

// ── Mapa hacia las claves que usa DossierIntegralPrint ───────────────────────
// Permite que ExportDashboardModal emita la config que DossierIntegralPrint
// ya entiende (basicos, plan, antropometria, indices) + las nuevas granulares.
export function buildDossierConfig(exportConfig) {
  return {
    // Legado / DossierIntegralPrint actual
    basicos:       exportConfig.datosGenerales,
    plan:          exportConfig.planNutricional,
    antropometria: exportConfig.datosGenerales || exportConfig.graficaCompCorp,
    indices:       exportConfig.tablasISAK || exportConfig.somatocarta,
    // Granular (para versiones futuras del Dossier)
    ...exportConfig,
  }
}

// ── Toggle Switch visual ─────────────────────────────────────────────────────
function Toggle({ id, checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 ${
        checked ? 'bg-teal-500' : 'bg-slate-200'
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

// ── Fila de una opción ───────────────────────────────────────────────────────
function OptionRow({ icon: Icon, iconColor, label, description, checked, onChange }) {
  return (
    <label className={`flex items-center justify-between gap-4 p-3.5 rounded-xl cursor-pointer transition-colors ${
      checked ? 'bg-teal-50/60 border border-teal-200/60' : 'bg-slate-50 border border-transparent hover:border-slate-200'
    }`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
          checked ? 'bg-teal-100 text-teal-600' : 'bg-slate-100 text-slate-400'
        }`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        <div className="min-w-0">
          <p className={`text-sm font-semibold truncate ${checked ? 'text-slate-900' : 'text-slate-500'}`}>
            {label}
          </p>
          {description && (
            <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">{description}</p>
          )}
        </div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </label>
  )
}

// ── Cabecera de categoría colapsable ─────────────────────────────────────────
function CategoryHeader({ label, badge, badgeColor, expanded, onToggle, allOn, onToggleAll }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors"
      >
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {label}
        <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeColor}`}>{badge}</span>
      </button>
      <button
        type="button"
        onClick={onToggleAll}
        className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-teal-600 transition-colors"
      >
        {allOn ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
        {allOn ? 'Desmarcar todo' : 'Marcar todo'}
      </button>
    </div>
  )
}

// ── Componente Principal ─────────────────────────────────────────────────────
export default function ExportDashboardModal({ isOpen, onClose, onExport, pacienteNombre }) {
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [cat1Open, setCat1Open] = useState(true)
  const [cat2Open, setCat2Open] = useState(true)

  if (!isOpen) return null

  const setKey = (key) => (val) => setConfig(prev => ({ ...prev, [key]: val }))

  // Verifica si todos los items de cada categoría están activos
  const pacienteKeys   = ['datosGenerales', 'graficaCompCorp', 'planNutricional', 'graficaProgreso']
  const avanzadoKeys   = ['tablasISAK', 'somatocarta']
  const allPacienteOn  = pacienteKeys.every(k => config[k])
  const allAvanzadoOn  = avanzadoKeys.every(k => config[k])

  const toggleCategory = (keys, forceValue) => {
    const newVal = forceValue !== undefined ? forceValue : !keys.every(k => config[k])
    setConfig(prev => ({ ...prev, ...Object.fromEntries(keys.map(k => [k, newVal])) }))
  }

  const totalActive = Object.values(config).filter(Boolean).length

  const handleExport = () => {
    onExport(buildDossierConfig(config))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

        {/* ── CABECERA ──────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-teal-200 flex-shrink-0">
              <FileDown className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 leading-tight">
                Generar Dossier del Paciente
              </h2>
              {pacienteNombre && (
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Compilando expediente de <span className="font-bold text-slate-600">{pacienteNombre}</span>
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors flex-shrink-0 mt-0.5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── CUERPO SCROLLABLE ────────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* ── Categoría 1: Para el Paciente ─────────────────────────── */}
          <div>
            <CategoryHeader
              label="Para el Paciente"
              badge="Recomendado"
              badgeColor="bg-teal-100 text-teal-700"
              expanded={cat1Open}
              onToggle={() => setCat1Open(v => !v)}
              allOn={allPacienteOn}
              onToggleAll={() => toggleCategory(pacienteKeys)}
            />
            {cat1Open && (
              <div className="space-y-2">
                <OptionRow
                  icon={User}
                  label="Datos Generales y Resumen de Peso/Talla"
                  description="Nombre, edad, medidas básicas e IMC del paciente"
                  checked={config.datosGenerales}
                  onChange={setKey('datosGenerales')}
                />
                <OptionRow
                  icon={BarChart2}
                  label="Gráfica de Composición Corporal"
                  description="% Grasa vs. Masa Muscular en barras visuales"
                  checked={config.graficaCompCorp}
                  onChange={setKey('graficaCompCorp')}
                />
                <OptionRow
                  icon={Utensils}
                  label="Plan Nutricional"
                  description="Menú por bloques de comida, recetas e ingredientes"
                  checked={config.planNutricional}
                  onChange={setKey('planNutricional')}
                />
                <OptionRow
                  icon={TrendingUp}
                  label="Gráfica de Progreso Histórico"
                  description="Curva de evolución de peso, grasa y músculo en el tiempo"
                  checked={config.graficaProgreso}
                  onChange={setKey('graficaProgreso')}
                />
              </div>
            )}
          </div>

          {/* Divisor */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Análisis Clínico Avanzado
              </span>
            </div>
          </div>

          {/* ── Categoría 2: Análisis Clínico Avanzado ───────────────── */}
          <div>
            <CategoryHeader
              label="Tablas Clínicas"
              badge="Especialista"
              badgeColor="bg-indigo-100 text-indigo-700"
              expanded={cat2Open}
              onToggle={() => setCat2Open(v => !v)}
              allOn={allAvanzadoOn}
              onToggleAll={() => toggleCategory(avanzadoKeys)}
            />
            {cat2Open && (
              <div className="space-y-2">
                <OptionRow
                  icon={Ruler}
                  label="Tablas ISAK, Pliegues y Puntuaciones Z"
                  description="Medidas cineantropométricas completas con valores de referencia"
                  checked={config.tablasISAK}
                  onChange={setKey('tablasISAK')}
                />
                <OptionRow
                  icon={Compass}
                  label="Somatocarta y Somatotipo"
                  description="Gráfica del somatotipo Heath-Carter y coordenadas X/Y"
                  checked={config.somatocarta}
                  onChange={setKey('somatocarta')}
                />
              </div>
            )}
          </div>

          {/* ── Resumen de selección ──────────────────────────────────── */}
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
            totalActive > 0
              ? 'bg-teal-50 border border-teal-200 text-teal-800'
              : 'bg-amber-50 border border-amber-200 text-amber-800'
          }`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs flex-shrink-0 ${
              totalActive > 0 ? 'bg-teal-500 text-white' : 'bg-amber-400 text-white'
            }`}>
              {totalActive}
            </div>
            {totalActive > 0
              ? `${totalActive} sección${totalActive > 1 ? 'es' : ''} seleccionada${totalActive > 1 ? 's' : ''} para el Dossier`
              : 'Selecciona al menos una sección para continuar'}
          </div>
        </div>

        {/* ── PIE DEL MODAL ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={totalActive === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-colors shadow-md shadow-teal-200"
          >
            <FileDown className="w-4 h-4" />
            Generar Dossier del Paciente
          </button>
        </div>

      </div>
    </div>
  )
}
