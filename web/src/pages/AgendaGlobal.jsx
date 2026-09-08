import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  ChevronLeft, 
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  ChevronDown,
  Plus,
  X,
  Trash2
} from 'lucide-react'

export default function AgendaGlobal({ session, tenantName }) {
  const [citas, setCitas] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [updating, setUpdating] = useState(null)
  
  // ── Modal de Cita ──────────────────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [pacientesList, setPacientesList] = useState([])
  const [saving, setSaving] = useState(false)
  
  const [formCita, setFormCita] = useState({
    tipoPaciente: 'existente', // 'existente' | 'prospecto'
    paciente_id: '',
    prospecto_nombre: '',
    prospecto_telefono: '',
    fecha: new Date().toISOString().split('T')[0],
    hora: '10:00',
    tipo: 'Primera vez',
    costo: '',
    notas: ''
  })

  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (location.state?.openNuevaCita) {
      setIsModalOpen(true)
      fetchPacientesList()
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, navigate, location.pathname])

  const fetchPacientesList = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, phone')
        .eq('role', 'paciente')
        .order('first_name', { ascending: true })
      
      if (error) throw error
      setPacientesList(data || [])
    } catch (err) {
      console.error('Error cargando pacientes:', err)
    }
  }

  const handleOpenModal = () => {
    fetchPacientesList()
    setIsModalOpen(true)
  }

  const handleGuardarCita = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      let pacienteId = formCita.paciente_id || null
      
      if (formCita.tipoPaciente === 'prospecto') {
        pacienteId = null
      } else {
        if (!pacienteId) throw new Error('Debes seleccionar un paciente.')
      }

      // tenant_id se extrae automáticamente con RPC o debemos pasarlo.
      // Como no tenemos un tenantId en props fácilmente más allá de tenantName (aunque App lo tiene),
      // pedimos a supabase los datos del tenant del usuario actual.
      const { data: userData } = await supabase.from('profiles').select('tenant_id').eq('id', session.user.id).single()
      
      const payload = {
        paciente_id: pacienteId,
        tenant_id: userData?.tenant_id,
        nombre_contacto: formCita.tipoPaciente === 'prospecto' ? formCita.prospecto_nombre : null,
        telefono_contacto: formCita.tipoPaciente === 'prospecto' ? formCita.prospecto_telefono : null,
        fecha: formCita.fecha,
        hora: formCita.hora,
        tipo_cita: formCita.tipo,
        costo: Number(formCita.costo) || 0,
        estado: 'Agendada',
        notas: formCita.notas || null
      }

      const { error } = await supabase.from('citas').insert([payload])
      if (error) throw error

      setIsModalOpen(false)
      setFormCita({
        tipoPaciente: 'existente', paciente_id: '', prospecto_nombre: '', prospecto_telefono: '',
        fecha: new Date().toISOString().split('T')[0], hora: '10:00', tipo: 'Primera vez', costo: '', notas: ''
      })
      
      fetchCitas(selectedDate)
    } catch (err) {
      console.error('Error agendando:', err)
      alert(err.message || 'Error al agendar la cita.')
    } finally {
      setSaving(false)
    }
  }

  // ── Lista de Citas ──────────────────────────────────────────────────────────
  const fetchCitas = async (date) => {
    setLoading(true)
    try {
      // Convertir a YYYY-MM-DD local
      const offset = date.getTimezoneOffset()
      const localDate = new Date(date.getTime() - (offset * 60 * 1000))
      const dateString = localDate.toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('citas')
        .select(`
          id, fecha, hora, tipo_cita, estado, notas, paciente_id, nombre_contacto, telefono_contacto,
          profiles:paciente_id(first_name, last_name, phone)
        `)
        .eq('fecha', dateString)
        .order('hora', { ascending: true })

      if (error) throw error
      setCitas(data || [])
    } catch (err) {
      console.error('Error al cargar la agenda:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCitas(selectedDate)
  }, [selectedDate])

  const handleEstadoChange = async (citaId, nuevoEstado) => {
    setUpdating(citaId)
    try {
      const { error } = await supabase
        .from('citas')
        .update({ estado: nuevoEstado })
        .eq('id', citaId)
      if (error) throw error
      setCitas(citas.map(c => c.id === citaId ? { ...c, estado: nuevoEstado } : c))
    } catch (err) {
      console.error('Error al actualizar estado:', err)
    } finally {
      setUpdating(null)
    }
  }

  const handleDeleteCita = async (cita) => {
    if (window.confirm('¿Estás seguro de que deseas borrar esta cita permanentemente?')) {
      try {
        const { error } = await supabase.from('citas').delete().eq('id', cita.id);
        if (error) throw error;
        // Refrescar la vista
        fetchCitas(selectedDate);
      } catch (err) {
        console.error('Error al borrar la cita:', err);
        alert('Hubo un error al borrar la cita.');
      }
    }
  }

  const changeDate = (days) => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + days)
    setSelectedDate(newDate)
  }

  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'Agendada': return 'bg-amber-100 text-amber-700 border-amber-200'
      case 'Completada': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'Cancelada': return 'bg-red-100 text-red-700 border-red-200'
      case 'No asistió': return 'bg-slate-100 text-slate-700 border-slate-200'
      default: return 'bg-slate-100 text-slate-700 border-slate-200'
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

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 fade-in duration-300 pb-12">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-teal-600" /> Mi Agenda
          </h1>
          <p className="text-sm text-slate-500 mt-1">Gestiona las citas de tu consultorio</p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Date Selector */}
          <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            <button onClick={() => changeDate(-1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="px-4 py-1 flex flex-col items-center min-w-[140px]">
              <span className="text-sm font-bold text-slate-900">
                {selectedDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'long' })}
              </span>
              {selectedDate.toDateString() === new Date().toDateString() && (
                <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">Hoy</span>
              )}
            </div>
            <button onClick={() => changeDate(1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <button 
            onClick={handleOpenModal}
            className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-xl font-medium text-sm hover:bg-teal-700 active:bg-teal-800 transition-colors shadow-sm shadow-teal-200 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nueva Cita
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex justify-center items-center h-[300px]">
             <div className="w-10 h-10 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
          </div>
        ) : citas.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-[300px] text-slate-400">
            <CalendarIcon className="w-12 h-12 mb-3 text-slate-200" />
            <p className="font-medium text-slate-500 mb-4">No hay citas agendadas para este día.</p>
            <button onClick={handleOpenModal} className="flex items-center gap-2 text-teal-600 font-bold hover:underline">
              <Plus className="w-4 h-4" /> Agendar mi primera cita
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {citas.map((cita) => {
              const timeString = cita.hora ? cita.hora.substring(0, 5) : '00:00'
              const paciente = cita.profiles || null
              
              let nombreDisplay = 'Paciente Desconocido'
              let isPreRegistro = false
              
              if (paciente) {
                nombreDisplay = `${paciente.first_name} ${paciente.last_name || ''}`
              } else if (cita.nombre_contacto) {
                nombreDisplay = cita.nombre_contacto
                isPreRegistro = true
              }
              
              return (
                <div key={cita.id} className="p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-slate-50 transition-colors">
                  
                  {/* Hora */}
                  <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 min-w-[100px]">
                    <span className="text-lg font-black text-slate-800">{timeString}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-slate-900 truncate">
                        {nombreDisplay}
                      </h3>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        {cita.tipo_cita}
                      </span>
                      {isPreRegistro && (
                        <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Pre-registro
                        </span>
                      )}
                    </div>
                    {cita.notas && <p className="text-sm text-slate-500 truncate">{cita.notas}</p>}
                    {(paciente?.phone || cita.telefono_contacto) && (
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        📱 {paciente?.phone || cita.telefono_contacto}
                      </p>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-3 mt-4 sm:mt-0 flex-wrap sm:flex-nowrap">
                    <div className="relative group">
                      <select 
                        disabled={updating === cita.id}
                        value={cita.estado}
                        onChange={(e) => handleEstadoChange(cita.id, e.target.value)}
                        className={`appearance-none pl-8 pr-8 py-2 text-sm font-semibold rounded-lg border focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer disabled:opacity-50 transition-colors ${getEstadoColor(cita.estado)}`}
                      >
                        <option value="Agendada">Agendada</option>
                        <option value="Completada">Completada</option>
                        <option value="Cancelada">Cancelada</option>
                        <option value="No asistió">No asistió</option>
                      </select>
                      <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                        {getEstadoIcon(cita.estado)}
                      </div>
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>

                    {paciente && (
                      <Link 
                        to={`/pacientes/${cita.paciente_id}`}
                        className="flex items-center justify-center gap-1 bg-white border border-slate-200 text-teal-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-teal-50 hover:border-teal-200 transition-colors shadow-sm"
                      >
                        Expediente <ArrowRight className="w-4 h-4" />
                      </Link>
                    )}
                    <button
                      onClick={() => handleDeleteCita(cita)}
                      className="flex items-center justify-center bg-white border border-red-200 text-red-500 p-2 rounded-lg hover:bg-red-50 hover:text-red-700 transition-colors shadow-sm cursor-pointer"
                      title="Borrar cita"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Modal: Agendar Nueva Cita ────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="bg-teal-100 p-2 rounded-lg text-teal-600">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Agendar Nueva Cita</h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 bg-slate-50 flex-1 overflow-y-auto">
              <form id="globalCitaForm" onSubmit={handleGuardarCita} className="space-y-5">
                
                {/* Selector de Tipo de Paciente */}
                <div className="flex gap-4 p-1 bg-slate-200/50 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setFormCita({...formCita, tipoPaciente: 'existente'})}
                    className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-colors ${formCita.tipoPaciente === 'existente' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Paciente Existente
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormCita({...formCita, tipoPaciente: 'prospecto'})}
                    className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-colors ${formCita.tipoPaciente === 'prospecto' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Pre-registro
                  </button>
                </div>

                {/* Inputs según el tipo */}
                {formCita.tipoPaciente === 'existente' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Buscar Paciente *</label>
                    <select 
                      required 
                      value={formCita.paciente_id} 
                      onChange={(e) => setFormCita({...formCita, paciente_id: e.target.value})}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none cursor-pointer"
                    >
                      <option value="">-- Selecciona un paciente --</option>
                      {pacientesList.map(p => (
                        <option key={p.id} value={p.id}>{p.first_name} {p.last_name || ''}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre Completo *</label>
                      <input 
                        type="text" required 
                        placeholder="Ej. María López"
                        value={formCita.prospecto_nombre} 
                        onChange={(e) => setFormCita({...formCita, prospecto_nombre: e.target.value})}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" 
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono</label>
                      <input 
                        type="tel" 
                        placeholder="Ej. +52 1 234 5678"
                        value={formCita.prospecto_telefono} 
                        onChange={(e) => setFormCita({...formCita, prospecto_telefono: e.target.value})}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none" 
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha *</label>
                    <input 
                      type="date" required 
                      value={formCita.fecha} onChange={(e) => setFormCita({...formCita, fecha: e.target.value})}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Hora *</label>
                    <input 
                      type="time" required 
                      value={formCita.hora} onChange={(e) => setFormCita({...formCita, hora: e.target.value})}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none" 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de Cita *</label>
                    <select 
                      required 
                      value={formCita.tipo} onChange={(e) => setFormCita({...formCita, tipo: e.target.value})}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none cursor-pointer"
                    >
                      <option value="Primera vez">Primera vez</option>
                      <option value="Control">Control</option>
                      <option value="Entrega de plan">Entrega de plan</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Costo de la Cita ($)</label>
                    <input 
                      type="number" min="0" step="0.01"
                      placeholder="Ej. 500"
                      value={formCita.costo} onChange={(e) => setFormCita({...formCita, costo: e.target.value})}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none" 
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Notas Adicionales (Opcional)</label>
                  <textarea 
                    rows="2" 
                    value={formCita.notas} onChange={(e) => setFormCita({...formCita, notas: e.target.value})}
                    placeholder="Ej. Traer exámenes médicos recientes..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none resize-none"
                  />
                </div>

              </form>
            </div>

            <div className="p-5 border-t border-slate-200 bg-white flex justify-end gap-3 shrink-0">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                form="globalCitaForm"
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
