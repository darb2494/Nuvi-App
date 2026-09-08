import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { User, Phone, AtSign, Globe, Save, UploadCloud, Building2, Briefcase } from 'lucide-react'

export default function Configuracion({ session }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [perfil, setPerfil] = useState({
    nombre_completo: '',
    especialidad: '',
    telefono_contacto: '',
    instagram_url: '',
    sitio_web_url: '',
    avatar_url: '',
    firma_url: '',
    sello_url: ''
  })

  // Referencias para abrir el file picker al hacer clic
  const avatarInputRef = useRef(null)
  const firmaInputRef = useRef(null)
  const selloInputRef = useRef(null)

  useEffect(() => {
    fetchPerfil()
  }, [])

  const fetchPerfil = async () => {
    try {
      const { data, error } = await supabase
        .from('perfiles_profesionales')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }
      if (data) {
        setPerfil(data)
      }
    } catch (err) {
      console.error('Error al cargar el perfil:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setPerfil(prev => ({ ...prev, [name]: value }))
  }

  const handleFileUpload = async (e, field) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      // Nombre de archivo único (ID usuario + timestamp)
      const fileExt = file.name.split('.').pop()
      const fileName = `${session.user.id}/${field}_${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      // Subir archivo al bucket 'recursos_profesionales'
      const { error: uploadError } = await supabase.storage
        .from('recursos_profesionales')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      // Obtener URL pública
      const { data } = supabase.storage
        .from('recursos_profesionales')
        .getPublicUrl(filePath)

      setPerfil(prev => ({ ...prev, [field]: data.publicUrl }))
    } catch (error) {
      console.error('Error subiendo imagen:', error)
      alert('Error al subir la imagen. Verifica los permisos del Storage.')
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        id: session.user.id,
        nombre_completo: perfil.nombre_completo,
        especialidad: perfil.especialidad,
        telefono_contacto: perfil.telefono_contacto,
        instagram_url: perfil.instagram_url,
        sitio_web_url: perfil.sitio_web_url,
        avatar_url: perfil.avatar_url,
        firma_url: perfil.firma_url,
        sello_url: perfil.sello_url,
        updated_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('perfiles_profesionales')
        .upsert(payload)

      if (error) throw error
      alert('¡Perfil profesional guardado correctamente!')
    } catch (err) {
      console.error('Error guardando perfil:', err)
      alert('Error al guardar los cambios.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
      </div>
    )
  }

  // Helper para mostrar iniciales
  const getInitials = (name) => {
    if (!name) return 'Dr'
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in slide-in-from-bottom-2 fade-in duration-300 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Perfil Profesional
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configura tus datos y recursos gráficos para los planes nutricionales.
          </p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-xl font-bold text-sm hover:bg-teal-700 active:bg-teal-800 transition-colors shadow-sm shadow-teal-200 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Bloque Superior Izquierdo: Avatar */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col items-center justify-center gap-4">
          <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
            <div className="w-32 h-32 rounded-full border-4 border-slate-50 overflow-hidden bg-slate-100 flex items-center justify-center shadow-inner">
              {perfil.avatar_url ? (
                <img src={perfil.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-black text-slate-300">{getInitials(perfil.nombre_completo)}</span>
              )}
            </div>
            <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
              <UploadCloud className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="text-center">
            <h3 className="font-bold text-slate-900">Foto de Perfil</h3>
            <p className="text-xs text-slate-500 mt-1">Sube una foto profesional clara.</p>
          </div>
          <input 
            type="file" 
            ref={avatarInputRef} 
            onChange={(e) => handleFileUpload(e, 'avatar_url')} 
            accept="image/*" 
            className="hidden" 
          />
        </div>

        {/* Bloque Superior Derecho: Datos Personales */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="font-bold text-slate-900 mb-2">Datos Públicos</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Nombre Completo</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" name="nombre_completo" value={perfil.nombre_completo} onChange={handleChange}
                  placeholder="Ej. Dra. María Pérez"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Especialidad</label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" name="especialidad" value={perfil.especialidad} onChange={handleChange}
                  placeholder="Ej. Nutricionista Clínico"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Teléfono de Contacto</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="tel" name="telefono_contacto" value={perfil.telefono_contacto} onChange={handleChange}
                  placeholder="Para citas o dudas"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Instagram</label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" name="instagram_url" value={perfil.instagram_url} onChange={handleChange}
                  placeholder="Ej. @dra.mariaperez"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-700">Sitio Web / Linktree (Opcional)</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="url" name="sitio_web_url" value={perfil.sitio_web_url} onChange={handleChange}
                  placeholder="https://misitio.com"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Bloque Inferior: Validaciones Oficiales */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="mb-6">
          <h3 className="font-bold text-slate-900">Validación Oficial para Planes PDF</h3>
          <p className="text-sm text-slate-500 mt-1">
            Sube tu firma y sello en formato PNG con fondo transparente para que se integren limpiamente en los PDFs de las dietas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Firma Digital */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-700">Firma Digital</h4>
            <div 
              onClick={() => firmaInputRef.current?.click()}
              className="relative h-40 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center cursor-pointer hover:border-teal-500 hover:bg-teal-50/50 transition-colors group overflow-hidden"
            >
              {perfil.firma_url ? (
                <img src={perfil.firma_url} alt="Firma" className="max-h-full max-w-full object-contain p-4" />
              ) : (
                <div className="flex flex-col items-center text-slate-400 group-hover:text-teal-600 transition-colors">
                  <UploadCloud className="w-8 h-8 mb-2" />
                  <span className="text-sm font-medium">Subir Firma (.png)</span>
                </div>
              )}
              {/* Overlay de edición */}
              {perfil.firma_url && (
                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="bg-white/90 backdrop-blur-sm text-slate-900 text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm">Cambiar</span>
                </div>
              )}
            </div>
            <input type="file" ref={firmaInputRef} onChange={(e) => handleFileUpload(e, 'firma_url')} accept="image/png, image/jpeg" className="hidden" />
          </div>

          {/* Sello Digital */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-700">Sello Profesional</h4>
            <div 
              onClick={() => selloInputRef.current?.click()}
              className="relative h-40 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/50 transition-colors group overflow-hidden"
            >
              {perfil.sello_url ? (
                <img src={perfil.sello_url} alt="Sello" className="max-h-full max-w-full object-contain p-4" />
              ) : (
                <div className="flex flex-col items-center text-slate-400 group-hover:text-indigo-600 transition-colors">
                  <UploadCloud className="w-8 h-8 mb-2" />
                  <span className="text-sm font-medium">Subir Sello (.png)</span>
                </div>
              )}
              {/* Overlay de edición */}
              {perfil.sello_url && (
                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="bg-white/90 backdrop-blur-sm text-slate-900 text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm">Cambiar</span>
                </div>
              )}
            </div>
            <input type="file" ref={selloInputRef} onChange={(e) => handleFileUpload(e, 'sello_url')} accept="image/png, image/jpeg" className="hidden" />
          </div>

        </div>
      </div>

    </div>
  )
}
