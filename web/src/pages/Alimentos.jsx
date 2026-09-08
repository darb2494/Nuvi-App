import { useState, useEffect, useCallback, useRef } from 'react'
import { Apple, Search, Plus, Edit2, X, Check, ChevronLeft, ChevronRight, Flame, Beef, Droplets, Wheat } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

// ── Modal de Crear / Editar ───────────────────────────────────────────────────
function AlimentoModal({ isOpen, alimento, tenantId, onClose, onSaved }) {
  const emptyForm = { nombre: '', porcion_base: 100, calorias: '', proteinas: '', grasas: '', carbohidratos: '', fibra: '' }
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (alimento) {
      setForm({
        nombre:        alimento.nombre        ?? '',
        porcion_base:  alimento.porcion_base  ?? 100,
        calorias:      alimento.calorias      ?? '',
        proteinas:     alimento.proteinas     ?? '',
        grasas:        alimento.grasas        ?? '',
        carbohidratos: alimento.carbohidratos ?? '',
        fibra:         alimento.fibra         ?? '',
      })
    } else {
      setForm(emptyForm)
    }
    setError(null)
  }, [alimento, isOpen])

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  /**
   * Convierte un valor del formulario a número float de forma segura.
   * Soporta tanto punto (4.2) como coma (4,2) como separador decimal.
   * Retorna null si el campo está vacío.
   */
  const parseNum = (val) => {
    if (val === '' || val === null || val === undefined) return null
    const normalized = String(val).replace(',', '.').trim()
    const num = parseFloat(normalized)
    return isNaN(num) ? null : num
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = {
        nombre:           form.nombre.trim(),
        porcion_base:     parseNum(form.porcion_base) ?? 100,
        calorias:         parseNum(form.calorias),
        proteinas:        parseNum(form.proteinas),
        grasas:           parseNum(form.grasas),
        carbohidratos:    parseNum(form.carbohidratos),
        fibra:            parseNum(form.fibra),
        es_personalizado: true,
        tenant_id:        tenantId,
      }

      if (alimento?.id) {
        // UPDATE — usamos .select() sin .single() para evitar error cuando
        // Supabase no retorna exactamente 1 fila (ej. por RLS o 0 cambios).
        const { data, error } = await supabase
          .from('alimentos')
          .update(payload)
          .eq('id', alimento.id)
          .select()
        if (error) throw error
        // Llamamos onSaved con el primer resultado o con el objeto original + cambios
        onSaved(data?.[0] ?? { ...alimento, ...payload })
      } else {
        // INSERT — .single() es seguro aquí porque siempre inserta 1 fila
        const { data, error } = await supabase
          .from('alimentos')
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        onSaved(data)
      }
      onClose()
    } catch (err) {
      // Mensaje amigable si el error viene de formato numérico
      const msg = err.message ?? String(err)
      if (msg.includes('coerce') || msg.includes('invalid input syntax')) {
        setError('Error de formato numérico. Usa punto (.) en lugar de coma (,) para los decimales. Ej: 4.2 en vez de 4,2')
      } else {
        setError(msg)
      }
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const isEdit = !!alimento?.id

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg animate-in zoom-in-95 duration-200">
        
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
              {isEdit ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'Editar Alimento' : 'Nuevo Alimento'}</h2>
              <p className="text-xs text-slate-500">{isEdit ? `Código: ${alimento.id}` : 'Se añadirá a tu banco personalizado'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
          )}
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre del Alimento *</label>
            <input required name="nombre" value={form.nombre} onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
              placeholder="Ej. Pechuga de pollo cocida" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Porción base (g/ml)</label>
              <input name="porcion_base" type="number" step="1" value={form.porcion_base} onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                <Flame className="w-3 h-3 text-orange-500" /> Calorías (kcal)
              </label>
              <input name="calorias" type="number" step="0.1" value={form.calorias} onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                <Beef className="w-3 h-3 text-red-500" /> Proteína (g)
              </label>
              <input name="proteinas" type="number" step="0.1" value={form.proteinas} onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                <Droplets className="w-3 h-3 text-amber-500" /> Grasas (g)
              </label>
              <input name="grasas" type="number" step="0.1" value={form.grasas} onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                <Wheat className="w-3 h-3 text-lime-600" /> Carbos (g)
              </label>
              <input name="carbohidratos" type="number" step="0.1" value={form.carbohidratos} onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-emerald-700 shadow-sm transition-colors cursor-pointer disabled:opacity-60">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'Guardando…' : (isEdit ? 'Guardar Cambios' : 'Crear Alimento')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Componente Principal ──────────────────────────────────────────────────────
const PAGE_SIZE = 30

export default function Alimentos({ session, tenantId }) {
  const [alimentos, setAlimentos]   = useState([])
  const [total, setTotal]           = useState(0)
  const [page, setPage]             = useState(0)
  const [search, setSearch]         = useState('')
  const [loading, setLoading]       = useState(true)
  const [modalOpen, setModalOpen]   = useState(false)
  const [editing, setEditing]       = useState(null)
  const searchTimeout               = useRef(null)

  const fetchAlimentos = useCallback(async (searchTerm = '', currentPage = 0) => {
    setLoading(true)
    try {
      let query = supabase
        .from('alimentos')
        .select('*', { count: 'exact' })
        .order('nombre', { ascending: true })
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1)

      if (searchTerm.trim()) {
        query = query.ilike('nombre', `%${searchTerm.trim()}%`)
      }

      const { data, count, error } = await query
      if (error) throw error
      setAlimentos(data || [])
      setTotal(count || 0)
    } catch (err) {
      console.error('Error al cargar alimentos:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlimentos(search, page)
  }, [page, fetchAlimentos])

  const handleSearchChange = (e) => {
    const val = e.target.value
    setSearch(val)
    setPage(0)
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => fetchAlimentos(val, 0), 300)
  }

  const handleSaved = (saved) => {
    setAlimentos(prev => {
      const exists = prev.find(a => a.id === saved.id)
      if (exists) return prev.map(a => a.id === saved.id ? saved : a)
      return [saved, ...prev]
    })
    setTotal(t => t + 1)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Resumen de macros en chips de colores
  const MacroChip = ({ value, unit = 'g', color = 'slate' }) => {
    const colors = {
      orange: 'bg-orange-50 text-orange-700',
      red:    'bg-red-50 text-red-700',
      amber:  'bg-amber-50 text-amber-700',
      lime:   'bg-lime-50 text-lime-700',
      slate:  'bg-slate-100 text-slate-500',
    }
    return (
      <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${colors[color] ?? colors.slate}`}>
        {value != null ? `${value}${unit}` : '—'}
      </span>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      
      {/* ── Cabecera ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
              <Apple className="w-5 h-5" />
            </div>
            Banco de Alimentos
          </h1>
          <p className="text-slate-500 text-sm mt-1 ml-[52px]">
            {total.toLocaleString()} alimentos disponibles · Base INN/INCAP
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true) }}
          className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-emerald-700 shadow-sm shadow-emerald-200 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Añadir Alimento
        </button>
      </div>

      {/* ── Buscador ──────────────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
        <input
          type="text"
          value={search}
          onChange={handleSearchChange}
          placeholder="Buscar por nombre del alimento… (ej. arroz, pollo, avena)"
          className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
        />
        {search && (
          <button onClick={() => { setSearch(''); setPage(0); fetchAlimentos('', 0) }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Tabla ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                <th className="px-5 py-3 w-16">Cód.</th>
                <th className="px-4 py-3">Alimento</th>
                <th className="px-4 py-3 text-center">Porción</th>
                <th className="px-4 py-3 text-center">
                  <span className="flex items-center justify-center gap-1"><Flame className="w-3 h-3 text-orange-400" />Kcal</span>
                </th>
                <th className="px-4 py-3 text-center">
                  <span className="flex items-center justify-center gap-1"><Beef className="w-3 h-3 text-red-400" />Prot.</span>
                </th>
                <th className="px-4 py-3 text-center">
                  <span className="flex items-center justify-center gap-1"><Droplets className="w-3 h-3 text-amber-400" />Grasas</span>
                </th>
                <th className="px-4 py-3 text-center">
                  <span className="flex items-center justify-center gap-1"><Wheat className="w-3 h-3 text-lime-500" />Carbos</span>
                </th>
                <th className="px-5 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-5 py-3"><div className="h-3 bg-slate-100 rounded w-8" /></td>
                    <td className="px-4 py-3"><div className="h-3 bg-slate-100 rounded w-48" /></td>
                    <td className="px-4 py-3"><div className="h-3 bg-slate-100 rounded w-14 mx-auto" /></td>
                    <td className="px-4 py-3"><div className="h-5 bg-slate-100 rounded w-12 mx-auto" /></td>
                    <td className="px-4 py-3"><div className="h-5 bg-slate-100 rounded w-12 mx-auto" /></td>
                    <td className="px-4 py-3"><div className="h-5 bg-slate-100 rounded w-12 mx-auto" /></td>
                    <td className="px-4 py-3"><div className="h-5 bg-slate-100 rounded w-12 mx-auto" /></td>
                    <td className="px-5 py-3"><div className="h-7 bg-slate-100 rounded w-16 mx-auto" /></td>
                  </tr>
                ))
              ) : alimentos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-slate-400">
                    <Apple className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-semibold text-slate-500">No se encontraron alimentos</p>
                    <p className="text-sm mt-1">
                      {search ? `No hay resultados para "${search}".` : 'Importa la base de datos INN con el script de migración.'}
                    </p>
                  </td>
                </tr>
              ) : (
                alimentos.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors group">
                    <td className="px-5 py-3 text-slate-400 font-mono text-xs">{item.id}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 max-w-xs">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{item.nombre}</span>
                        {item.es_personalizado && (
                          <span className="flex-shrink-0 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">CUSTOM</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-500 text-xs">{item.porcion_base}g</td>
                    <td className="px-4 py-3 text-center">
                      <MacroChip value={item.calorias} unit=" kcal" color="orange" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <MacroChip value={item.proteinas} color="red" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <MacroChip value={item.grasas} color="amber" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <MacroChip value={item.carbohidratos} color="lime" />
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button
                        onClick={() => { setEditing(item); setModalOpen(true) }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded-lg transition-all cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Editar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Paginación ─────────────────────────────────────────────────── */}
        {!loading && total > PAGE_SIZE && (
          <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50/50">
            <p className="text-sm text-slate-500">
              Mostrando <span className="font-semibold">{page * PAGE_SIZE + 1}</span>–<span className="font-semibold">{Math.min((page + 1) * PAGE_SIZE, total)}</span> de <span className="font-semibold">{total.toLocaleString()}</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-slate-700 px-2">
                Pág. {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal Crear/Editar ─────────────────────────────────────────────── */}
      <AlimentoModal
        isOpen={modalOpen}
        alimento={editing}
        tenantId={tenantId}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        onSaved={handleSaved}
      />
    </div>
  )
}
