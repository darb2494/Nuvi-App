import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { 
  Calendar, 
  Clock, 
  Plus, 
  X, 
  CheckCircle2,
  XCircle,
  AlertCircle,
  CalendarDays,
  CalendarCheck2
} from 'lucide-react'

export default function CitasPaciente({ pacienteId, tenantId }) {
  const [citas, setCitas] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formCita, setFormCita] = useState({
    fecha: new Date().toISOString().split('T')[0],
    hora: '10:00',
    tipo: 'Control',
    costo: '',
    notas: ''
  })

  const fetchCitas = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('citas')
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('fecha', { ascending: false })
        .order('hora', { ascending: false })

      if (error) throw error
      setCitas(data || [])
    } catch (err) {
      console.error('Error al cargar citas del paciente:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (pacienteId) {
      fetchCitas()
    }
  }, [pacienteId])

  const handleGuardarCita = async (e) => {
    e.preventDefault()
    setSaving(true)
    
    try {
      const payload = {
        paciente_id: pacienteId,
        tenant_id: tenantId,
        fecha: formCita.fecha,
        hora: formCita.hora,
        tipo_cita: formCita.tipo,
        costo: Number(formCita.costo) || 0,
        estado: 'Agendada',
        notas: formCita.notas || null
      }

      const { error } = await supabase
        .from('citas')
        .insert([payload])

      if (error) throw error

      setIsModalOpen(false)
      setFormCita({
        fecha: new Date().toISOString().split('T')[0],
        hora: '10:00',
        tipo: 'Control',
        costo: '',
        notas: ''
      })
      
      fetchCitas()
    } catch (err) {
      console.error('Error agendando cita:', err)
      alert('Error al agendar la cita.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelarCita = async (citaId) => {
    if (!confirm('¿Estás seguro de cancelar esta cita?')) return

    try {
      const { error } = await supabase
        .from('citas')
        .update({ estado: 'Cancelada' })
        .eq('id', citaId)

      if (error) throw error
      
      setCitas(citas.map(c => c.id === citaId ? { ...c, estado: 'Cancelada' } : c))
    } catch (err) {
      console.error('Error cancelando cita:', err)
      alert('Error al cancelar la cita.')
    }
  }

  const handleChange = (e) => {
    setFormCita({ ...formCita, [e.target.name]: e.target.value })
  }

  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'Agendada': return 'bg-amber-100 text-amber-700'
      case 'Completada': return 'bg-emerald-100 text-emerald-700'
      case 'Cancelada': return 'bg-red-100 text-red-700'
      case 'No asistió': return 'bg-slate-100 text-slate-700'
      default: return 'bg-slate-100 text-slate-700'
    }
  }

  const getEstadoIcon = (estado) => {
    switch (estado) {
      case 'Agendada': return <Clock className="w-3.5 h-3.5" />
      case 'Completada': return <CheckCircle2 className="w-3.5 h-3.5" />
      case 'Cancelada': return <XCircle className="w-3.5 h-3.5" />
      case 'No asistió': return <AlertCircle className="w-3.5 h-3.5" />
      default: return null
    }
  }

  const now = new Date()

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 fade-in duration-300 pb-12">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-teal-600" /> Historial de Citas
          </h2>
          <p className="text-sm text-slate-500">Próximas citas y citas anteriores de este paciente.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-teal-700 shadow-sm shadow-teal-200 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Agendar Nueva Cita
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando citas...</div>
        ) : citas.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <CalendarCheck2 className="w-12 h-12 text-teal-100 mb-3" />
            <p className="text-slate-500 font-medium">Este paciente no tiene citas registradas.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {citas.map((cita) => {
              // Reconstruimos la fecha localmente para visualización
              const citaDate = new Date(`${cita.fecha}T${cita.hora}`)
              const isFuture = citaDate > now && cita.estado === 'Agendada'

              return (
                <div key={cita.id} className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${isFuture ? 'bg-amber-50/30' : 'hover:bg-slate-50'}`}>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-xl w-16 py-2 shadow-sm">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {citaDate.toLocaleDateString('es-ES', { month: 'short' })}
                      </span>
                      <span className="text-xl font-black text-slate-800 leading-tight">
                        {citaDate.getDate()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-bold text-slate-900">{cita.hora ? cita.hora.substring(0, 5) : '00:00'}</h3>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          {cita.tipo_cita}
                        </span>
                      </div>
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${getEstadoColor(cita.estado)}`}>
                        {getEstadoIcon(cita.estado)}
                        {cita.estado}
                      </div>
                      {cita.notas && <p className="text-xs text-slate-500 mt-2">{cita.notas}</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isFuture && (
                      <button 
                        onClick={() => handleCancelarCita(cita.id)}
                        className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                      >
                        Cancelar Cita
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Modal: Agendar Cita ──────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="bg-teal-100 p-2 rounded-lg text-teal-600">
                  <Calendar className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Agendar Cita</h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 bg-slate-50">
              <form id="citaForm" onSubmit={handleGuardarCita} className="space-y-4">
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha</label>
                    <input 
                      type="date" 
                      name="fecha" 
                      required 
                      value={formCita.fecha} 
                      onChange={handleChange} 
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-colors" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Hora</label>
                    <input 
                      type="time" 
                      name="hora" 
                      required 
                      value={formCita.hora} 
                      onChange={handleChange} 
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-colors" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de Cita</label>
                    <select 
                      name="tipo" 
                      required 
                      value={formCita.tipo} 
                      onChange={handleChange} 
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-colors cursor-pointer"
                    >
                      <option value="Primera vez">Primera vez</option>
                      <option value="Control">Control</option>
                      <option value="Entrega de plan">Entrega de plan</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Costo ($)</label>
                    <input 
                      type="number" min="0" step="0.01"
                      name="costo"
                      placeholder="Ej. 500"
                      value={formCita.costo} 
                      onChange={handleChange} 
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-colors" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Notas Adicionales (Opcional)</label>
                  <textarea 
                    rows="2" 
                    name="notas" 
                    value={formCita.notas} 
                    onChange={handleChange} 
                    placeholder="Ej. Traer exámenes médicos recientes..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none resize-none transition-colors"
                  />
                </div>

              </form>
            </div>

            <div className="p-5 border-t border-slate-200 bg-white flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                form="citaForm"
                disabled={saving}
                className="flex items-center gap-2 bg-teal-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-teal-700 shadow-sm shadow-teal-200 transition-colors cursor-pointer disabled:opacity-70"
              >
                {saving ? 'Agendando...' : 'Confirmar Cita'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
