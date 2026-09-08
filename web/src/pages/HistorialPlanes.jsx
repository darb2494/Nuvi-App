import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  Loader2, ClipboardList, Flame, Beef, Droplets, Wheat, X, Calendar,
  CopyPlus, Trash2, Bookmark, Package, ShoppingCart
} from 'lucide-react'
import ModalListaCompras from '../components/ModalListaCompras'

// ── Mapeo de bloques a etiquetas legibles ──────────────────────────────────────
const MEAL_LABELS = {
  desayuno:       { label: 'Desayuno',          color: 'bg-amber-100 text-amber-700'     },
  media_manana:   { label: 'Media Mañana',      color: 'bg-orange-100 text-orange-700'   },
  almuerzo:       { label: 'Almuerzo',          color: 'bg-teal-100 text-teal-700'       },
  merienda_1:     { label: 'Merienda Tarde 1',  color: 'bg-emerald-100 text-emerald-700' },
  merienda_2:     { label: 'Merienda Tarde 2',  color: 'bg-emerald-100 text-emerald-700' },
  merienda:       { label: 'Merienda',          color: 'bg-emerald-100 text-emerald-700' },
  cena:           { label: 'Cena',              color: 'bg-indigo-100 text-indigo-700'   },
  merienda_noche: { label: 'Merienda Nocturna', color: 'bg-indigo-100 text-indigo-700'   },
}

const FORMULA_LABELS = {
  mifflin:      'Mifflin-St Jeor',
  harris:       'Harris-Benedict',
  calorimetria: 'Calorimetría Directa',
}

function formatFecha(iso) {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

// ── Recalcula macros de un ingrediente en base a cantidad/porción ──────────────
function calcIngMacros(ing) {
  const ratio = (parseFloat(ing.cantidad) || 0) / (parseFloat(ing.porcion_base) || 100)
  // Acepta tanto formato 'calorias' (Supabase/historial) como '_calorias' (estado local)
  return {
    calorias:      Math.round(((ing._calorias ?? ing.calorias) || 0) * ratio * 10) / 10,
    proteinas:     Math.round(((ing._proteinas ?? ing.proteinas) || 0) * ratio * 10) / 10,
    grasas:        Math.round(((ing._grasas ?? ing.grasas) || 0) * ratio * 10) / 10,
    carbohidratos: Math.round(((ing._carbohidratos ?? ing.carbohidratos) || 0) * ratio * 10) / 10,
  }
}

function sumMacros(list) {
  return list.reduce((acc, m) => ({
    calorias:      acc.calorias      + (m.calorias      || 0),
    proteinas:     acc.proteinas     + (m.proteinas     || 0),
    grasas:        acc.grasas        + (m.grasas        || 0),
    carbohidratos: acc.carbohidratos + (m.carbohidratos || 0),
  }), { calorias: 0, proteinas: 0, grasas: 0, carbohidratos: 0 })
}

// Devuelve los macros de una entrada (receta o alimento suelto) guardada en Supabase
function getMacrosEntry(entry) {
  if (entry.tipo === 'receta') {
    const ings = entry.ingredientes || []
    return sumMacros(ings.map(ing => ing.macros ?? calcIngMacros(ing)))
  }
  // Alimento suelto: usa los macros pre-calculados guardados, o recalcula
  return entry.macros ?? calcIngMacros(entry)
}

// ── Macros en chips ────────────────────────────────────────────────────────────
function MacroChips({ m, size = 'sm' }) {
  const base = size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className={`${base} font-bold bg-orange-100 text-orange-700 rounded`}>
        {Math.round(m.calorias)} kcal
      </span>
      <span className={`${base} font-bold bg-red-50 text-red-600 rounded`}>
        {Math.round(m.proteinas)}P
      </span>
      <span className={`${base} font-bold bg-amber-50 text-amber-600 rounded`}>
        {Math.round(m.grasas)}G
      </span>
      <span className={`${base} font-bold bg-lime-50 text-lime-700 rounded`}>
        {Math.round(m.carbohidratos)}C
      </span>
    </div>
  )
}

// ── Modal de Detalle de Plan (Lectura Jerárquica) ──────────────────────────────
function DetalleModal({ plan, onClose }) {
  const [comprasOpen, setComprasOpen] = useState(false)
  if (!plan) return null
  const menu = plan.menu || {}
  const req  = plan.requerimientos || {}
  const activeBlocks = plan.bloques_activos || Object.keys(menu)

  // Calcula el total real del menú sumando todas las entradas de todos los bloques activos
  const totalMenu = sumMacros(
    (plan.bloques_activos || Object.keys(menu)).flatMap(bloque =>
      (menu[bloque] || []).map(getMacrosEntry)
    )
  )

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 pb-6 px-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-teal-600" />
              Plan del {formatFecha(plan.fecha_creacion)}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Fórmula: <span className="font-semibold">{FORMULA_LABELS[req.formula] || req.formula || '—'}</span>
              {' · '}Objetivo: <span className="font-semibold text-indigo-600">{req.calorias} kcal</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setComprasOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              title="Lista de compras"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Lista de Compras
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Resumen de requerimientos vs. real del menú */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-4 relative">
            {/* Objetivo */}
            <div className="space-y-2 relative">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Objetivo Calculado</p>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { label: 'Calorías', value: req.calorias,              unit: 'kcal' },
                  { label: 'Prot',     value: req.macros_g?.proteinas,   unit: 'g'    },
                  { label: 'Grasas',   value: req.macros_g?.grasas,      unit: 'g'    },
                  { label: 'Carbos',   value: req.macros_g?.carbohidratos, unit: 'g'  },
                  { label: 'Agua',     value: req.agua_ml ? (req.agua_ml / 1000).toFixed(1) : 0, unit: 'L' },
                ].map(({ label, value, unit }) => (
                  <div key={label} className="flex flex-col items-center p-2 rounded-xl bg-slate-100/50 border border-dashed border-slate-300">
                    <p className="text-[10px] font-semibold text-slate-400">{label}</p>
                    <p className="text-sm font-bold text-slate-500 leading-none mt-1">{value}</p>
                    <p className="text-[9px] text-slate-400">{unit}</p>
                  </div>
                ))}
              </div>
              {/* Divisor vertical (solo visible en pantallas grandes) */}
              <div className="hidden sm:block absolute -right-2 top-0 bottom-0 w-px bg-slate-200" />
            </div>
            {/* Real del menú */}
            <div className="space-y-2 sm:pl-4">
              <p className="text-[10px] font-bold text-slate-900 uppercase tracking-wider">Total Real del Menú</p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Calorías', value: totalMenu.calorias,      unit: 'kcal', icon: Flame,    color: 'bg-orange-50 text-orange-700 border-orange-100' },
                  { label: 'Prot',     value: totalMenu.proteinas,     unit: 'g',    icon: Beef,     color: 'bg-red-50 text-red-700 border-red-100'       },
                  { label: 'Grasas',   value: totalMenu.grasas,        unit: 'g',    icon: Droplets, color: 'bg-amber-50 text-amber-700 border-amber-100'   },
                  { label: 'Carbos',   value: totalMenu.carbohidratos, unit: 'g',    icon: Wheat,    color: 'bg-lime-50 text-lime-700 border-lime-100'     },
                ].map(({ label, value, unit, icon: Icon, color }) => (
                  <div key={label} className={`flex flex-col items-center p-2 rounded-xl border shadow-sm ${color}`}>
                    <Icon className="w-3.5 h-3.5 mb-0.5 opacity-80" />
                    <p className="text-[10px] font-bold opacity-80">{label}</p>
                    <p className="text-sm font-black leading-none mt-0.5">{Math.round(value ?? 0)}</p>
                    <p className="text-[9px] font-semibold opacity-70">{unit}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bloques del menú — renderizado jerárquico */}
        <div className="p-6 space-y-5">
          {(plan.bloques_activos || Object.keys(menu)).map((bloque) => {
            const entries = menu[bloque] || []
            const meta = MEAL_LABELS[bloque] || { label: bloque, color: 'bg-slate-100 text-slate-600' }
            const bloqueTotal = sumMacros(entries.map(getMacrosEntry))

            return (
              <div key={bloque} className="border border-slate-200 rounded-xl overflow-hidden">
                {/* Cabecera del bloque */}
                <div className="flex items-center px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${meta.color}`}>
                    {meta.label}
                  </span>
                </div>

                {entries.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-slate-400 italic">Sin entradas registradas.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {entries.map((entry, idx) => {
                      const entryMacros = getMacrosEntry(entry)
                      const isReceta = entry.tipo === 'receta'

                      return (
                        <div key={idx} className={isReceta ? 'bg-indigo-50/30' : ''}>
                          {/* Fila principal: Receta o Alimento suelto */}
                          <div className={`flex items-center justify-between px-4 py-2.5 ${isReceta ? 'border-b border-indigo-100/60' : ''}`}>
                            <div className="flex items-center gap-2 min-w-0">
                              {isReceta ? (
                                <div className="bg-indigo-100 text-indigo-600 p-1 rounded flex-shrink-0">
                                  <Bookmark className="w-3 h-3" />
                                </div>
                              ) : (
                                <div className="bg-slate-100 text-slate-500 p-1 rounded flex-shrink-0">
                                  <Package className="w-3 h-3" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className={`text-sm font-bold truncate ${isReceta ? 'text-indigo-900' : 'text-slate-800'}`}>
                                  {entry.nombre}
                                </p>
                                {!isReceta && entry.cantidad && (
                                  <p className="text-[10px] text-slate-400">{entry.cantidad}g</p>
                                )}
                              </div>
                            </div>
                            <MacroChips m={entryMacros} size="xs" />
                          </div>

                          {/* Sub-lista de ingredientes (solo para recetas) */}
                          {isReceta && (entry.ingredientes || []).length > 0 && (
                            <table className="w-full text-xs border-collapse">
                              <tbody>
                                {(entry.ingredientes || []).map((ing, iIdx) => {
                                  const ingM = ing.macros ?? calcIngMacros(ing)
                                  return (
                                    <tr key={iIdx} className="hover:bg-indigo-50/50 border-b border-indigo-50 last:border-0">
                                      <td className="pl-10 pr-3 py-1.5 text-slate-600 font-medium max-w-[180px]">
                                        <span className="truncate block" title={ing.nombre}>↳ {ing.nombre}</span>
                                      </td>
                                      <td className="px-3 py-1.5 text-slate-400 whitespace-nowrap">
                                        {ing.cantidad}g
                                      </td>
                                      <td className="px-2 py-1.5 text-orange-600 font-bold text-right whitespace-nowrap">
                                        {Math.round(ingM.calorias)} kcal
                                      </td>
                                      <td className="px-2 py-1.5 text-red-600 font-bold text-right whitespace-nowrap">
                                        {Math.round(ingM.proteinas)}g P
                                      </td>
                                      <td className="px-2 py-1.5 text-amber-600 font-bold text-right whitespace-nowrap">
                                        {Math.round(ingM.grasas)}g G
                                      </td>
                                      <td className="pr-4 py-1.5 text-lime-700 font-bold text-right whitespace-nowrap">
                                        {Math.round(ingM.carbohidratos)}g C
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

      </div>

      <ModalListaCompras
        isOpen={comprasOpen}
        onClose={() => setComprasOpen(false)}
        meals={menu}
        activeBlocks={activeBlocks}
      />
    </div>
  )
}

// ── Componente Principal: HistorialPlanes ─────────────────────────────────────
export default function HistorialPlanes({ pacienteId, onCargarPlan }) {
  const [planes, setPlanes]           = useState([])
  const [loading, setLoading]         = useState(true)
  const [planDetalle, setPlanDetalle] = useState(null)
  const [deletingId, setDeletingId]   = useState(null)

  useEffect(() => {
    if (!pacienteId) return
    const fetchPlanes = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('planes_nutricionales')
          .select('id, fecha_creacion, bloques_activos, requerimientos, menu')
          .eq('paciente_id', pacienteId)
          .order('fecha_creacion', { ascending: false })
        if (error) throw error
        setPlanes(data || [])
      } catch (err) {
        console.error('Error al cargar historial:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchPlanes()
  }, [pacienteId])

  const handleEliminar = async (plan) => {
    const ok = window.confirm(
      `¿Eliminar el plan del ${formatFecha(plan.fecha_creacion)}?\nEsta acción no se puede deshacer.`
    )
    if (!ok) return
    setDeletingId(plan.id)
    try {
      const { error } = await supabase
        .from('planes_nutricionales')
        .delete()
        .eq('id', plan.id)
      if (error) throw error
      setPlanes(prev => prev.filter(p => p.id !== plan.id))
      if (planDetalle?.id === plan.id) setPlanDetalle(null)
    } catch (err) {
      console.error('Error al eliminar plan:', err)
      alert(`Error al eliminar: ${err.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    )
  }

  if (planes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-300">
          <ClipboardList className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Sin planes registrados</h3>
        <p className="text-sm text-slate-500 max-w-xs">
          Aún no se ha guardado ningún plan nutricional para este paciente. Ve a la pestaña "Plan Nutricional" para crear uno.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-in slide-in-from-bottom-2 fade-in duration-300 pb-10">

      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Historial de Planes</h2>
          <p className="text-sm text-slate-500">{planes.length} plan{planes.length > 1 ? 'es' : ''} guardado{planes.length > 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200" />

        <div className="space-y-4">
          {planes.map((plan, idx) => {
            const req    = plan.requerimientos || {}
            const bloques = plan.bloques_activos || Object.keys(plan.menu || {})
            const isDeleting = deletingId === plan.id

            return (
              <div key={plan.id} className="relative flex gap-4 pl-12">
                {/* Dot */}
                <div className={`absolute left-3.5 top-5 w-3 h-3 rounded-full border-2 border-white shadow-sm ${idx === 0 ? 'bg-teal-500' : 'bg-slate-300'}`} />

                {/* Tarjeta */}
                <div className={`flex-1 bg-white rounded-2xl border shadow-sm overflow-hidden transition-shadow hover:shadow-md ${idx === 0 ? 'border-teal-200' : 'border-slate-200'} ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}>

                  {/* Cabecera */}
                  <div className={`flex items-center justify-between px-5 py-3 ${idx === 0 ? 'bg-teal-50/60' : 'bg-slate-50/60'}`}>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span className="font-semibold text-slate-800">{formatFecha(plan.fecha_creacion)}</span>
                      {idx === 0 && (
                        <span className="text-[10px] font-bold bg-teal-600 text-white px-2 py-0.5 rounded-full">ÚLTIMO</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400 font-medium">
                        {FORMULA_LABELS[req.formula] || req.formula || '—'}
                      </span>
                      {/* Botón Eliminar */}
                      <button
                        onClick={() => handleEliminar(plan)}
                        disabled={isDeleting}
                        title="Eliminar plan"
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        {isDeleting
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />
                        }
                      </button>
                    </div>
                  </div>

                  {/* Macros del objetivo */}
                  <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { label: 'kcal',   value: req.calorias,                icon: Flame,    color: 'text-orange-600' },
                        { label: 'Prot',   value: req.macros_g?.proteinas,     icon: Beef,     color: 'text-red-600'    },
                        { label: 'Grasas', value: req.macros_g?.grasas,        icon: Droplets, color: 'text-amber-600'  },
                        { label: 'Carbos', value: req.macros_g?.carbohidratos, icon: Wheat,    color: 'text-lime-700'   },
                      ].map(({ label, value, icon: Icon, color }) => (
                        <div key={label} className="flex flex-col items-center">
                          <Icon className={`w-4 h-4 mb-0.5 ${color}`} />
                          <p className={`text-base font-black leading-none ${color}`}>{Math.round(value ?? 0)}</p>
                          <p className="text-[10px] text-slate-400 font-semibold">{label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Chips de bloques activos + botones de acción */}
                    <div className="flex flex-col sm:items-end gap-2">
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        {bloques.map(b => {
                          const meta = MEAL_LABELS[b]
                          if (!meta) return null
                          return (
                            <span key={b} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.color}`}>
                              {meta.label}
                            </span>
                          )
                        })}
                      </div>

                      <div className="flex gap-2">
                        {/* Ver Menú */}
                        <button
                          onClick={() => setPlanDetalle(plan)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                        >
                          <ClipboardList className="w-3.5 h-3.5" />
                          Ver Menú
                        </button>
                        {/* Cargar como base */}
                        <button
                          onClick={() => onCargarPlan?.(plan)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          <CopyPlus className="w-3.5 h-3.5" />
                          Usar como base
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal de Detalle */}
      {planDetalle && (
        <DetalleModal plan={planDetalle} onClose={() => setPlanDetalle(null)} />
      )}
    </div>
  )
}
