import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Search, Plus, Loader2, Bookmark, Flame, Beef, Droplets, Wheat, Trash2, Edit3, X } from 'lucide-react'
import ModalCrearReceta from '../components/ModalCrearReceta'

export default function Recetas({ tenantId }) {
  const [recetas, setRecetas] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [deleting, setDeleting] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    fetchRecetas()
  }, [])

  const fetchRecetas = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('recetas')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setRecetas(data || [])
    } catch (err) {
      console.error('Error fetching recetas:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar esta receta? Esta acción no se puede deshacer.')) return
    
    setDeleting(id)
    try {
      const { error } = await supabase.from('recetas').delete().eq('id', id)
      if (error) throw error
      setRecetas(prev => prev.filter(r => r.id !== id))
    } catch (err) {
      console.error('Error al eliminar:', err)
      alert('Hubo un error al eliminar la receta.')
    } finally {
      setDeleting(null)
    }
  }

  const filteredRecetas = recetas.filter(r => 
    r.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.tipo_comida.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const mealColors = {
    desayuno: 'bg-amber-100 text-amber-700',
    media_manana: 'bg-orange-100 text-orange-700',
    almuerzo: 'bg-teal-100 text-teal-700',
    merienda: 'bg-emerald-100 text-emerald-700',
    cena: 'bg-indigo-100 text-indigo-700'
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Mis Recetas</h1>
          <p className="text-slate-500 mt-1">Gestiona tus plantillas de comidas frecuentes.</p>
        </div>
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Nueva Receta
        </button>
      </div>

      {/* Buscador */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nombre o tipo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
          />
        </div>
      </div>

      {/* Grid de Recetas */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : filteredRecetas.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
            <Bookmark className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">No se encontraron recetas</h3>
          <p className="text-slate-500 text-sm max-w-sm mx-auto">
            {searchTerm ? 'Intenta con otro término de búsqueda.' : 'Crea recetas desde el Plan Nutricional de cualquier paciente para tenerlas disponibles aquí.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRecetas.map(receta => {
            const ings = receta.ingredientes || []
            return (
              <div key={receta.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow group flex flex-col">
                <div className="p-5 flex-1">
                  <div className="flex justify-between items-start mb-3">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${mealColors[receta.tipo_comida] || 'bg-slate-100 text-slate-600'}`}>
                      {receta.tipo_comida.replace('_', ' ')}
                    </span>
                    
                    <button 
                      onClick={() => handleDelete(receta.id)}
                      disabled={deleting === receta.id}
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Eliminar receta"
                    >
                      {deleting === receta.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 leading-tight mb-2 line-clamp-2">
                    {receta.nombre}
                  </h3>

                  <p className="text-sm text-slate-500 line-clamp-2 mb-4 h-10">
                    <span className="font-semibold">{ings.length} ingr:</span> {ings.map(i => i.nombre).join(', ')}
                  </p>

                  <div className="grid grid-cols-4 gap-2 pt-4 border-t border-slate-100">
                    <div className="flex flex-col items-center p-1.5 bg-orange-50 rounded-lg text-orange-700">
                      <Flame className="w-3.5 h-3.5 mb-0.5 opacity-70" />
                      <span className="text-xs font-black">{Math.round(receta.calorias)}</span>
                    </div>
                    <div className="flex flex-col items-center p-1.5 bg-red-50 rounded-lg text-red-700">
                      <Beef className="w-3.5 h-3.5 mb-0.5 opacity-70" />
                      <span className="text-xs font-black">{Math.round(receta.proteinas)}g</span>
                    </div>
                    <div className="flex flex-col items-center p-1.5 bg-amber-50 rounded-lg text-amber-700">
                      <Droplets className="w-3.5 h-3.5 mb-0.5 opacity-70" />
                      <span className="text-xs font-black">{Math.round(receta.grasas)}g</span>
                    </div>
                    <div className="flex flex-col items-center p-1.5 bg-lime-50 rounded-lg text-lime-700">
                      <Wheat className="w-3.5 h-3.5 mb-0.5 opacity-70" />
                      <span className="text-xs font-black">{Math.round(receta.carbohidratos)}g</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ModalCrearReceta
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        tenantId={tenantId}
        onSuccess={() => {
          setIsModalOpen(false)
          fetchRecetas()
        }}
      />
    </div>
  )
}
