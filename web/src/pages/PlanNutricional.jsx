import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Utensils, Search, X, Plus, Trash2, Flame, Beef, Droplets, Wheat,
  Coffee, Sun, UtensilsCrossed, Apple, Moon, ChevronDown, ChevronUp, Save, Bookmark, Calculator, Activity, Check, Settings2, ShoppingCart, MoreVertical, Copy, Edit2, RefreshCw
} from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import ModalListaCompras from '../components/ModalListaCompras'
import ModalSustitutos from '../components/ModalSustitutos'

// ── Configuración de comidas (Maestro) ──────────────────────────────────────────
const MEAL_CONFIG_MASTER = [
  { key: 'desayuno',       label: 'Desayuno',          icon: Coffee,          color: 'amber',   required: true },
  { key: 'media_manana',   label: 'Media Mañana',      icon: Sun,             color: 'orange',  required: false, group: 'merienda' },
  { key: 'almuerzo',       label: 'Almuerzo',          icon: UtensilsCrossed, color: 'teal',    required: true },
  { key: 'merienda_1',     label: 'Merienda Tarde 1',  icon: Apple,           color: 'emerald', required: false, group: 'merienda' },
  { key: 'merienda_2',     label: 'Merienda Tarde 2',  icon: Apple,           color: 'emerald', required: false, group: 'merienda' },
  { key: 'cena',           label: 'Cena',              icon: Moon,            color: 'indigo',  required: true },
  { key: 'merienda_noche', label: 'Merienda Nocturna', icon: Moon,            color: 'indigo',  required: false, group: 'merienda' },
]

// Soporte para legado si había 'merienda' guardada
const LEGACY_MERIENDA = { key: 'merienda', label: 'Merienda', icon: Apple, color: 'emerald', required: false, group: 'merienda' }

const EMPTY_MEALS = Object.fromEntries([...MEAL_CONFIG_MASTER, LEGACY_MERIENDA].map(m => [m.key, []]))

// ── Paleta de colores por comida ──────────────────────────────────────────────
const COLOR_MAP = {
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',   icon: 'bg-amber-100 text-amber-600',   badge: 'bg-amber-100 text-amber-700'   },
  orange:  { bg: 'bg-orange-50',  border: 'border-orange-200',  icon: 'bg-orange-100 text-orange-600', badge: 'bg-orange-100 text-orange-700' },
  teal:    { bg: 'bg-teal-50',    border: 'border-teal-200',    icon: 'bg-teal-100 text-teal-600',     badge: 'bg-teal-100 text-teal-700'     },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'bg-emerald-100 text-emerald-600', badge: 'bg-emerald-100 text-emerald-700' },
  indigo:  { bg: 'bg-indigo-50',  border: 'border-indigo-200',  icon: 'bg-indigo-100 text-indigo-600', badge: 'bg-indigo-100 text-indigo-700' },
}

// ── Cálculo de macros de un alimento ajustado por cantidad ──────────────────────
function calcMacros(item) {
  const ratio = (parseFloat(item.cantidad) || 0) / (parseFloat(item.porcion_base) || 100)
  return {
    calorias:      Math.round((item._calorias      || 0) * ratio * 10) / 10,
    proteinas:     Math.round((item._proteinas     || 0) * ratio * 10) / 10,
    grasas:        Math.round((item._grasas        || 0) * ratio * 10) / 10,
    carbohidratos: Math.round((item._carbohidratos || 0) * ratio * 10) / 10,
    fibra:         Math.round((item._fibra         || 0) * ratio * 10) / 10,
  }
}

// ── Normaliza un ingrediente desde Supabase a estructura interna consistente ──
function normalizeIngredient(ing) {
  // Supabase guarda los campos como 'calorias','proteinas', etc. (sin guión bajo)
  // Internamente necesitamos '_calorias', '_proteinas', etc. para calcMacros()
  return {
    _rowId:         ing._rowId || `${ing.alimento_id || 'x'}_${Date.now()}_${Math.random()}`,
    tipo:           'alimento',
    alimento_id:    ing.alimento_id,
    nombre:         ing.nombre,
    cantidad:       parseFloat(ing.cantidad) || parseFloat(ing.porcion_base) || 100,
    porcion_base:   parseFloat(ing.porcion_base) || 100,
    _calorias:      parseFloat(ing._calorias ?? ing.calorias) || 0,
    _proteinas:     parseFloat(ing._proteinas ?? ing.proteinas) || 0,
    _grasas:        parseFloat(ing._grasas ?? ing.grasas) || 0,
    _carbohidratos: parseFloat(ing._carbohidratos ?? ing.carbohidratos) || 0,
    _fibra:         parseFloat(ing._fibra ?? ing.fibra) || 0,
  }
}

// ── Suma los macros totales de los ingredientes de una receta (ya escalados) ──
function calcRecipeTotals(ingredientes) {
  return ingredientes.reduce((acc, ing) => {
    const m = calcMacros(ing)
    return {
      calorias:      acc.calorias      + m.calorias,
      proteinas:     acc.proteinas     + m.proteinas,
      grasas:        acc.grasas        + m.grasas,
      carbohidratos: acc.carbohidratos + m.carbohidratos,
      fibra:         acc.fibra         + m.fibra,
    }
  }, { calorias: 0, proteinas: 0, grasas: 0, carbohidratos: 0, fibra: 0 })
}

// ── Suma los macros totales de un bloque (mezcla de alimentos y recetas) ───────
function calcEntryMacros(entry) {
  if (entry.tipo === 'receta') {
    return calcRecipeTotals(entry.ingredientes || [])
  }
  return calcMacros(entry)
}

// ── Componente: Panel de Calculadora de Requerimientos ───────────────────────
function CalculatorPanel({ targets, setTargets, pacienteData, onParamsChange, loadedParams }) {
  const [expanded, setExpanded] = useState(false)
  
  // Estado solo para lo que sí controla la UI de este panel
  const [uiParams, setUiParams] = useState({
    formula: 'mifflin', // 'mifflin' | 'harris' | 'calorimetria'
    caloriasMedidas: 2000,
    agua_ml: 0,
  })
  
  const [macrosConfig, setMacrosConfig] = useState({ protGkg: 2.0, fatPct: 25, carbPct: 50 })

  useEffect(() => {
    if (loadedParams) {
      if (loadedParams.formula) {
        setUiParams(p => ({ 
          ...p, 
          formula: loadedParams.formula, 
          caloriasMedidas: loadedParams.caloriasMedidas || p.caloriasMedidas,
          agua_ml: loadedParams.agua_ml || p.agua_ml
        }))
      }
      if (loadedParams.macrosConfig) {
        setMacrosConfig(loadedParams.macrosConfig)
      } else if (loadedParams.macrosPct) {
        // Fallback para planes antiguos
        setMacrosConfig(p => ({ ...p, fatPct: loadedParams.macrosPct.fat, carbPct: loadedParams.macrosPct.carb }))
      }
    }
  }, [loadedParams])

  const handleUiChange = (e) => setUiParams(p => ({ ...p, [e.target.name]: e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))
  const handleMacroChange = (e) => setMacrosConfig(p => ({ ...p, [e.target.name]: parseFloat(e.target.value) || 0 }))

  // 1. Cálculo Síncrono de Calorías Totales (TEE)
  const pesoPaciente = parseFloat(pacienteData?.peso) || 70
  const altura = parseFloat(pacienteData?.altura) || 170
  const edad = parseFloat(pacienteData?.edad) || 30
  const sexo = pacienteData?.sexo || 'M'
  const actividad = parseFloat(pacienteData?.actividad) || 1.2
  const objetivo = parseFloat(pacienteData?.objetivo) || 1.0

  let caloriasTotalesTEE = 0
  if (uiParams.formula === 'calorimetria') {
    caloriasTotalesTEE = uiParams.caloriasMedidas || 0
  } else {
    let tmb = 0
    if (uiParams.formula === 'mifflin') {
      tmb = (10 * pesoPaciente) + (6.25 * altura) - (5 * edad)
      tmb += (sexo === 'M') ? 5 : -161
    } else {
      if (sexo === 'M') {
        tmb = 66.5 + (13.75 * pesoPaciente) + (5.003 * altura) - (6.75 * edad)
      } else {
        tmb = 655.1 + (9.563 * pesoPaciente) + (1.850 * altura) - (4.676 * edad)
      }
    }
    caloriasTotalesTEE = Math.round(tmb * actividad * objetivo) || 0
  }

  // Proteína
  const proteinPercent = caloriasTotalesTEE > 0 ? Math.ceil(((pesoPaciente * macrosConfig.protGkg) * 4) * 100 / caloriasTotalesTEE) : 0
  const proteinKcal = caloriasTotalesTEE > 0 ? (proteinPercent * caloriasTotalesTEE) / 100 : 0
  const proteinGrams = proteinKcal / 4

  // Grasa
  const fatPercent = macrosConfig.fatPct
  const fatKcal = caloriasTotalesTEE > 0 ? (fatPercent * caloriasTotalesTEE) / 100 : 0
  const fatGrams = fatKcal / 9
  const fatGKgCalculated = fatGrams / pesoPaciente

  // Carbohidratos (CHO)
  const choPercent = macrosConfig.carbPct
  const choKcal = caloriasTotalesTEE > 0 ? (choPercent * caloriasTotalesTEE) / 100 : 0
  const choGrams = choKcal / 4
  const choGKgCalculated = choGrams / pesoPaciente

  // Totales
  const totalPercent = proteinPercent + fatPercent + choPercent
  const totalKcalSum = proteinKcal + fatKcal + choKcal
  
  const isValidPct = Math.round(totalPercent) === 100

  // 2.5 Cálculo de Fibra Requerida (14g por cada 1000 kcal)
  const fibraRequerida = Math.round((caloriasTotalesTEE / 1000) * 14) || 0

  // 3. Sincronización con el Padre
  useEffect(() => {
    const aguaObj = uiParams.agua_ml || Math.round(pesoPaciente * 35)
    setTargets({ 
      calorias: caloriasTotalesTEE, 
      proteinas: Math.round(proteinGrams) || 0, 
      grasas: Math.round(fatGrams) || 0, 
      carbohidratos: Math.round(choGrams) || 0, 
      fibra: fibraRequerida,
      agua_ml: aguaObj 
    })
    onParamsChange?.({ formula: uiParams.formula, macrosConfig, agua_ml: aguaObj })
  }, [caloriasTotalesTEE, proteinGrams, fatGrams, choGrams, fibraRequerida, uiParams.agua_ml, pesoPaciente, uiParams.formula, macrosConfig, setTargets, onParamsChange])

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-4">
      <div 
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 text-indigo-600 p-2 rounded-lg">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Cálculo de Requerimientos</h3>
            <p className="text-xs text-slate-500">
              Objetivo Actual: {caloriasTotalesTEE > 0 ? <span className="font-semibold text-indigo-600">{caloriasTotalesTEE} kcal</span> : 'No configurado'}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
      </div>

      {expanded && (
        <div className="p-5 border-t border-slate-200 bg-slate-50/50 space-y-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 max-w-sm">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Fórmula de Cálculo</label>
              <select name="formula" value={uiParams.formula} onChange={handleUiChange} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none">
                <option value="mifflin">Mifflin-St Jeor</option>
                <option value="harris">Harris-Benedict</option>
                <option value="calorimetria">Calorimetría Directa</option>
              </select>
            </div>
            {uiParams.formula === 'calorimetria' && (
              <div className="flex-1 max-w-sm animate-in fade-in slide-in-from-left-2 duration-200">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Calorías Medidas (kcal)</label>
                <input 
                  type="number" 
                  name="caloriasMedidas" 
                  value={uiParams.caloriasMedidas} 
                  onChange={handleUiChange} 
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" 
                />
              </div>
            )}
            <div className="flex-1 max-w-sm">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Req. Hídrico (ml)</label>
              <input 
                type="number" 
                name="agua_ml" 
                value={uiParams.agua_ml || Math.round((pacienteData?.peso || 70) * 35)} 
                onChange={handleUiChange} 
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" 
              />
            </div>
            <div className="flex-1 max-w-sm">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Fibra Requerida (g)</label>
              <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 flex items-center">
                {fibraRequerida} g
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-700">Fórmula Dietética</label>
            </div>
            
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
              <table className="w-full text-left border-collapse text-sm bg-white">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    <th className="px-4 py-3">Nutriente</th>
                    <th className="px-4 py-3 text-center w-24">%</th>
                    <th className="px-4 py-3 text-center">Kcal</th>
                    <th className="px-4 py-3 text-center">g</th>
                    <th className="px-4 py-3 text-center w-24">g/Kg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* Fila Proteína */}
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-red-600 flex items-center gap-2">
                      <Beef className="w-4 h-4" /> Proteína
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-700">
                      {proteinPercent}%
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-slate-600">
                      {Math.round(proteinKcal)}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-700">
                      {Math.round(proteinGrams)}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input 
                        type="number" 
                        step="0.1" 
                        name="protGkg" 
                        value={macrosConfig.protGkg} 
                        onChange={handleMacroChange} 
                        className="w-full px-2 py-1.5 bg-teal-50 border border-teal-200 rounded text-center text-sm font-bold text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/30 transition-colors" 
                      />
                    </td>
                  </tr>

                  {/* Fila Grasa */}
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-amber-600 flex items-center gap-2">
                      <Droplets className="w-4 h-4" /> Grasa
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input 
                        type="number" 
                        step="1" 
                        name="fatPct" 
                        value={macrosConfig.fatPct} 
                        onChange={handleMacroChange} 
                        className="w-full px-2 py-1.5 bg-teal-50 border border-teal-200 rounded text-center text-sm font-bold text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/30 transition-colors" 
                      />
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-slate-600">
                      {Math.round(fatKcal)}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-700">
                      {Math.round(fatGrams)}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-slate-500">
                      {fatGKgCalculated.toFixed(1)}
                    </td>
                  </tr>

                  {/* Fila CHO */}
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-lime-600 flex items-center gap-2">
                      <Wheat className="w-4 h-4" /> CHO
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input 
                        type="number" 
                        step="1" 
                        name="carbPct" 
                        value={macrosConfig.carbPct} 
                        onChange={handleMacroChange} 
                        className="w-full px-2 py-1.5 bg-teal-50 border border-teal-200 rounded text-center text-sm font-bold text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/30 transition-colors" 
                      />
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-slate-600">
                      {Math.round(choKcal)}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-700">
                      {Math.round(choGrams)}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-slate-500">
                      {choGKgCalculated.toFixed(1)}
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-200 font-bold">
                    <td className="px-4 py-3 text-slate-700 uppercase tracking-wider text-xs">Total</td>
                    <td className={`px-4 py-3 text-center ${isValidPct ? 'text-emerald-600' : 'text-red-500'}`}>
                      {totalPercent}%
                    </td>
                    <td className="px-4 py-3 text-center text-slate-700">
                      {Math.round(totalKcalSum)}
                    </td>
                    <td colSpan="2" className="px-4 py-3 text-right text-xs text-slate-500 font-normal">
                      {!isValidPct && 'Ajuste porcentajes para llegar al 100%'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Componente: Panel de Distribución por Comidas ────────────────────────────
function MealDistributionPanel({ targets, activeBlocks, distribution, setDistribution }) {
  const [expanded, setExpanded] = useState(false)

  // Initialize distribution if missing
  useEffect(() => {
    if (activeBlocks.length > 0) {
      setDistribution(prev => {
        const next = { ...prev }
        let changed = false
        activeBlocks.forEach(block => {
          if (next[block] === undefined) {
            next[block] = Math.round(100 / activeBlocks.length)
            changed = true
          }
        })
        return changed ? next : prev
      })
    }
  }, [activeBlocks, setDistribution])

  const handleDistChange = (block, val) => {
    setDistribution(prev => ({ ...prev, [block]: parseFloat(val) || 0 }))
  }

  const sumaDist = activeBlocks.reduce((acc, block) => acc + (distribution[block] || 0), 0)
  const isValidDist = sumaDist > 98 && sumaDist < 102

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      <div 
        className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="bg-sky-100 text-sky-600 p-2 rounded-lg">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Distribución por Comida</h3>
            <p className="text-xs text-slate-500">Asignar % del requerimiento total</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </div>

      {expanded && (
        <div className="p-4 border-t border-slate-200 bg-slate-50/50">
          <div className="flex items-center justify-between mb-4">
            <label className="block text-xs font-semibold text-slate-700">Porcentajes Asignados</label>
            <span className={`text-xs font-bold ${isValidDist ? 'text-emerald-600' : 'text-red-500'}`}>
              Suma: {Math.round(sumaDist)}% {isValidDist ? '✓' : '(Revisar)'}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {activeBlocks.map(block => {
              const conf = MEAL_CONFIG_MASTER.find(m => m.key === block) || LEGACY_MERIENDA
              const pct = distribution[block] || 0
              const cal = Math.round((targets.calorias * pct) / 100)
              const prot = Math.round((targets.proteinas * pct) / 100)
              return (
                <div key={block} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
                  <div className="flex items-center gap-1.5">
                    <conf.icon className={`w-3.5 h-3.5 text-${conf.color}-500`} />
                    <span className="text-xs font-bold text-slate-700 truncate">{conf.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" value={pct} onChange={e => handleDistChange(block, e.target.value)} className="w-full px-2 py-1 text-sm border border-slate-200 rounded outline-none focus:border-sky-400 text-center" />
                    <span className="text-xs text-slate-400 font-medium w-4">%</span>
                  </div>
                  <div className="text-[10px] text-slate-500 text-center mt-1 font-medium bg-slate-50 rounded py-1">
                    <span className="text-orange-600 font-bold">{cal} kcal</span> · <span className="text-red-600 font-bold">{prot}g P</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Componente: Configuración de Bloques ──────────────────────────────────────
function BlockConfigPanel({ activeBlocks, onToggle }) {
  const [expanded, setExpanded] = useState(false)
  const optionals = MEAL_CONFIG_MASTER.filter(m => !m.required)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      <div 
        className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="bg-slate-100 text-slate-600 p-2 rounded-lg">
            <Settings2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Configurar Tiempos de Comida</h3>
            <p className="text-xs text-slate-500">
              {activeBlocks.length} bloques activos
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </div>

      {expanded && (
        <div className="p-4 border-t border-slate-200 bg-slate-50/50">
          <div className="flex flex-wrap gap-3">
            {optionals.map(opt => {
              const isActive = activeBlocks.includes(opt.key)
              return (
                <button
                  key={opt.key}
                  onClick={() => onToggle(opt.key)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                    isActive 
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${isActive ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                    {isActive && <Check className="w-3 h-3 text-white" />}
                  </div>
                  {opt.label}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-slate-400 mt-3 ml-1">
            * Desayuno, Almuerzo y Cena son fijos.
          </p>
        </div>
      )}
    </div>
  )
}


// ── Componente: Barra de Macros Total (Sticky) ───────────────────────────────
function MacrosStickyBar({ meals, targets, activeBlocks }) {
  const totales = useMemo(() => {
    const allEntries = activeBlocks.flatMap(key => meals[key] || [])
    return allEntries.reduce((acc, entry) => {
      const m = calcEntryMacros(entry)
      return {
        calorias:      acc.calorias      + m.calorias,
        proteinas:     acc.proteinas     + m.proteinas,
        grasas:        acc.grasas        + m.grasas,
        carbohidratos: acc.carbohidratos + m.carbohidratos,
        fibra:         acc.fibra         + m.fibra,
      }
    }, { calorias: 0, proteinas: 0, grasas: 0, carbohidratos: 0, fibra: 0 })
  }, [meals, activeBlocks])

  const getStatus = (current, target) => {
    if (!target) return { pct: 0, text: 'Sin meta', color: 'text-slate-400' }
    const diff = target - current
    const pct = Math.min((current / target) * 100, 100)
    
    if (diff > 0) {
      return { pct, text: `Faltan: ${Math.round(diff)}`, color: 'text-slate-500' }
    } else if (diff < 0) {
      return { pct: 100, text: `Te pasaste: ${Math.round(Math.abs(diff))}`, color: 'text-red-500 font-semibold' }
    } else {
      return { pct: 100, text: '¡Exacto!', color: 'text-emerald-500 font-semibold' }
    }
  }

  const macros = [
    { key: 'calorias',      label: 'Calorías',      value: Math.round(totales.calorias),  target: targets.calorias,  unit: 'kcal', color: 'orange', icon: Flame    },
    { key: 'proteinas',     label: 'Proteínas',     value: Math.round(totales.proteinas), target: targets.proteinas, unit: 'g',    color: 'red',    icon: Beef     },
    { key: 'grasas',        label: 'Grasas',        value: Math.round(totales.grasas),    target: targets.grasas,    unit: 'g',    color: 'amber',  icon: Droplets },
    { key: 'carbohidratos', label: 'Carbohidratos', value: Math.round(totales.carbohidratos), target: targets.carbohidratos, unit: 'g', color: 'lime',   icon: Wheat    },
    { key: 'fibra',         label: 'Fibra',         value: Math.round(totales.fibra || 0),    target: targets.fibra || 0,    unit: 'g',    color: 'emerald',icon: Wheat    },
    { key: 'agua',          label: 'Agua',          value: 0, target: targets.agua_ml, unit: 'ml', color: 'blue', icon: Droplets, isWater: true },
  ]

  const bgColors = { orange: 'bg-orange-500', red: 'bg-red-500', amber: 'bg-amber-500', lime: 'bg-lime-500', emerald: 'bg-emerald-500', blue: 'bg-cyan-500' }
  const lightColors = { orange: 'bg-orange-50 text-orange-700', red: 'bg-red-50 text-red-700', amber: 'bg-amber-50 text-amber-700', lime: 'bg-lime-50 text-lime-700', emerald: 'bg-emerald-50 text-emerald-700', blue: 'bg-cyan-50 text-cyan-700' }
  const progressBg = { orange: 'bg-orange-200', red: 'bg-red-200', amber: 'bg-amber-200', lime: 'bg-lime-200', emerald: 'bg-emerald-200', blue: 'bg-cyan-200' }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sticky top-0 z-10 mb-6 backdrop-blur-md bg-white/90">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {macros.map(({ key, label, value, target, unit, color, icon: Icon, isWater }) => {
          if (isWater) {
            const liters = target ? (target / 1000).toFixed(1) : 0
            const vasos = target ? Math.round(target / 250) : 0
            return (
              <div key={label} className={`flex flex-col justify-between p-3 rounded-xl ${lightColors[color]} border border-white/50 shadow-sm relative overflow-hidden group`}>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-7 h-7 rounded flex items-center justify-center ${bgColors[color]} text-white flex-shrink-0 shadow-sm`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">{label}</p>
                  </div>
                  <div className="flex items-baseline gap-1 mb-1">
                    <p className="text-xl font-black leading-none">{liters}</p>
                    <p className="text-xs font-semibold opacity-60">L</p>
                  </div>
                </div>
                <p className="text-[10px] font-semibold text-cyan-600">
                  ≈ {vasos} vasos (250ml)
                </p>
              </div>
            )
          }

          const stat = getStatus(value, target)
          
          return (
            <div key={label} className={`flex flex-col p-3 rounded-xl ${lightColors[color]} border border-white/50 shadow-sm relative overflow-hidden group`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-7 h-7 rounded flex items-center justify-center ${bgColors[color]} text-white flex-shrink-0 shadow-sm`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">{label}</p>
              </div>
              
              <div className="flex items-baseline gap-1 mb-2">
                <p className="text-xl font-black leading-none">{value}</p>
                <p className="text-xs font-semibold opacity-60">/ {target || 0} {unit}</p>
              </div>

              <div className={`w-full h-1.5 rounded-full ${progressBg[color]} overflow-hidden mb-1.5`}>
                <div 
                  className={`h-full ${bgColors[color]} transition-all duration-500 ease-out`}
                  style={{ width: `${stat.pct}%` }}
                />
              </div>
              
              <p className={`text-[10px] ${stat.color} transition-colors`}>
                {stat.text} {target ? unit : ''}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Componente: Buscador de Alimentos y Recetas ──────────────────────────────
function AlimentoBuscador({ mealKey, onAdd, onAddMultiple, colorKey, tenantId }) {
  const [searchMode, setSearchMode] = useState('alimentos') // 'alimentos' | 'recetas'
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen]           = useState(false)
  const wrapperRef                = useRef(null)
  const timeoutRef                = useRef(null)
  const colors                    = COLOR_MAP[colorKey] || COLOR_MAP.teal

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSearch = (val, mode = searchMode) => {
    setQuery(val)
    clearTimeout(timeoutRef.current)
    
    if (mode === 'alimentos' && !val.trim()) { 
      setResults([])
      setOpen(false)
      return 
    }

    timeoutRef.current = setTimeout(async () => {
      setSearching(true)
      
      if (mode === 'alimentos') {
        const { data } = await supabase
          .from('alimentos')
          .select('id, nombre, porcion_base, calorias, proteinas, grasas, carbohidratos')
          .ilike('nombre', `%${val.trim()}%`)
          .limit(8)
        setResults(data || [])
        setOpen(true)
      } else {
        let queryBuilder = supabase
          .from('recetas')
          .select('id, nombre, ingredientes, calorias, proteinas, grasas, carbohidratos, tipo_comida')
          .eq('tenant_id', tenantId)
        
        if (val.trim()) {
          queryBuilder = queryBuilder.ilike('nombre', `%${val.trim()}%`)
        } else {
          // Lógica de Cross-Loading
          const mealGroup = MEAL_CONFIG_MASTER.find(m => m.key === mealKey)?.group
          
          if (mealKey === 'cena' || mealKey === 'desayuno') {
             queryBuilder = queryBuilder.in('tipo_comida', ['cena', 'desayuno'])
          } else if (mealGroup === 'merienda' || mealKey === 'merienda') {
             queryBuilder = queryBuilder.in('tipo_comida', ['media_manana', 'merienda_1', 'merienda_2', 'merienda_noche', 'merienda'])
          } else {
             queryBuilder = queryBuilder.eq('tipo_comida', mealKey)
          }
          
          queryBuilder = queryBuilder.order('created_at', { ascending: false }).limit(5)
        }
        
        const { data } = await queryBuilder.limit(8)
        setResults(data || [])
        setOpen(true)
      }
      
      setSearching(false)
    }, 280)
  }

  const handleFocus = () => {
    if (searchMode === 'recetas' && !query.trim()) {
      handleSearch('', 'recetas')
    } else if (results.length > 0) {
      setOpen(true)
    }
  }

  const handleModeChange = (mode) => {
    setSearchMode(mode)
    setResults([])
    setQuery('')
    if (mode === 'recetas') {
      handleSearch('', 'recetas')
    }
  }

  const handleSelect = (item) => {
    if (searchMode === 'alimentos') {
      // Alimento suelto → normalizado con campos _ internos
      onAdd(normalizeIngredient({
        alimento_id:   item.id,
        nombre:        item.nombre,
        cantidad:      item.porcion_base || 100,
        porcion_base:  item.porcion_base || 100,
        _calorias:     item.calorias      || 0,
        _proteinas:    item.proteinas     || 0,
        _grasas:       item.grasas        || 0,
        _carbohidratos: item.carbohidratos || 0,
      }))
    } else {
      // Receta → objeto jerárquico con sus ingredientes normalizados
      const ingredientesNorm = (item.ingredientes || []).map(normalizeIngredient)
      onAdd({
        _rowId:      `receta_${item.id}_${Date.now()}`,
        tipo:        'receta',
        receta_id:   item.id,
        nombre:      item.nombre,
        tipo_comida: item.tipo_comida,
        ingredientes: ingredientesNorm,
      })
    }
    
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex mb-2 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => handleModeChange('alimentos')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${searchMode === 'alimentos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Buscar Alimento
        </button>
        <button
          onClick={() => handleModeChange('recetas')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${searchMode === 'recetas' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Cargar Receta
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={handleFocus}
          placeholder={searchMode === 'alimentos' ? "Buscar alimento para agregar…" : "Buscar receta guardada…"}
          className={`w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-${colors.bg.split('-')[1]}-500/20 focus:border-${colors.bg.split('-')[1]}-500 bg-white transition-all`}
        />
        {searching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className={`w-4 h-4 border-2 border-${colors.bg.split('-')[1]}-300 border-t-${colors.bg.split('-')[1]}-600 rounded-full animate-spin`} />
          </div>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-80 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-300">
          {results.map((item) => {
            if (searchMode === 'alimentos') {
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={() => handleSelect(item)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 hover:${colors.bg} transition-colors text-left`}
                >
                  <span className="text-sm font-medium text-slate-800 truncate flex-1">{item.nombre}</span>
                  <div className="flex items-center gap-2 ml-2 flex-shrink-0 text-xs text-slate-400">
                    <span className="font-semibold text-orange-600">{item.calorias ?? '—'} kcal</span>
                    <span>·</span>
                    <span>{item.porcion_base ?? 100}g</span>
                  </div>
                </button>
              )
            } else {
              const ingsPreview = (item.ingredientes || []).map(i => i.nombre).join(', ')
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={() => handleSelect(item)}
                  className={`w-full flex flex-col px-4 py-3 border-b border-slate-100 last:border-0 hover:${colors.bg} transition-colors text-left`}
                >
                  <div className="flex items-start justify-between w-full mb-1.5">
                    <span className="text-sm font-bold text-slate-900 truncate pr-2">{item.nombre}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors.badge} capitalize`}>
                      {item.tipo_comida.replace(/_/g, ' ')}
                    </span>
                  </div>
                  
                  <div className="w-full text-xs text-slate-500 truncate mb-2">
                    <span className="font-semibold text-slate-600">{item.ingredientes?.length || 0} ingredientes:</span> {ingsPreview || 'Sin ingredientes'}
                  </div>

                  <div className="flex items-center gap-2 text-[10px] font-bold">
                    <span className="bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded flex items-center gap-1"><Flame className="w-3 h-3 text-orange-500" />{Math.round(item.calorias || 0)} kcal</span>
                    <span className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded">{Math.round(item.proteinas || 0)}g P</span>
                    <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">{Math.round(item.grasas || 0)}g G</span>
                    <span className="bg-lime-50 text-lime-700 px-1.5 py-0.5 rounded">{Math.round(item.carbohidratos || 0)}g C</span>
                    <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">{Math.round(item.fibra || 0)}g F</span>
                  </div>
                </button>
              )
            }
          })}
        </div>
      )}

      {open && query && results.length === 0 && !searching && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-sm text-slate-400 text-center">
          No se encontraron {searchMode} para "{query}"
        </div>
      )}
      
      {open && !query && results.length === 0 && !searching && searchMode === 'recetas' && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-sm text-slate-400 text-center">
          No tienes recetas guardadas para este tipo de comida
        </div>
      )}
    </div>
  )
}

// ── Fila de un alimento suelto ────────────────────────────────────────────────
function AlimentoRow({ item, onCantidadChange, onRemove }) {
  const m = calcMacros(item)
  return (
    <tr className="hover:bg-slate-50/70 group transition-colors">
      <td className="px-3 py-2.5 text-sm font-medium text-slate-800 max-w-[200px]">
        <span className="truncate block" title={item.nombre}>{item.nombre}</span>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1">
          <input type="number" min="1" value={item.cantidad}
            onChange={(e) => onCantidadChange(item._rowId, e.target.value)}
            className="w-20 text-center px-2 py-1 text-sm font-semibold border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
          />
          <span className="text-xs text-slate-400 font-medium">g</span>
        </div>
      </td>
      <td className="px-3 py-2.5 text-center"><span className="text-sm font-bold text-orange-600">{m.calorias}</span></td>
      <td className="px-3 py-2.5 text-center"><span className="text-sm font-bold text-red-600">{m.proteinas}</span></td>
      <td className="px-3 py-2.5 text-center"><span className="text-sm font-bold text-amber-600">{m.grasas}</span></td>
      <td className="px-3 py-2.5 text-center"><span className="text-sm font-bold text-lime-700">{m.carbohidratos}</span></td>
      <td className="px-3 py-2.5 text-center"><span className="text-sm font-bold text-emerald-700">{m.fibra || 0}</span></td>
      <td className="px-3 py-2.5 text-center">
        <button type="button" onClick={() => onRemove(item._rowId)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  )
}

// ── Tarjeta expandible de Receta con ingredientes editables ──────────────────
function RecetaEntry({ entry, onIngredientChange, onRemoveEntry }) {
  const [expanded, setExpanded] = useState(false)
  const totals = calcRecipeTotals(entry.ingredientes || [])

  const handleIngCantidad = (rowId, val) => {
    onIngredientChange(entry._rowId, rowId, val)
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden mb-2 shadow-sm">
      {/* Cabecera de la Receta */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-indigo-50/60 border-b border-indigo-100">
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-2 flex-1 text-left group"
        >
          <div className="bg-indigo-100 text-indigo-600 p-1 rounded-md flex-shrink-0">
            <Bookmark className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{entry.nombre}</p>
            <p className="text-[10px] text-indigo-500 font-semibold">
              {entry.ingredientes?.length || 0} ingredientes
            </p>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
        </button>
        {/* Macros resumen */}
        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
          <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
            {Math.round(totals.calorias)} kcal
          </span>
          <span className="text-[10px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded">
            {Math.round(totals.proteinas)}P
          </span>
          <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">
            {Math.round(totals.grasas)}G
          </span>
          <span className="text-[10px] font-bold bg-lime-50 text-lime-700 px-1.5 py-0.5 rounded">
            {Math.round(totals.carbohidratos)}C
          </span>
          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">
            {Math.round(totals.fibra || 0)}F
          </span>
          <button
            type="button"
            onClick={() => onRemoveEntry(entry._rowId)}
            className="ml-1 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tabla de ingredientes expandible */}
      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="px-3 py-2">Ingrediente</th>
                <th className="px-3 py-2">Cant.</th>
                <th className="px-3 py-2 text-center text-orange-400">kcal</th>
                <th className="px-3 py-2 text-center text-red-400">Prot</th>
                <th className="px-3 py-2 text-center text-amber-400">Grasas</th>
                <th className="px-3 py-2 text-center text-lime-500">Carbos</th>
                <th className="px-3 py-2 text-center text-emerald-500">Fibra</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(entry.ingredientes || []).map(ing => {
                const m = calcMacros(ing)
                return (
                  <tr key={ing._rowId} className="hover:bg-slate-50/70 group">
                    <td className="px-3 py-2 text-sm font-medium text-slate-700 max-w-[180px]">
                      <span className="truncate block" title={ing.nombre}>{ing.nombre}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="number" min="1" value={ing.cantidad}
                          onChange={(e) => handleIngCantidad(ing._rowId, e.target.value)}
                          className="w-18 text-center px-2 py-1 text-xs font-semibold border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white"
                        />
                        <span className="text-[10px] text-slate-400">g</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center"><span className="text-xs font-bold text-orange-600">{m.calorias}</span></td>
                    <td className="px-3 py-2 text-center"><span className="text-xs font-bold text-red-600">{m.proteinas}</span></td>
                    <td className="px-3 py-2 text-center"><span className="text-xs font-bold text-amber-600">{m.grasas}</span></td>
                    <td className="px-3 py-2 text-center"><span className="text-xs font-bold text-lime-700">{m.carbohidratos}</span></td>
                    <td className="px-3 py-2 text-center"><span className="text-xs font-bold text-emerald-700">{m.fibra || 0}</span></td>
                  </tr>
                )
              })}
            </tbody>
            {/* Totales de la receta */}
            <tfoot>
              <tr className="bg-indigo-50/40 font-bold text-xs text-slate-600 border-t border-indigo-100">
                <td className="px-3 py-1.5 text-indigo-700 font-bold" colSpan={2}>Total receta</td>
                <td className="px-3 py-1.5 text-center text-orange-600">{Math.round(totals.calorias)}</td>
                <td className="px-3 py-1.5 text-center text-red-600">{Math.round(totals.proteinas)}</td>
                <td className="px-3 py-1.5 text-center text-amber-600">{Math.round(totals.grasas)}</td>
                <td className="px-3 py-1.5 text-center text-lime-700">{Math.round(totals.carbohidratos)}</td>
                <td className="px-3 py-1.5 text-center text-emerald-700">{Math.round(totals.fibra || 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Componente: Tarjeta de Comida ─────────────────────────────────────────────
function MealCard({ config, items, tenantId, onAdd, onCantidadChange, onRemove, onIngredientChange, onSaveReceta }) {
  const [expanded, setExpanded] = useState(true)
  const { label, icon: Icon, color, key } = config
  const colors = COLOR_MAP[color] || COLOR_MAP.teal

  const mealTotals = useMemo(() => {
    return items.reduce((acc, entry) => {
      const m = calcEntryMacros(entry)
      return {
        calorias: acc.calorias + m.calorias,
        proteinas: acc.proteinas + m.proteinas,
        grasas: acc.grasas + m.grasas,
        carbohidratos: acc.carbohidratos + m.carbohidratos
      }
    }, { calorias: 0, proteinas: 0, grasas: 0, carbohidratos: 0 })
  }, [items])

  // Separar alimentos sueltos para la tabla unificada
  const alimentosSueltos = items.filter(e => e.tipo !== 'receta')
  const recetas = items.filter(e => e.tipo === 'receta')

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-5">
      <div
        className={`flex items-center justify-between px-5 py-3.5 cursor-pointer select-none border-b ${expanded ? colors.border + ' rounded-t-2xl' : 'border-transparent rounded-2xl'} ${colors.bg} transition-colors`}
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors.icon}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">{label}</h3>
            <p className="text-xs text-slate-500">
              {items.length === 0
                ? 'Sin alimentos'
                : `${recetas.length > 0 ? `${recetas.length} receta${recetas.length > 1 ? 's' : ''}` : ''}${recetas.length > 0 && alimentosSueltos.length > 0 ? ' + ' : ''}${alimentosSueltos.length > 0 ? `${alimentosSueltos.length} alimento${alimentosSueltos.length > 1 ? 's' : ''}` : ''}`
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {mealTotals.calorias > 0 && (
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${colors.badge}`}>
              {Math.round(mealTotals.calorias)} kcal
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          <AlimentoBuscador 
            mealKey={key}
            onAdd={onAdd}
            colorKey={color} 
            tenantId={tenantId}
          />

          {/* Recetas (jerárquicas, expandibles) */}
          {recetas.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Recetas del bloque</p>
              {recetas.map(entry => (
                <RecetaEntry
                  key={entry._rowId}
                  entry={entry}
                  onIngredientChange={onIngredientChange}
                  onRemoveEntry={onRemove}
                />
              ))}
            </div>
          )}

          {/* Alimentos sueltos (tabla plana) */}
          {alimentosSueltos.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-100">
              {recetas.length > 0 && (
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 pt-2">Alimentos adicionales</p>
              )}
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-3 py-2">Alimento</th>
                    <th className="px-3 py-2">Cantidad</th>
                    <th className="px-3 py-2 text-center"><span className="flex items-center justify-center gap-1"><Flame className="w-3 h-3 text-orange-400" />kcal</span></th>
                    <th className="px-3 py-2 text-center"><span className="flex items-center justify-center gap-1"><Beef className="w-3 h-3 text-red-400" />Prot</span></th>
                    <th className="px-3 py-2 text-center"><span className="flex items-center justify-center gap-1"><Droplets className="w-3 h-3 text-amber-400" />Grasas</span></th>
                    <th className="px-3 py-2 text-center"><span className="flex items-center justify-center gap-1"><Wheat className="w-3 h-3 text-lime-500" />Carbos</span></th>
                    <th className="px-3 py-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {alimentosSueltos.map(item => (
                    <AlimentoRow key={item._rowId} item={item} onCantidadChange={onCantidadChange} onRemove={onRemove} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {items.length > 0 && (
            <div className="flex justify-end mt-2">
              <button onClick={() => onSaveReceta(key, alimentosSueltos, mealTotals)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer">
                <Bookmark className="w-3.5 h-3.5" />
                Guardar alimentos como Receta
              </button>
            </div>
          )}

          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-6 text-slate-300">
              <Utensils className="w-8 h-8 mb-2" />
              <p className="text-sm text-slate-400">Busca un alimento o receta para agregarlo aquí</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Modal de Guardar Receta ───────────────────────────────────────────────────
function GuardarRecetaModal({ isOpen, onClose, mealKey, items, totals, tenantId }) {
  const [nombre, setNombre] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen) {
      setNombre('')
      setError(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSave = async (e) => {
    e.preventDefault()
    if (!nombre.trim()) return

    setSaving(true)
    setError(null)

    try {
      const ingredientes = items.map(item => {
        const { _rowId, ...rest } = item
        return rest
      })

      const payload = {
        nombre: nombre.trim(),
        tipo_comida: mealKey,
        ingredientes: ingredientes,
        calorias: totals.calorias,
        proteinas: totals.proteinas,
        grasas: totals.grasas,
        carbohidratos: totals.carbohidratos,
        tenant_id: tenantId
      }

      const { error: dbError } = await supabase.from('recetas').insert(payload)
      if (dbError) throw dbError
      
      onClose(true) // success
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm animate-in zoom-in-95 duration-200">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-teal-100 p-2 rounded-lg text-teal-600">
              <Bookmark className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Guardar Receta</h2>
          </div>
          <button onClick={() => onClose(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">{error}</div>
          )}
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre de la Receta</label>
            <input
              type="text"
              required
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Avena con frutas y almendras"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
            />
            <p className="text-xs text-slate-500 mt-2">
              Se guardarán los {items.length} alimentos actuales ({Math.round(totals.calorias)} kcal) como una plantilla reutilizable.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => onClose(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer">
              Cancelar
            </button>
            <button type="submit" disabled={saving || !nombre.trim()} className="flex items-center gap-2 bg-teal-600 text-white px-5 py-2 rounded-xl font-semibold text-sm hover:bg-teal-700 transition-colors cursor-pointer disabled:opacity-60">
              {saving ? 'Guardando...' : 'Guardar Receta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Componente Principal: PlanNutricional ─────────────────────────────────────
export default function PlanNutricional({ pacienteId, tenantId, pacienteData, planCargado, clearPlanCargado }) {
  const initialMenuId = crypto.randomUUID()
  const [menus, setMenus] = useState([{ id: initialMenuId, nombre: 'Menú 1', meals: EMPTY_MEALS }])
  const [activeMenuId, setActiveMenuId] = useState(initialMenuId)
  const [activeBlocks, setActiveBlocks] = useState(['desayuno', 'almuerzo', 'cena'])
  const [distribution, setDistribution] = useState({})
  const [loadedParams, setLoadedParams] = useState(null)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [recetaModal, setRecetaModal] = useState({ open: false, mealKey: null, items: [], totals: {} })
  const [comprasModalOpen, setComprasModalOpen] = useState(false)
  const [sustitutosModalOpen, setSustitutosModalOpen] = useState(false)
  const [toastMsg, setToastMsg]   = useState(null)
  const [toastType, setToastType] = useState('success') // 'success' | 'error'
  const [macroTargets, setMacroTargets]   = useState({ calorias: 0, proteinas: 0, grasas: 0, carbohidratos: 0, agua_ml: 0 })
  // Ref para acceder a los parámetros internos del CalculatorPanel (fórmula usada)
  const calculatorParamsRef = useRef({ formula: 'mifflin', agua_ml: 0 })

  // Referencia para capturar los parámetros de la calculadora al momento de guardar
  const handleCalculatorParams = useCallback(({ formula, macrosPct, agua_ml }) => {
    calculatorParamsRef.current = { formula, macrosPct, agua_ml }
  }, [])

  // Cargar un plan anterior
  useEffect(() => {
    if (planCargado) {
      setActiveBlocks(planCargado.bloques_activos || [])
      
      const req = planCargado.requerimientos || {}
      setLoadedParams({
        formula: req.formula || 'mifflin',
        macrosPct: req.macros_pct || { prot: 25, fat: 25, carb: 50 },
        caloriasMedidas: req.calorias || 2000,
        agua_ml: req.agua_ml
      })

      if (planCargado.menu) {
        if (Array.isArray(planCargado.menu)) {
          // Formato nuevo (Multi-menu)
          const newMenus = planCargado.menu.map(m => {
            const newMeals = {}
            Object.entries(m.meals || {}).forEach(([key, entries]) => {
              newMeals[key] = entries.map(entry => {
                if (entry.tipo === 'receta') {
                  return { ...entry, _rowId: crypto.randomUUID(), ingredientes: (entry.ingredientes || []).map(normalizeIngredient) }
                }
                return normalizeIngredient({ ...entry, _rowId: crypto.randomUUID() })
              })
            })
            return { id: crypto.randomUUID(), nombre: m.nombre, meals: newMeals }
          })
          if (newMenus.length > 0) {
            setMenus(newMenus)
            setActiveMenuId(newMenus[0].id)
          }
        } else {
          // Formato antiguo (un solo menú)
          const newMeals = {}
          Object.entries(planCargado.menu).forEach(([key, entries]) => {
            newMeals[key] = entries.map(entry => {
              if (entry.tipo === 'receta') {
                return { ...entry, _rowId: crypto.randomUUID(), ingredientes: (entry.ingredientes || []).map(normalizeIngredient) }
              }
              return normalizeIngredient({ ...entry, _rowId: crypto.randomUUID() })
            })
          })
          const oldId = crypto.randomUUID()
          setMenus([{ id: oldId, nombre: 'Pauta Base', meals: newMeals }])
          setActiveMenuId(oldId)
        }
      }

      showToast('Plan cargado. Calorías recalculadas con datos actuales del paciente.', 'success')
      if (clearPlanCargado) clearPlanCargado()
    }
  }, [planCargado, clearPlanCargado])

  const handleToggleBlock = (key) => {
    setActiveBlocks(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const handleAdd = useCallback((mealKey, newItem) => {
    setMenus(prev => prev.map(m => m.id === activeMenuId ? {
      ...m,
      meals: { ...m.meals, [mealKey]: [...(m.meals[mealKey] || []), newItem] }
    } : m))
  }, [activeMenuId])

  const handleCantidadChange = useCallback((mealKey, rowId, nuevaCantidad) => {
    setMenus(prev => prev.map(m => m.id === activeMenuId ? {
      ...m,
      meals: {
        ...m.meals,
        [mealKey]: (m.meals[mealKey] || []).map(item =>
          item._rowId === rowId ? { ...item, cantidad: nuevaCantidad === '' ? '' : parseFloat(nuevaCantidad) || 0 } : item
        )
      }
    } : m))
  }, [activeMenuId])

  const handleIngredientChange = useCallback((mealKey, recetaRowId, ingRowId, nuevaCantidad) => {
    setMenus(prev => prev.map(m => m.id === activeMenuId ? {
      ...m,
      meals: {
        ...m.meals,
        [mealKey]: (m.meals[mealKey] || []).map(entry => {
          if (entry._rowId !== recetaRowId) return entry
          return {
            ...entry,
            ingredientes: entry.ingredientes.map(ing =>
              ing._rowId === ingRowId ? { ...ing, cantidad: nuevaCantidad === '' ? '' : parseFloat(nuevaCantidad) || 0 } : ing
            )
          }
        })
      }
    } : m))
  }, [activeMenuId])

  const handleRemove = useCallback((mealKey, rowId) => {
    setMenus(prev => prev.map(m => m.id === activeMenuId ? {
      ...m,
      meals: { ...m.meals, [mealKey]: (m.meals[mealKey] || []).filter(item => item._rowId !== rowId) }
    } : m))
  }, [activeMenuId])

  const handleAddMenu = () => {
    const newId = crypto.randomUUID()
    setMenus(prev => [...prev, { id: newId, nombre: `Menú ${prev.length + 1}`, meals: EMPTY_MEALS }])
    setActiveMenuId(newId)
  }

  const handleRenameMenu = (id, currentName) => {
    const newName = window.prompt('Nuevo nombre del menú:', currentName)
    if (newName && newName.trim()) {
      setMenus(prev => prev.map(m => m.id === id ? { ...m, nombre: newName.trim() } : m))
    }
  }

  const handleDuplicateMenu = (id) => {
    const menuToCopy = menus.find(m => m.id === id)
    if (!menuToCopy) return
    const newId = crypto.randomUUID()
    
    // Copia profunda de meals para evitar problemas de referencia
    const newMeals = JSON.parse(JSON.stringify(menuToCopy.meals))
    // Asignar nuevos rowIds a los items
    Object.keys(newMeals).forEach(k => {
      newMeals[k] = newMeals[k].map(item => {
        const newItem = { ...item, _rowId: crypto.randomUUID() }
        if (newItem.tipo === 'receta' && newItem.ingredientes) {
          newItem.ingredientes = newItem.ingredientes.map(ing => ({ ...ing, _rowId: crypto.randomUUID() }))
        }
        return newItem
      })
    })

    setMenus(prev => [...prev, { id: newId, nombre: `${menuToCopy.nombre} (Copia)`, meals: newMeals }])
    setActiveMenuId(newId)
  }

  const handleDeleteMenu = (id) => {
    if (menus.length <= 1) return
    if (window.confirm('¿Seguro que deseas eliminar esta opción de menú?')) {
      const newMenus = menus.filter(m => m.id !== id)
      setMenus(newMenus)
      if (activeMenuId === id) setActiveMenuId(newMenus[0].id)
    }
  }

  const activeMenu = menus.find(m => m.id === activeMenuId) || menus[0]
  const meals = activeMenu.meals

  const openSaveRecetaModal = (mealKey, items, totals) => {
    setRecetaModal({ open: true, mealKey, items, totals })
  }

  const closeRecetaModal = (success) => {
    setRecetaModal({ open: false, mealKey: null, items: [], totals: {} })
    if (success === true) {
      setToastMsg('¡Receta guardada exitosamente!')
      setTimeout(() => setToastMsg(null), 3000)
    }
  }

  const showToast = (msg, type = 'success') => {
    setToastMsg(msg)
    setToastType(type)
    setTimeout(() => setToastMsg(null), 4000)
  }

  const handleGuardar = async () => {
    setSaving(true)
    try {
      // Construir el JSON de requerimientos
      const requerimientos = {
        formula:    calculatorParamsRef.current.formula,
        calorias:   macroTargets.calorias,
        agua_ml:    calculatorParamsRef.current.agua_ml || macroTargets.agua_ml,
        macros_g: {
          proteinas:     macroTargets.proteinas,
          grasas:        macroTargets.grasas,
          carbohidratos: macroTargets.carbohidratos,
        },
      }

      // Construir el JSON del menú (arreglo de menús)
      const menuPayload = menus.map(m => {
        const processedMeals = Object.fromEntries(
          activeBlocks.map(key => [
            key,
            (m.meals[key] || []).map(entry => {
              if (entry.tipo === 'receta') {
                return {
                  tipo:        'receta',
                  receta_id:   entry.receta_id,
                  nombre:      entry.nombre,
                  tipo_comida: entry.tipo_comida,
                  ingredientes: (entry.ingredientes || []).map(ing => ({
                    alimento_id:  ing.alimento_id,
                    nombre:       ing.nombre,
                    cantidad:     parseFloat(ing.cantidad) || 0,
                    porcion_base: ing.porcion_base,
                    calorias:     ing._calorias,
                    proteinas:    ing._proteinas,
                    grasas:       ing._grasas,
                    carbohidratos: ing._carbohidratos,
                    macros:       calcMacros(ing),
                  }))
                }
              }
              return {
                tipo:         'alimento',
                alimento_id:  entry.alimento_id,
                nombre:       entry.nombre,
                cantidad:     parseFloat(entry.cantidad) || 0,
                porcion_base: entry.porcion_base,
                calorias:     entry._calorias,
                proteinas:    entry._proteinas,
                grasas:       entry._grasas,
                carbohidratos: entry._carbohidratos,
                macros:       calcMacros(entry),
              }
            })
          ])
        )
        return {
          id: m.id,
          nombre: m.nombre,
          meals: processedMeals
        }
      })

      const payload = {
        paciente_id:    pacienteId,
        tenant_id:      tenantId,
        bloques_activos: activeBlocks,
        requerimientos,
        menu: menuPayload,
      }

      const { error } = await supabase
        .from('planes_nutricionales')
        .insert(payload)

      if (error) throw error

      setSaved(true)
      setTimeout(() => setSaved(false), 4000)
      showToast('¡Plan Nutricional guardado exitosamente! 🎉', 'success')
    } catch (err) {
      console.error('Error al guardar plan:', err)
      showToast(`Error al guardar: ${err.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const blocksToRender = MEAL_CONFIG_MASTER.filter(c => activeBlocks.includes(c.key))
  const totalItems = activeBlocks.reduce((acc, key) => acc + (meals[key]?.length || 0), 0)

  return (
    <div className="space-y-5 animate-in slide-in-from-bottom-2 fade-in duration-300 pb-12 relative">
      
      {toastMsg && (
        <div className={`fixed bottom-6 right-6 z-50 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-in slide-in-from-bottom-5 ${
          toastType === 'success' ? 'bg-slate-900' : 'bg-red-600'
        }`}>
          {toastType === 'success'
            ? <Check className="w-5 h-5 text-teal-400 flex-shrink-0" />
            : <X className="w-5 h-5 text-red-200 flex-shrink-0" />
          }
          <span className="text-sm font-medium">{toastMsg}</span>
        </div>
      )}

      {/* ── Cabecera con botón guardar ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Armado de Plan</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {totalItems === 0
              ? 'Calcula los requerimientos y agrega alimentos a cada tiempo de comida'
              : `${totalItems} alimento${totalItems > 1 ? 's' : ''} en el plan actual`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-sm text-emerald-600 font-semibold animate-in fade-in duration-200">
              ✓ Plan guardado
            </span>
          )}
          <button
            onClick={() => setSustitutosModalOpen(true)}
            disabled={macroTargets.proteinas === 0 && macroTargets.carbohidratos === 0}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-slate-50 shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Motor de Sustitutos por Macro"
          >
            <RefreshCw className="w-4 h-4 text-violet-600" />
            <span className="hidden sm:inline">Sustitutos</span>
          </button>
          <button
            onClick={() => setComprasModalOpen(true)}
            disabled={totalItems === 0}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-slate-50 shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ShoppingCart className="w-4 h-4 text-indigo-600" />
            <span className="hidden sm:inline">Lista de Compras</span>
          </button>
          <button
            onClick={handleGuardar}
            disabled={saving || totalItems === 0}
            className="flex items-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-teal-700 shadow-sm shadow-teal-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Save className="w-4 h-4" />}
            {saving ? 'Guardando…' : 'Guardar Plan'}
          </button>
        </div>
      </div>

      <CalculatorPanel 
        targets={macroTargets} 
        setTargets={setMacroTargets} 
        pacienteData={pacienteData} 
        onParamsChange={handleCalculatorParams}
        loadedParams={loadedParams}
      />

      <MealDistributionPanel
        targets={macroTargets}
        activeBlocks={activeBlocks}
        distribution={distribution}
        setDistribution={setDistribution}
      />
      
      <BlockConfigPanel activeBlocks={activeBlocks} onToggle={handleToggleBlock} />

      <div className="flex flex-wrap items-center gap-2 mb-4 pb-2">
        {menus.map(menu => {
          const isActive = menu.id === activeMenuId
          return (
            <div 
              key={menu.id} 
              className={`group flex items-center shrink-0 rounded-xl transition-all border shadow-sm cursor-pointer ${
                isActive 
                  ? 'bg-white border-teal-500 border-t-4 text-teal-700 shadow-md' 
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-white hover:border-slate-300'
              }`}
            >
              <div 
                className="px-4 py-2.5 font-bold text-sm"
                onClick={() => setActiveMenuId(menu.id)}
              >
                {menu.nombre}
              </div>
              <div className="pr-2 relative">
                <button 
                  className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${
                    isActive ? 'hover:bg-teal-50 text-teal-600' : 'hover:bg-slate-100 text-slate-400'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    const dropdown = document.getElementById(`dropdown-${menu.id}`)
                    dropdown.classList.toggle('hidden')
                  }}
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {/* Simple Context Menu */}
                <div id={`dropdown-${menu.id}`} className="hidden absolute right-0 top-full mt-1 w-40 bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden z-[100]">
                  <button onClick={() => { document.getElementById(`dropdown-${menu.id}`).classList.add('hidden'); handleRenameMenu(menu.id, menu.nombre) }} className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Edit2 className="w-3.5 h-3.5"/> Renombrar</button>
                  <button onClick={() => { document.getElementById(`dropdown-${menu.id}`).classList.add('hidden'); handleDuplicateMenu(menu.id) }} className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"><Copy className="w-3.5 h-3.5"/> Duplicar</button>
                  <button 
                    onClick={() => { document.getElementById(`dropdown-${menu.id}`).classList.add('hidden'); handleDeleteMenu(menu.id) }} 
                    disabled={menus.length <= 1}
                    className={`w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center gap-2 ${menus.length <= 1 ? 'text-slate-300 cursor-not-allowed' : 'text-red-600 hover:bg-red-50'}`}
                  >
                    <Trash2 className="w-3.5 h-3.5"/> Eliminar
                  </button>
                </div>
              </div>
            </div>
          )
        })}
        <button 
          onClick={handleAddMenu}
          className="flex items-center gap-1.5 px-4 py-2.5 ml-1 text-sm font-bold text-slate-500 hover:text-teal-600 hover:bg-teal-50 border border-transparent rounded-xl transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Añadir Menú
        </button>
      </div>

      <MacrosStickyBar meals={meals} targets={macroTargets} activeBlocks={activeBlocks} />

      <div className="pt-2">
        {blocksToRender.map((config) => (
          <MealCard
            key={config.key}
            config={config}
            items={meals[config.key] || []}
            tenantId={tenantId}
            onAdd={(item) => handleAdd(config.key, item)}
            onCantidadChange={(rowId, val) => handleCantidadChange(config.key, rowId, val)}
            onIngredientChange={(recetaRowId, ingRowId, val) => handleIngredientChange(config.key, recetaRowId, ingRowId, val)}
            onRemove={(rowId) => handleRemove(config.key, rowId)}
            onSaveReceta={openSaveRecetaModal}
          />
        ))}
      </div>

      <GuardarRecetaModal 
        isOpen={recetaModal.open}
        onClose={closeRecetaModal}
        mealKey={recetaModal.mealKey}
        items={recetaModal.items}
        totals={recetaModal.totals}
        tenantId={tenantId}
      />

      <ModalListaCompras 
        isOpen={comprasModalOpen}
        onClose={() => setComprasModalOpen(false)}
        menus={menus}
        activeBlocks={activeBlocks}
      />

      <ModalSustitutos
        isOpen={sustitutosModalOpen}
        onClose={() => setSustitutosModalOpen(false)}
        macroTargets={macroTargets}
        activeBlocks={activeBlocks}
      />
    </div>
  )
}
