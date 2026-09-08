import { useState, useMemo, useEffect } from 'react'
import { X, RefreshCw, Check, ClipboardCopy, Plus, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'

// ── Base de datos por defecto ────────────────────────────────────────────────
const ALIMENTOS_DEFAULT = {
  proteinas: [
    { id: 'p1', nombre: 'Pechuga de pollo',           emoji: '🍗', aporte: 23,  unidad: 'g'      },
    { id: 'p2', nombre: 'Carne de res magra',          emoji: '🥩', aporte: 26,  unidad: 'g'      },
    { id: 'p3', nombre: 'Atún en agua',                emoji: '🐟', aporte: 25,  unidad: 'g'      },
    { id: 'p4', nombre: 'Salmón',                      emoji: '🐠', aporte: 20,  unidad: 'g'      },
    { id: 'p5', nombre: 'Huevo entero',                emoji: '🥚', aporte: 6,   unidad: 'unidad' },
    { id: 'p6', nombre: 'Claras de huevo',             emoji: '🥚', aporte: 3.6, unidad: 'unidad' },
    { id: 'p7', nombre: 'Queso blanco bajo en grasa',  emoji: '🧀', aporte: 14,  unidad: 'g'      },
    { id: 'p8', nombre: 'Yogurt griego natural',       emoji: '🥛', aporte: 10,  unidad: 'g'      },
    { id: 'p9', nombre: 'Sardinas en agua',            emoji: '🐟', aporte: 21,  unidad: 'g'      },
  ],
  carbohidratos: [
    { id: 'c1', nombre: 'Arroz cocido',                emoji: '🍚', aporte: 28, unidad: 'g' },
    { id: 'c2', nombre: 'Pasta cocida',                emoji: '🍝', aporte: 25, unidad: 'g' },
    { id: 'c3', nombre: 'Avena en hojuelas',           emoji: '🌾', aporte: 60, unidad: 'g' },
    { id: 'c4', nombre: 'Papa hervida',                emoji: '🥔', aporte: 20, unidad: 'g' },
    { id: 'c5', nombre: 'Harina PAN / Arepa',          emoji: '🫓', aporte: 80, unidad: 'g' },
    { id: 'c6', nombre: 'Plátano maduro',              emoji: '🍌', aporte: 32, unidad: 'g' },
    { id: 'c7', nombre: 'Pan integral de molde',       emoji: '🍞', aporte: 42, unidad: 'g' },
    { id: 'c8', nombre: 'Yuca hervida',                emoji: '🌿', aporte: 38, unidad: 'g' },
    { id: 'c9', nombre: 'Batata / Camote',             emoji: '🍠', aporte: 20, unidad: 'g' },
  ],
  grasas: [
    { id: 'g1', nombre: 'Aguacate',                    emoji: '🥑', aporte: 15,  unidad: 'g' },
    { id: 'g2', nombre: 'Aceite de oliva',             emoji: '🫒', aporte: 100, unidad: 'g' },
    { id: 'g3', nombre: 'Almendras',                   emoji: '🌰', aporte: 50,  unidad: 'g' },
    { id: 'g4', nombre: 'Maníes / Cacahuates',        emoji: '🥜', aporte: 48,  unidad: 'g' },
    { id: 'g5', nombre: 'Mantequilla de maní',         emoji: '🥜', aporte: 50,  unidad: 'g' },
    { id: 'g6', nombre: 'Semillas de chía',            emoji: '🌱', aporte: 31,  unidad: 'g' },
    { id: 'g7', nombre: 'Aceite de coco',              emoji: '🥥', aporte: 100, unidad: 'g' },
  ],
}

const CATEGORIAS = [
  { key: 'proteinas',     label: 'Proteínas'     },
  { key: 'carbohidratos', label: 'Carbohidratos' },
  { key: 'grasas',        label: 'Grasas'        },
]

const META_MACRO = {
  proteinas:     { label: 'Proteínas',     emoji: '🥩', bg: 'bg-red-50',    border: 'border-red-200',    badge: 'bg-red-100 text-red-700',    heading: 'text-red-700'   },
  carbohidratos: { label: 'Carbohidratos', emoji: '🍚', bg: 'bg-amber-50',  border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-700', heading: 'text-amber-700' },
  grasas:        { label: 'Grasas',        emoji: '🥑', bg: 'bg-teal-50',   border: 'border-teal-200',   badge: 'bg-teal-100 text-teal-700',   heading: 'text-teal-700'  },
}

const STORAGE_KEY = 'nuvi_sustitutos_base'

// ── Helpers puros (fuera del componente) ─────────────────────────────────────
function cargarDesdeStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return ALIMENTOS_DEFAULT
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Array.isArray(parsed.proteinas)) {
      return {
        proteinas:     Array.isArray(parsed.proteinas)     ? parsed.proteinas     : ALIMENTOS_DEFAULT.proteinas,
        carbohidratos: Array.isArray(parsed.carbohidratos) ? parsed.carbohidratos : ALIMENTOS_DEFAULT.carbohidratos,
        grasas:        Array.isArray(parsed.grasas)        ? parsed.grasas        : ALIMENTOS_DEFAULT.grasas,
      }
    }
    return ALIMENTOS_DEFAULT
  } catch {
    return ALIMENTOS_DEFAULT
  }
}

function calcSustituto(alimento, macroObjetivo) {
  const meta = typeof macroObjetivo === 'number' && !isNaN(macroObjetivo) ? macroObjetivo : 0
  const aporte = parseFloat(alimento?.aporte)
  if (meta <= 0 || isNaN(aporte) || aporte <= 0) return { cantidad: '--', unidad: '' }

  if (alimento?.unidad === 'unidad') {
    const n = Math.round((meta / aporte) * 10) / 10
    return { cantidad: String(n), unidad: n === 1 ? 'unidad' : 'unidades' }
  }
  return { cantidad: String(Math.round((meta * 100) / aporte)), unidad: 'g' }
}

// ── Componente principal ──────────────────────────────────────────────────────
// CRITICAL: ALL hooks must be called unconditionally at the top level.
// The early return for !isOpen is moved to AFTER all hooks.
export default function ModalSustitutos({ isOpen, onClose, macroTargets = {}, activeBlocks = [] }) {

  // ── TODOS LOS HOOKS PRIMERO — antes de cualquier return condicional ──────────
  const [baseAlimentos, setBaseAlimentos] = useState(() => cargarDesdeStorage())
  const [seleccionados, setSeleccionados] = useState([])
  const [selectedMeal, setSelectedMeal]   = useState('desayuno')
  const [gestionOpen, setGestionOpen]     = useState(false)
  const [form, setForm]                   = useState({ nombre: '', aporte: '', unidad: 'g', categoria: 'proteinas' })
  const [formError, setFormError]         = useState('')
  const [copiado, setCopiado]             = useState(false)

  // Persistir en localStorage — hook incondicional
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(baseAlimentos)) } catch {}
  }, [baseAlimentos])

  // Cálculos derivados — también deben ser hooks incondicionales
  const distribucion = useMemo(() => {
    const safeBlocks = Array.isArray(activeBlocks) && activeBlocks.length > 0
      ? activeBlocks
      : ['desayuno', 'almuerzo', 'cena']

    const mapa = {
      desayuno:       { label: 'Desayuno',          pct: 25 },
      media_manana:   { label: 'Media Mañana',      pct: 10 },
      almuerzo:       { label: 'Almuerzo',          pct: 35 },
      merienda_1:     { label: 'Merienda Tarde 1',  pct: 10 },
      merienda_2:     { label: 'Merienda Tarde 2',  pct: 5  },
      cena:           { label: 'Cena',              pct: 20 },
      merienda_noche: { label: 'Merienda Nocturna', pct: 5  },
    }
    const activos = safeBlocks.map(k => ({ key: k, ...(mapa[k] || { label: k, pct: 0 }) })).filter(b => b.label)
    if (activos.length === 0) return {}
    const totalPct = activos.reduce((s, b) => s + (b.pct || 0), 0)
    return activos.reduce((acc, b) => {
      acc[b.key] = {
        key:   b.key,
        label: b.label,
        pct:   totalPct > 0 ? Math.round((b.pct / totalPct) * 100) : Math.round(100 / activos.length),
      }
      return acc
    }, {})
  }, [activeBlocks])

  // ── AHORA sí podemos hacer el early return ─────────────────────────────────
  if (!isOpen) return null

  // ── Macros seguros (nunca NaN) ────────────────────────────────────────────
  const totalProteinas     = Number(macroTargets?.proteinas)     || 0
  const totalGrasas        = Number(macroTargets?.grasas)        || 0
  const totalCarbohidratos = Number(macroTargets?.carbohidratos) || 0

  const pctBloque = (distribucion[selectedMeal]?.pct || 0) / 100
  const objetivos = {
    proteinas:     Math.round(totalProteinas     * pctBloque * 10) / 10,
    carbohidratos: Math.round(totalCarbohidratos * pctBloque * 10) / 10,
    grasas:        Math.round(totalGrasas        * pctBloque * 10) / 10,
  }

  const mealOptions = Object.entries(distribucion)
  const totalSeleccionados = seleccionados.length

  // ── Handlers ─────────────────────────────────────────────────────────────
  const toggleSeleccion = (id) => {
    if (!id) return
    setSeleccionados(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  const toggleTodoGrupo = (macroKey) => {
    const items = baseAlimentos?.[macroKey] || []
    const ids = items.map(a => a?.id).filter(Boolean)
    if (ids.length === 0) return
    const todosSeleccionados = ids.every(id => seleccionados.includes(id))
    setSeleccionados(prev =>
      todosSeleccionados
        ? prev.filter(id => !ids.includes(id))
        : [...new Set([...prev, ...ids])]
    )
  }

  const handleAddAlimento = () => {
    setFormError('')
    if (!form.nombre.trim()) { setFormError('El nombre es obligatorio.'); return }
    const aporte = parseFloat(form.aporte)
    if (isNaN(aporte) || aporte <= 0) { setFormError('El aporte debe ser un número positivo.'); return }

    const nuevoAlimento = {
      id:     `custom_${Date.now()}`,
      nombre: form.nombre.trim(),
      emoji:  '⭐',
      aporte,
      unidad: form.unidad,
    }
    setBaseAlimentos(prev => ({
      ...prev,
      [form.categoria]: [...(prev[form.categoria] || []), nuevoAlimento],
    }))
    setForm({ nombre: '', aporte: '', unidad: 'g', categoria: 'proteinas' })
    setGestionOpen(false)
  }

  const handleRemoveAlimento = (macroKey, id) => {
    setBaseAlimentos(prev => ({
      ...prev,
      [macroKey]: (prev[macroKey] || []).filter(a => a?.id !== id),
    }))
    setSeleccionados(prev => prev.filter(s => s !== id))
  }

  const handleCopiar = () => {
    const mealLabel = distribucion[selectedMeal]?.label || String(selectedMeal)
    const mealPct   = String(distribucion[selectedMeal]?.pct || 0)
    let texto = `\uD83D\uDD04 *Opciones de Sustitutos para ${mealLabel}*\n`
    texto += `_(${mealPct}% del plan diario)_\n\n`

    for (const [macroKey, meta] of Object.entries(META_MACRO)) {
      const itemsGrupo = (baseAlimentos?.[macroKey] || []).filter(a => a?.id && seleccionados.includes(a.id))
      if (itemsGrupo.length === 0) continue
      const metaGramos = String(objetivos[macroKey] || 0)
      texto += `${meta.emoji} *${meta.label} (Meta: ${metaGramos}g):*\n`
      itemsGrupo.forEach(a => {
        const { cantidad, unidad } = calcSustituto(a, objetivos[macroKey])
        texto += `  \u2022 ${a.nombre}: ${cantidad} ${unidad}\n`
      })
      texto += '\n'
    }

    if (seleccionados.length === 0) {
      texto += '_(Selecciona alimentos con el checkbox para exportar.)_'
    }

    navigator.clipboard.writeText(texto)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-violet-100 p-2 rounded-lg text-violet-600">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Motor de Sustitutos por Macro</h2>
              <p className="text-sm text-slate-500">Selecciona alimentos con ✓ y exporta solo los que necesitas.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selector de comida + banner */}
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <label className="text-sm font-semibold text-slate-700 shrink-0">Tiempo de Comida:</label>
            <select
              value={selectedMeal}
              onChange={e => setSelectedMeal(e.target.value)}
              className="max-w-xs px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 cursor-pointer"
            >
              {mealOptions.map(([key, info]) => (
                <option key={key} value={key}>
                  {String(info.label)} — {String(info.pct)}%
                </option>
              ))}
            </select>

            {totalProteinas > 0 || totalCarbohidratos > 0 ? (
              <div className="flex flex-wrap items-center gap-2 ml-auto">
                <span className="text-xs font-bold text-slate-400 uppercase">Meta bloque:</span>
                <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">🥩 {String(objetivos.proteinas)}g</span>
                <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">🍚 {String(objetivos.carbohidratos)}g</span>
                <span className="px-2.5 py-1 bg-teal-100 text-teal-700 rounded-full text-xs font-bold">🥑 {String(objetivos.grasas)}g</span>
              </div>
            ) : (
              <span className="ml-auto px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold rounded-lg">
                ⚠️ Calcula los requerimientos primero
              </span>
            )}
          </div>
        </div>

        {/* Acordeón: Gestión de Alimentos */}
        <div className="px-6 pt-3 pb-0 shrink-0">
          <button
            type="button"
            onClick={() => setGestionOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-xl transition-colors cursor-pointer"
          >
            <span className="text-sm font-semibold text-violet-700 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Gestión de Alimentos — Añadir nuevo a la base
            </span>
            {gestionOpen ? <ChevronUp className="w-4 h-4 text-violet-500" /> : <ChevronDown className="w-4 h-4 text-violet-500" />}
          </button>

          {gestionOpen && (
            <div className="mt-2 mb-3 p-4 bg-violet-50/60 border border-violet-200 rounded-xl space-y-3 animate-in slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre *</label>
                  <input
                    type="text"
                    placeholder="Ej. Pavo molido"
                    value={form.nombre}
                    onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Aporte (macro g) *</label>
                  <input
                    type="number"
                    placeholder="Ej. 22"
                    min="0.1"
                    step="0.1"
                    value={form.aporte}
                    onChange={e => setForm(f => ({ ...f, aporte: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Unidad de medida</label>
                  <select
                    value={form.unidad}
                    onChange={e => setForm(f => ({ ...f, unidad: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-violet-500 bg-white cursor-pointer"
                  >
                    <option value="g">Por cada 100g</option>
                    <option value="unidad">Por unidad</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Categoría</label>
                  <select
                    value={form.categoria}
                    onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-violet-500 bg-white cursor-pointer"
                  >
                    {CATEGORIAS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              {formError && <p className="text-xs text-red-600 font-medium">{formError}</p>}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleAddAlimento}
                  className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Añadir a la base
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Cuerpo — 3 columnas */}
        <div className="flex-1 overflow-y-auto px-6 pt-3 pb-6 bg-slate-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {Object.entries(META_MACRO).map(([macroKey, meta]) => {
              const items      = baseAlimentos?.[macroKey] || []
              const idsGrupo   = items.map(a => a?.id).filter(Boolean)
              const todosMarca = idsGrupo.length > 0 && idsGrupo.every(id => seleccionados.includes(id))

              return (
                <div key={macroKey} className={`rounded-xl border ${meta.border} overflow-hidden shadow-sm`}>

                  {/* Cabecera columna */}
                  <div className={`${meta.bg} px-4 py-3 border-b ${meta.border}`}>
                    <div className="flex items-center justify-between">
                      <h3 className={`font-bold text-sm uppercase tracking-wide ${meta.heading}`}>
                        {meta.emoji} {meta.label}
                      </h3>
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={todosMarca}
                          onChange={() => toggleTodoGrupo(macroKey)}
                          className="w-3.5 h-3.5 cursor-pointer"
                        />
                        Todos
                      </label>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Meta bloque: <span className="font-bold">{String(objetivos[macroKey] ?? '--')}g</span>
                    </p>
                  </div>

                  {/* Filas */}
                  <div className="bg-white divide-y divide-slate-100">
                    {items.length === 0 && (
                      <p className="px-4 py-4 text-xs text-slate-400 text-center">Sin alimentos. Añade uno arriba.</p>
                    )}
                    {items.map(alimento => {
                      if (!alimento?.id) return null
                      const { cantidad, unidad } = calcSustituto(alimento, objetivos[macroKey])
                      const checked  = seleccionados.includes(alimento.id)
                      const esCustom = String(alimento.id).startsWith('custom_')

                      return (
                        <div
                          key={alimento.id}
                          onClick={() => toggleSeleccion(alimento.id)}
                          className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-colors ${checked ? meta.bg : 'hover:bg-slate-50'}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSeleccion(alimento.id)}
                            onClick={e => e.stopPropagation()}
                            className="w-4 h-4 shrink-0 cursor-pointer rounded"
                          />
                          <span className="text-sm text-slate-700 flex-1 flex items-center gap-1 min-w-0">
                            <span className="shrink-0">{alimento.emoji}</span>
                            <span className="truncate leading-tight">{String(alimento.nombre)}</span>
                            {esCustom && (
                              <span className="text-[9px] bg-violet-100 text-violet-600 px-1 py-0.5 rounded font-bold ml-1 shrink-0">
                                CUSTOM
                              </span>
                            )}
                          </span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${checked ? meta.badge : 'bg-slate-100 text-slate-500'}`}>
                            {cantidad !== '--' ? `${cantidad} ${unidad}` : '--'}
                          </span>
                          {esCustom && (
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); handleRemoveAlimento(macroKey, alimento.id) }}
                              className="shrink-0 p-1 text-slate-300 hover:text-red-500 transition-colors"
                              title="Eliminar alimento"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          <p className="mt-4 text-xs text-slate-400 text-center">
            * Las cantidades cubren el 100% del macro del bloque con ese único alimento. Combínalos para una comida balanceada.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between gap-3 shrink-0">
          <p className="text-sm text-slate-500">
            {totalSeleccionados > 0
              ? <span className="font-semibold text-violet-700">{totalSeleccionados} seleccionado{totalSeleccionados > 1 ? 's' : ''}</span>
              : <span className="text-slate-400">Marca los checkboxes para exportar.</span>
            }
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleCopiar}
              disabled={totalSeleccionados === 0}
              className="flex items-center gap-2 bg-violet-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-violet-700 shadow-sm shadow-violet-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {copiado ? <Check className="w-4 h-4" /> : <ClipboardCopy className="w-4 h-4" />}
              {copiado ? '¡Copiado!' : 'Copiar Sustitutos'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
