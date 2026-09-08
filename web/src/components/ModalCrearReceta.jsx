import { useState, useEffect, useRef } from 'react'
import { X, Search, Loader2, Trash2, Bookmark, Flame, Beef, Droplets, Wheat } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

// ── Cálculo de macros de un alimento ajustado por cantidad ──────────────────────
function calcMacros(item) {
  const ratio = (parseFloat(item.cantidad) || 0) / (parseFloat(item.porcion_base) || 100)
  return {
    calorias:      Math.round((item.calorias || 0) * ratio * 10) / 10,
    proteinas:     Math.round((item.proteinas || 0) * ratio * 10) / 10,
    grasas:        Math.round((item.grasas || 0) * ratio * 10) / 10,
    carbohidratos: Math.round((item.carbohidratos || 0) * ratio * 10) / 10,
  }
}

// ── Suma los macros totales de los ingredientes ────────────────────────────────
function calcRecipeTotals(ingredientes) {
  return ingredientes.reduce((acc, ing) => {
    const m = calcMacros(ing)
    return {
      calorias:      acc.calorias + m.calorias,
      proteinas:     acc.proteinas + m.proteinas,
      grasas:        acc.grasas + m.grasas,
      carbohidratos: acc.carbohidratos + m.carbohidratos,
    }
  }, { calorias: 0, proteinas: 0, grasas: 0, carbohidratos: 0 })
}

export default function ModalCrearReceta({ isOpen, onClose, onSuccess, tenantId }) {
  const [nombre, setNombre] = useState('')
  const [tipoComida, setTipoComida] = useState('desayuno')
  const [ingredientes, setIngredientes] = useState([])
  
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  
  const searchTimeoutRef = useRef(null)
  const searchContainerRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setNombre('')
      setTipoComida('desayuno')
      setIngredientes([])
      setQuery('')
      setResults([])
      setError(null)
    }
  }, [isOpen])

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!isOpen) return null

  const handleSearch = (val) => {
    setQuery(val)
    clearTimeout(searchTimeoutRef.current)
    
    if (!val.trim()) {
      setResults([])
      setShowDropdown(false)
      return
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true)
      const { data } = await supabase
        .from('alimentos')
        .select('id, nombre, porcion_base, calorias, proteinas, grasas, carbohidratos')
        .ilike('nombre', `%${val.trim()}%`)
        .limit(8)
      
      setResults(data || [])
      setShowDropdown(true)
      setIsSearching(false)
    }, 300)
  }

  const handleAddIngredient = (item) => {
    // Normalizamos el ingrediente para que coincida con la estructura del plan
    const newIng = {
      _rowId: crypto.randomUUID(),
      alimento_id: item.id,
      nombre: item.nombre,
      cantidad: item.porcion_base || 100, // Empieza con la porción base
      porcion_base: item.porcion_base || 100,
      calorias: item.calorias || 0,
      proteinas: item.proteinas || 0,
      grasas: item.grasas || 0,
      carbohidratos: item.carbohidratos || 0,
    }
    setIngredientes(prev => [...prev, newIng])
    setQuery('')
    setShowDropdown(false)
    setResults([])
  }

  const handleCantidadChange = (rowId, newCantidad) => {
    setIngredientes(prev => prev.map(ing => 
      ing._rowId === rowId 
        ? { ...ing, cantidad: newCantidad === '' ? '' : parseFloat(newCantidad) || 0 }
        : ing
    ))
  }

  const handleRemoveIngredient = (rowId) => {
    setIngredientes(prev => prev.filter(ing => ing._rowId !== rowId))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!nombre.trim() || ingredientes.length === 0) return

    setSaving(true)
    setError(null)

    try {
      const totals = calcRecipeTotals(ingredientes)
      
      // Limpiamos los campos temporales antes de guardar
      const cleanIngredientes = ingredientes.map(ing => {
        const { _rowId, ...rest } = ing
        return rest
      })

      const payload = {
        nombre: nombre.trim(),
        tipo_comida: tipoComida,
        ingredientes: cleanIngredientes,
        calorias: totals.calorias,
        proteinas: totals.proteinas,
        grasas: totals.grasas,
        carbohidratos: totals.carbohidratos,
        tenant_id: tenantId
      }

      const { error: dbError } = await supabase.from('recetas').insert(payload)
      if (dbError) throw dbError
      
      onSuccess()
    } catch (err) {
      console.error(err)
      setError(err.message || 'Error al guardar la receta')
    } finally {
      setSaving(false)
    }
  }

  const totals = calcRecipeTotals(ingredientes)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Nueva Receta</h2>
              <p className="text-xs text-slate-500">Crea una plantilla reutilizable de alimentos</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre de la Receta</label>
              <input
                type="text"
                autoFocus
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Avena con frutas"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Tipo de Comida</label>
              <select
                value={tipoComida}
                onChange={(e) => setTipoComida(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
              >
                <option value="desayuno">Desayuno</option>
                <option value="media_manana">Media Mañana</option>
                <option value="almuerzo">Almuerzo</option>
                <option value="merienda_1">Merienda Tarde 1</option>
                <option value="merienda_2">Merienda Tarde 2</option>
                <option value="cena">Cena</option>
                <option value="merienda_noche">Merienda Nocturna</option>
              </select>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Ingredientes</label>
            
            {/* Buscador */}
            <div ref={searchContainerRef} className="relative mb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                  onFocus={() => { if(results.length > 0) setShowDropdown(true) }}
                  placeholder="Buscar alimento para agregar…"
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50 transition-all"
                />
                {isSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                  </div>
                )}
              </div>

              {showDropdown && results.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                  {results.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onMouseDown={() => handleAddIngredient(item)}
                      className="w-full flex items-center justify-between px-4 py-2 hover:bg-indigo-50 transition-colors text-left cursor-pointer"
                    >
                      <span className="text-sm font-medium text-slate-800 truncate pr-2">{item.nombre}</span>
                      <span className="text-xs font-semibold text-orange-600 whitespace-nowrap">{item.calorias ?? '—'} kcal / {item.porcion_base ?? 100}g</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tabla de ingredientes */}
            {ingredientes.length === 0 ? (
              <div className="text-center py-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                <p className="text-sm text-slate-500">No hay ingredientes. Busca y selecciona arriba.</p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="px-3 py-2">Ingrediente</th>
                      <th className="px-3 py-2 text-center">Cant.</th>
                      <th className="px-3 py-2 text-center text-orange-500">kcal</th>
                      <th className="px-3 py-2 text-center text-red-500">Prot</th>
                      <th className="px-3 py-2 text-center text-amber-500">Grasas</th>
                      <th className="px-3 py-2 text-center text-lime-600">Carbos</th>
                      <th className="px-3 py-2 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ingredientes.map(ing => {
                      const m = calcMacros(ing)
                      return (
                        <tr key={ing._rowId} className="hover:bg-slate-50/70 group">
                          <td className="px-3 py-2 text-sm font-medium text-slate-700 max-w-[200px] truncate" title={ing.nombre}>
                            {ing.nombre}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number" min="1" value={ing.cantidad}
                                onChange={(e) => handleCantidadChange(ing._rowId, e.target.value)}
                                className="w-16 text-center px-1.5 py-1 text-xs font-semibold border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                              />
                              <span className="text-[10px] text-slate-400">g</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center"><span className="text-xs font-bold text-orange-600">{m.calorias}</span></td>
                          <td className="px-3 py-2 text-center"><span className="text-xs font-bold text-red-600">{m.proteinas}</span></td>
                          <td className="px-3 py-2 text-center"><span className="text-xs font-bold text-amber-600">{m.grasas}</span></td>
                          <td className="px-3 py-2 text-center"><span className="text-xs font-bold text-lime-600">{m.carbohidratos}</span></td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => handleRemoveIngredient(ing._rowId)}
                              className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer (Totals & Actions) */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-b-2xl">
          <div className="flex items-center gap-4 text-xs font-bold">
            <div className="flex items-center gap-1.5">
              <div className="bg-orange-100 p-1.5 rounded-md text-orange-600"><Flame className="w-3.5 h-3.5" /></div>
              <div><p className="text-slate-400 text-[10px] uppercase">Calorías</p><p className="text-orange-700 text-sm">{Math.round(totals.calorias)}</p></div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="bg-red-100 p-1.5 rounded-md text-red-600"><Beef className="w-3.5 h-3.5" /></div>
              <div><p className="text-slate-400 text-[10px] uppercase">Proteínas</p><p className="text-red-700 text-sm">{Math.round(totals.proteinas)}g</p></div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="bg-amber-100 p-1.5 rounded-md text-amber-600"><Droplets className="w-3.5 h-3.5" /></div>
              <div><p className="text-slate-400 text-[10px] uppercase">Grasas</p><p className="text-amber-700 text-sm">{Math.round(totals.grasas)}g</p></div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="bg-lime-100 p-1.5 rounded-md text-lime-600"><Wheat className="w-3.5 h-3.5" /></div>
              <div><p className="text-slate-400 text-[10px] uppercase">Carbos</p><p className="text-lime-700 text-sm">{Math.round(totals.carbohidratos)}g</p></div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer">
              Cancelar
            </button>
            <button 
              onClick={handleSave} 
              disabled={saving || !nombre.trim() || ingredientes.length === 0} 
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Guardando...' : 'Crear Receta'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
