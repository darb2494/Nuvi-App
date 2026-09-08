import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Search, Plus, MoreVertical, Edit2, FileText, X, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

export default function Pacientes({ session, tenantName }) {
  const [pacientes, setPacientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPatientId, setEditingPatientId] = useState(null)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (location.state?.openNuevoPaciente) {
      setIsModalOpen(true)
      // Limpiar el estado para que no vuelva a abrir al recargar
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, navigate, location.pathname])

  // ── Estados del Formulario ─────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    nombre: '',
    apellidos: '',
    correo: '',
    telefono: '',
    fecha_nacimiento: '',
    sexo: 'prefiero_no_decir'
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // ── Cargar Pacientes ───────────────────────────────────────────────────────
  const fetchPacientes = async () => {
    setLoading(true)
    try {
      // En nuestro esquema, los pacientes están en public.profiles con role = 'paciente'
      // RLS ya filtra automáticamente por tenant_id
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          first_name,
          last_name,
          phone,
          created_at,
          datos_personales!inner (
            fecha_nacimiento,
            genero
          )
        `)
        .eq('role', 'paciente')
        .ilike('first_name', `%${searchTerm}%`)
        .order('created_at', { ascending: false })

      // Nota: Si datos_personales no está creado aún, la query anterior fallará por el !inner.
      // Haremos una consulta más segura a profiles solamente por ahora.
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, phone, created_at')
        .eq('role', 'paciente')
        .ilike('first_name', `%${searchTerm}%`)
        .order('created_at', { ascending: false })

      if (profilesError) throw profilesError
      setPacientes(profilesData || [])
    } catch (err) {
      console.error('Error al cargar pacientes:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Implementamos un pequeño debounce para la búsqueda
    const timer = setTimeout(() => {
      fetchPacientes()
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // ── Crear o Editar Paciente ─────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrorMsg('')

    try {
      if (editingPatientId) {
        // ACTUALIZAR PACIENTE
        // Llamamos a la función RPC SECURITY DEFINER para saltar políticas RLS
        const { error } = await supabase.rpc('fn_actualizar_paciente_offline', {
          p_paciente_id: editingPatientId,
          p_nombre: formData.nombre,
          p_apellidos: formData.apellidos,
          p_telefono: formData.telefono,
          p_fecha_nacimiento: formData.fecha_nacimiento || null,
          p_genero: formData.sexo
        })

        if (error) {
          throw error
        }
      } else {
        // CREAR NUEVO PACIENTE
        // Llamamos a la función RPC SECURITY DEFINER que creamos
        const { data, error } = await supabase.rpc('fn_crear_paciente_offline', {
          p_nombre: formData.nombre,
          p_apellidos: formData.apellidos,
          p_email: formData.correo,
          p_telefono: formData.telefono,
          p_fecha_nacimiento: formData.fecha_nacimiento || null,
          p_genero: formData.sexo
        })

        if (error) {
          throw error
        }
      }

      // Si tiene éxito (tanto en editar como en crear):
      await fetchPacientes()
      setIsModalOpen(false)
      setEditingPatientId(null)
      setFormData({ nombre: '', apellidos: '', correo: '', telefono: '', fecha_nacimiento: '', sexo: 'prefiero_no_decir' })

    } catch (err) {
      console.error('Error al guardar:', err)
      setErrorMsg(err.message || 'Error al guardar el paciente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditClick = async (paciente) => {
    setEditingPatientId(paciente.id)
    setIsModalOpen(true)
    
    // Datos básicos
    setFormData({
      nombre: paciente.first_name || '',
      apellidos: paciente.last_name || '',
      correo: '', // Por seguridad no mostramos o no editamos el correo acá por el momento
      telefono: paciente.phone || '',
      fecha_nacimiento: '',
      sexo: 'prefiero_no_decir'
    })

    // Intentar traer datos personales pasando por anamnesis
    try {
      const { data: anamnesisData } = await supabase
        .from('anamnesis')
        .select('id, datos_personales(fecha_nacimiento, genero)')
        .eq('paciente_id', paciente.id)
        .maybeSingle()

      if (anamnesisData && anamnesisData.datos_personales) {
        const dp = Array.isArray(anamnesisData.datos_personales) 
          ? anamnesisData.datos_personales[0] 
          : anamnesisData.datos_personales;
          
        if (dp) {
          setFormData(prev => ({
            ...prev,
            fecha_nacimiento: dp.fecha_nacimiento ? dp.fecha_nacimiento.split('T')[0] : '', // Asegurar formato YYYY-MM-DD
            sexo: dp.genero || 'prefiero_no_decir'
          }))
        }
      }
    } catch (err) {
      console.error('Error cargando datos_personales para editar', err)
    }
  }

  const handleDeleteClick = async (paciente) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar permanentemente a ${paciente.first_name} ${paciente.last_name}? Esta acción no se puede deshacer y borrará todo su expediente.`)) {
      try {
        const { error } = await supabase.rpc('fn_borrar_paciente_offline', {
          p_paciente_id: paciente.id
        });
        
        if (error) throw error;
        
        // Refrescar la lista
        await fetchPacientes();
      } catch (err) {
        console.error('Error al borrar paciente:', err);
        alert('Hubo un error al borrar el paciente. Verifica que tengas los permisos necesarios.');
      }
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      
      {/* ── Header y Acciones ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pacientes</h1>
          <p className="text-slate-500 text-sm mt-1">
            Gestiona los expedientes y datos de tus pacientes.
          </p>
        </div>
        <button 
          onClick={() => {
            setEditingPatientId(null)
            setFormData({ nombre: '', apellidos: '', correo: '', telefono: '', fecha_nacimiento: '', sexo: 'prefiero_no_decir' })
            setIsModalOpen(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl font-medium text-sm hover:bg-teal-700 active:bg-teal-800 transition-colors shadow-sm shadow-teal-200 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Nuevo Paciente
        </button>
      </div>

      {/* ── Barra de Búsqueda ─────────────────────────────────────────────── */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
        <Search className="w-5 h-5 text-slate-400" />
        <input 
          type="text" 
          placeholder="Buscar paciente por nombre..." 
          className="flex-1 bg-transparent border-none outline-none text-slate-700 placeholder:text-slate-400 text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* ── Tabla de Pacientes ────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                <th className="px-6 py-4">Nombre del Paciente</th>
                <th className="px-6 py-4">Teléfono</th>
                <th className="px-6 py-4">Fecha de Registro</th>
                <th className="px-6 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
                      Cargando pacientes...
                    </div>
                  </td>
                </tr>
              ) : pacientes.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                    No se encontraron pacientes. Haz clic en "Nuevo Paciente" para comenzar.
                  </td>
                </tr>
              ) : (
                pacientes.map((paciente) => (
                  <tr key={paciente.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {paciente.first_name} {paciente.last_name}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {paciente.phone || 'No registrado'}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(paciente.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 flex justify-center items-center gap-1">
                      <Link to={`/pacientes/${paciente.id}`} className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors" title="Ver Historial">
                        <FileText className="w-4 h-4" />
                      </Link>
                      <button 
                        onClick={() => handleEditClick(paciente)}
                        className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer" 
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteClick(paciente)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer" 
                        title="Borrar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal Nuevo Paciente ──────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="text-lg font-bold text-slate-900">
                {editingPatientId ? 'Editar Paciente' : 'Registrar Nuevo Paciente'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              
              {errorMsg && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Nombres *</label>
                  <input 
                    required type="text" 
                    value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Apellidos *</label>
                  <input 
                    required type="text" 
                    value={formData.apellidos} onChange={e => setFormData({...formData, apellidos: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
              </div>

              {!editingPatientId && (
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Correo Electrónico (Opcional)</label>
                  <input 
                    type="email" 
                    value={formData.correo} onChange={e => setFormData({...formData, correo: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Teléfono</label>
                  <input 
                    type="tel" 
                    value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Fecha Nacimiento</label>
                  <input 
                    type="date" 
                    min="1900-01-01"
                    max={new Date().toISOString().split('T')[0]}
                    value={formData.fecha_nacimiento} onChange={e => setFormData({...formData, fecha_nacimiento: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-600"
                  />
                </div>
              </div>

              <div className="space-y-1.5 pb-2">
                <label className="text-sm font-semibold text-slate-700">Sexo / Género</label>
                <select 
                  value={formData.sexo} onChange={e => setFormData({...formData, sexo: e.target.value})}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-700"
                >
                  <option value="masculino">Masculino</option>
                  <option value="femenino">Femenino</option>
                  <option value="otro">Otro</option>
                  <option value="prefiero_no_decir">Prefiero no decir</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium text-sm hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-xl font-medium text-sm hover:bg-teal-700 disabled:opacity-70 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {isSubmitting ? 'Guardando...' : (editingPatientId ? 'Guardar Cambios' : 'Crear Paciente')}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  )
}
