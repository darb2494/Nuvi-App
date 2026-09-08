import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { 
  ArrowLeft, CalendarPlus, User, Phone, Mail, Activity, Scale, Calendar, Target, FileEdit, Save, Plus, ChevronDown, ChevronUp, X, Check
} from 'lucide-react'
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts'
import { supabase } from '../lib/supabaseClient'
import PlanNutricional from './PlanNutricional'
import HistorialPlanes from './HistorialPlanes'
import SeguimientoClinico from './SeguimientoClinico'
import CitasPaciente from './CitasPaciente'

// ── Datos Falsos ─────────────────────────────────────────────────────────────
const weightData = [
  { month: 'Ene', peso: 85.2 },
  { month: 'Feb', peso: 83.1 },
  { month: 'Mar', peso: 80.5 },
  { month: 'Abr', peso: 78.8 },
]

const initialAntropometriaHistory = []

export default function ExpedientePaciente() {
  const { id } = useParams()
  const [paciente, setPaciente] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('resumen')
  const [planCargado, setPlanCargado] = useState(null)

  const handleCargarPlan = (plan) => {
    setPlanCargado(plan)
    setActiveTab('plan')
  }

  // Estados Acordeones de Anamnesis
  const [anamnesisSections, setAnamnesisSections] = useState({
    clinicos: true,
    estiloVida: true,
    alimentacion: true
  })

  const toggleSection = (section) => {
    setAnamnesisSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  // Estados Antropometría
  const [antropometriaHistory, setAntropometriaHistory] = useState(initialAntropometriaHistory)
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  // Estado Global del Paciente (Para cálculos automáticos)
  const [pacienteData, setPacienteData] = useState({
    edad: 28,
    sexo: 'M',
    peso: '',
    altura: '',
    objetivo: 1.0 // 1.0 = Mantenimiento
  })
  
  // Estado del Formulario de Antropometría
  const [formAntro, setFormAntro] = useState({
    peso: '', talla: '',
    c_cuello: '', c_torax: '', c_brazo_rel: '', c_brazo_con: '', c_cintura: '', c_abdomen: '', c_cadera: '', c_muslo: '', c_pantorrilla: '',
    p_tricipital: '', p_bicipital: '', p_subescapular: '', p_suprailiaco: '', p_abdominal: '', p_muslo: '', p_pantorrilla: ''
  })

  // Cálculos Automáticos
  const imcCalc = formAntro.peso && formAntro.talla 
    ? (parseFloat(formAntro.peso) / Math.pow(parseFloat(formAntro.talla)/100, 2)).toFixed(1) : '--'
  const iccCalc = formAntro.c_cintura && formAntro.c_cadera 
    ? (parseFloat(formAntro.c_cintura) / parseFloat(formAntro.c_cadera)).toFixed(2) : '--'
  
  // Grasa y masa inventada como placeholder visual si hay peso (en la realidad usarías fórmula de Durnin/Womersley o Jackson/Pollock)
  const grasaCalc = formAntro.peso && formAntro.p_tricipital ? '21.5' : '--'
  const muscularCalc = formAntro.peso ? '34.2' : '--'

  useEffect(() => {
    const fetchPaciente = async () => {
      setLoading(true)
      try {
        // 1. Obtener perfil básico
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, phone, created_at, tenant_id')
          .eq('id', id)
          .single()

        if (profileError) throw profileError
        
        setPaciente(profile)

        // 2. Obtener datos personales pasando por anamnesis
        let dp = null;
        try {
          const { data: anamnesisData, error: anamnesisError } = await supabase
            .from('anamnesis')
            .select('id, datos_personales(fecha_nacimiento, genero)')
            .eq('paciente_id', id)
            .maybeSingle()
            
          if (!anamnesisError && anamnesisData && anamnesisData.datos_personales) {
            dp = Array.isArray(anamnesisData.datos_personales) 
              ? anamnesisData.datos_personales[0] 
              : anamnesisData.datos_personales;
          }
        } catch (e) {
          console.warn('No se pudieron obtener datos personales', e)
        }

        // Calcular datos reales
        let calcEdad = '--';
        let calcSexo = 'prefiero_no_decir';

        if (dp) {
          if (dp.fecha_nacimiento) {
             const birthDate = new Date(dp.fecha_nacimiento);
             if (!isNaN(birthDate.getTime())) {
                 const today = new Date();
                 let age = today.getFullYear() - birthDate.getFullYear();
                 const m = today.getMonth() - birthDate.getMonth();
                 if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                     age--;
                 }
                 calcEdad = (age >= 0 && age < 130) ? age : '--';
             }
          }
          if (dp.genero) {
            calcSexo = dp.genero;
          }
        }

        setPacienteData(prev => ({
          ...prev,
          edad: calcEdad,
          sexo: calcSexo
        }))

      } catch (err) {
        console.error('Error al cargar expediente:', err)
        setPaciente(null) // Para que muestre "Paciente no encontrado" si falla el profile
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchPaciente()
  }, [id])

  const tabs = [
    { id: 'resumen',    label: 'Resumen'          },
    { id: 'citas',      label: 'Citas'            },
    { id: 'anamnesis',  label: 'Anamnesis'         },
    { id: 'antropometria', label: 'Antropometría'  },
    { id: 'seguimiento', label: 'Seguimiento Clínico' },
    { id: 'plan',       label: 'Plan Nutricional'  },
    { id: 'historial',  label: 'Historial Planes'  },
  ]

  const handleGuardarMedicion = (e) => {
    e.preventDefault()
    const nuevaFila = {
      id: Date.now(),
      fecha: new Date().toISOString().split('T')[0],
      peso: parseFloat(formAntro.peso) || '--',
      talla: parseFloat(formAntro.talla) || '--',
      cintura: parseFloat(formAntro.c_cintura) || '--',
      cadera: parseFloat(formAntro.c_cadera) || '--',
      grasa: grasaCalc !== '--' ? parseFloat(grasaCalc) : '--',
      muscular: muscularCalc !== '--' ? parseFloat(muscularCalc) : '--',
      imc: imcCalc
    }
    setAntropometriaHistory([nuevaFila, ...antropometriaHistory])
    setPacienteData(prev => ({ ...prev, peso: nuevaFila.peso, altura: nuevaFila.talla }))
    setIsModalOpen(false)
    setFormAntro({
      peso: '', talla: '',
      c_cuello: '', c_torax: '', c_brazo_rel: '', c_brazo_con: '', c_cintura: '', c_abdomen: '', c_cadera: '', c_muslo: '', c_pantorrilla: '',
      p_tricipital: '', p_bicipital: '', p_subescapular: '', p_suprailiaco: '', p_abdominal: '', p_muslo: '', p_pantorrilla: ''
    })
  }

  const handleAntroChange = (e) => {
    setFormAntro({ ...formAntro, [e.target.name]: e.target.value })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!paciente) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold text-slate-900">Paciente no encontrado</h2>
        <Link to="/pacientes" className="text-teal-600 hover:underline mt-2 block">Volver</Link>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      
      {/* ── Botón Volver ────────────────────────────────────────────────────── */}
      <div>
        <Link to="/pacientes" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-teal-600 transition-colors font-medium">
          <ArrowLeft className="w-4 h-4" /> Volver a pacientes
        </Link>
      </div>

      {/* ── Cabecera: Profile Card ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-teal-50 rounded-full -translate-y-1/2 translate-x-1/3 opacity-50 pointer-events-none" />
        <div className="flex items-center gap-6 relative z-10">
          <div className="w-20 h-20 bg-teal-100 border-4 border-white shadow-sm rounded-full flex items-center justify-center text-teal-700 text-3xl font-bold">
            {paciente.first_name.charAt(0).toUpperCase()}{paciente.last_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{paciente.first_name} {paciente.last_name}</h1>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-2 text-sm text-slate-500">
              <div className="flex items-center gap-1.5">
                <User className="w-4 h-4 text-slate-400" /> 
                {pacienteData.edad !== '--' ? `${pacienteData.edad} años` : 'Edad N/A'}, {pacienteData.sexo === 'M' || pacienteData.sexo === 'masculino' ? 'Masculino' : pacienteData.sexo === 'femenino' ? 'Femenino' : 'Otro'}
              </div>
              <div className="flex items-center gap-1.5"><Phone className="w-4 h-4 text-slate-400" /> {paciente.phone || 'Sin teléfono'}</div>
              <div className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-slate-400" /> Registrado el {new Date(paciente.created_at).toLocaleDateString()}</div>
            </div>
          </div>
        </div>
        <div className="relative z-10 w-full sm:w-auto">
          <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium text-sm hover:bg-slate-50 shadow-sm transition-all cursor-pointer">
            <CalendarPlus className="w-4 h-4 text-teal-600" /> Agendar Cita
          </button>
        </div>
      </div>

      {/* ── Navegación por Pestañas ─────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <nav className="flex overflow-x-auto hide-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors cursor-pointer ${
                activeTab === tab.id ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="py-2">
        {/* ================================================================
            PESTAÑA: RESUMEN
            ================================================================ */}
        {activeTab === 'resumen' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-2 fade-in duration-300">
            {/* Métricas Top */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                    <Scale className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-semibold bg-green-50 text-green-600 px-2.5 py-1 rounded-full">-1.7 kg</span>
                </div>
                <div>
                  <p className="text-slate-500 text-sm font-medium">Último Peso (Hace 2 sem)</p>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">78.8</h3>
                    <span className="text-slate-500 font-medium text-sm">kg</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
                    <Activity className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-semibold text-slate-400">Normal</span>
                </div>
                <div>
                  <p className="text-slate-500 text-sm font-medium">IMC Actual</p>
                  <h3 className="text-2xl font-bold text-slate-900 mt-1">24.3</h3>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
                    <Calendar className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <p className="text-slate-500 text-sm font-medium">Próxima Cita</p>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">28 de Julio, 10:00 AM</h3>
                </div>
              </div>
            </div>

            {/* Evolución y Notas */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Evolución de Peso</h2>
                    <p className="text-sm text-slate-500">Progresión de los últimos 4 meses</p>
                  </div>
                </div>
                <div className="flex-1 min-h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weightData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                      <YAxis domain={['dataMin - 2', 'dataMax + 2']} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        itemStyle={{ color: '#0f172a', fontWeight: 600 }}
                        formatter={(value) => [`${value} kg`, 'Peso']}
                      />
                      <Line type="monotone" dataKey="peso" stroke="#0d9488" strokeWidth={3} dot={{ r: 4, fill: '#0d9488', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, fill: '#0d9488', stroke: '#fff', strokeWidth: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                  <Target className="w-5 h-5 text-teal-600" />
                  <h2 className="text-base font-bold text-slate-900">Objetivo y Notas</h2>
                </div>
                <div className="p-5 flex-1 flex flex-col gap-4">
                  <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-3">
                    <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider mb-1">Motivo Principal</p>
                    <p className="text-sm text-slate-700">Reducción de porcentaje de grasa y recomposición corporal para mejorar rendimiento deportivo.</p>
                  </div>
                  <div className="flex-1 flex flex-col">
                    <div className="flex items-center gap-1.5 mb-2">
                      <FileEdit className="w-4 h-4 text-slate-400" />
                      <label className="text-sm font-semibold text-slate-700">Notas de la sesión</label>
                    </div>
                    <textarea 
                      className="flex-1 w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none"
                      placeholder="Escribe apuntes rápidos aquí..."
                      defaultValue="El paciente menciona ansiedad por comer dulces en la tarde. \n\nAcordamos incrementar proteína en el almuerzo y probar snacks saludables."
                    ></textarea>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            PESTAÑA: ANAMNESIS (MEJORADA Y AMPLIADA)
            ================================================================ */}
        {activeTab === 'anamnesis' && (
          <div className="space-y-4 animate-in slide-in-from-bottom-2 fade-in duration-300 max-w-4xl mx-auto">
            
            {/* Acordeón 0: Datos Base y Objetivo */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 mb-4">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-teal-600" /> Datos Base y Objetivo
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Edad / Sexo</label>
                  <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 font-medium">
                    {pacienteData.edad} años, {pacienteData.sexo === 'M' ? 'Masculino' : 'Femenino'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Peso / Altura Actual</label>
                  <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 font-medium">
                    {pacienteData.peso} kg / {pacienteData.altura} cm
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Objetivo del Paciente</label>
                  <select 
                    value={pacienteData.objetivo}
                    onChange={(e) => setPacienteData(prev => ({ ...prev, objetivo: parseFloat(e.target.value) }))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors"
                  >
                    <option value={0.8}>Pérdida agresiva (-20%)</option>
                    <option value={0.9}>Pérdida ligera (-10%)</option>
                    <option value={1.0}>Mantenimiento (0%)</option>
                    <option value={1.1}>Volumen ligero (+10%)</option>
                    <option value={1.2}>Volumen (+20%)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Acordeón 1: Antecedentes Médicos */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <button 
                onClick={() => toggleSection('clinicos')}
                className="w-full px-6 py-4 flex items-center justify-between bg-slate-50 hover:bg-slate-100/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-600">
                    <Activity className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">1. Antecedentes Clínicos y Patologías</h3>
                </div>
                {anamnesisSections.clinicos ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>
              
              {anamnesisSections.clinicos && (
                <div className="p-6 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">Patologías Diagnosticadas</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                      {[
                        'Hipertensión Arterial', 'Diabetes (Tipo 1/2)', 
                        'Hipotiroidismo', 'Resistencia a Insulina',
                        'Dislipidemia (Col/Trig)', 'Síndrome de Ovarios Pol. (SOP)',
                        'Hígado Graso (EHGNA)', 'Gastritis / Reflujo',
                        'Estreñimiento Crónico', 'TCA'
                      ].map((item) => (
                        <label key={item} className="flex items-start gap-2 text-sm text-slate-600 cursor-pointer hover:text-teal-700">
                          <input type="checkbox" className="mt-1 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer" />
                          <span className="leading-tight">{item}</span>
                        </label>
                      ))}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Otras Patologías</label>
                      <input type="text" placeholder="Ej. Asma, Artritis..." className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Antecedentes Patológicos Familiares</label>
                      <textarea rows="2" placeholder="Ej. Padre con Hipertensión, Madre con Diabetes..." className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-teal-500 focus:border-teal-500 outline-none resize-none transition-colors"></textarea>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Cirugías Previas</label>
                      <input type="text" placeholder="Ej. Apendicectomía (2018), Bypass gástrico..." className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Medicamentos Actuales</label>
                      <textarea rows="2" placeholder="Ej. Eutirox 50mcg, Metformina 850mg..." className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-teal-500 focus:border-teal-500 outline-none resize-none transition-colors"></textarea>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Suplementos y Vitaminas</label>
                      <textarea rows="2" placeholder="Ej. Omega 3, Magnesio, Proteína Whey..." className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-teal-500 focus:border-teal-500 outline-none resize-none transition-colors"></textarea>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Acordeón 2: Estilo de Vida y Factores Psicosociales */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <button 
                onClick={() => toggleSection('estiloVida')}
                className="w-full px-6 py-4 flex items-center justify-between bg-slate-50 hover:bg-slate-100/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <User className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">2. Estilo de Vida y Psicosocial</h3>
                </div>
                {anamnesisSections.estiloVida ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>

              {anamnesisSections.estiloVida && (
                <div className="p-6 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Nivel de Actividad Física</label>
                    <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-teal-500 focus:border-teal-500 outline-none">
                      <option>Sedentario (Casi sin ejercicio)</option>
                      <option>Ligeramente Activo (1-3 días/sem)</option>
                      <option>Moderadamente Activo (3-5 días/sem)</option>
                      <option>Muy Activo (6-7 días o atletas)</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Calidad de Sueño</label>
                      <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-teal-500 focus:border-teal-500 outline-none">
                        <option>Buena</option>
                        <option>Regular (intermitente)</option>
                        <option>Mala (insomnio)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Horas/noche</label>
                      <input type="number" placeholder="Ej. 7" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-teal-500 focus:border-teal-500 outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Consumo de Alcohol</label>
                    <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-teal-500 focus:border-teal-500 outline-none">
                      <option>Nunca</option>
                      <option>Ocasional (1-2 veces/mes)</option>
                      <option>Frecuente (fines de semana)</option>
                      <option>Diario</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Tabaquismo</label>
                      <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-teal-500 focus:border-teal-500 outline-none">
                        <option>No fumador</option>
                        <option>Ex-fumador</option>
                        <option>Fumador activo</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Estrés (1-10)</label>
                      <input type="number" min="1" max="10" placeholder="Nivel" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-teal-500 focus:border-teal-500 outline-none" />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Consumo de Café</label>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                        <input type="checkbox" className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer" />
                        <span className="font-medium">Toma Café</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <input type="number" min="0" placeholder="0" className="w-16 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-teal-500 focus:border-teal-500 outline-none" />
                        <span className="text-sm text-slate-600">Tazas al día</span>
                      </div>
                      <div className="flex-1 w-full">
                        <input type="text" placeholder="¿Cómo lo toma? (Ej. con azúcar, leche entera...)" className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Acordeón 3: Hábitos y Conducta Alimentaria */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <button 
                onClick={() => toggleSection('alimentacion')}
                className="w-full px-6 py-4 flex items-center justify-between bg-slate-50 hover:bg-slate-100/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                    <Scale className="w-4 h-4" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">3. Hábitos y Conducta Alimentaria</h3>
                </div>
                {anamnesisSections.alimentacion ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>

              {anamnesisSections.alimentacion && (
                <div className="p-6 border-t border-slate-200 space-y-6">
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Comidas al día</label>
                      <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-teal-500 focus:border-teal-500 outline-none">
                        <option>1-2 comidas</option>
                        <option>3 comidas</option>
                        <option>4-5 comidas (con snacks)</option>
                        <option>Más de 5</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Frec. Comidas fuera de casa</label>
                      <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-teal-500 focus:border-teal-500 outline-none">
                        <option>Casi nunca</option>
                        <option>1-2 veces por semana</option>
                        <option>Frecuentemente (3+ veces)</option>
                        <option>Todos los días</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Ayuno intermitente</label>
                      <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-teal-500 focus:border-teal-500 outline-none">
                        <option>No practica</option>
                        <option>Sí (12 horas)</option>
                        <option>Sí (14-16 horas)</option>
                        <option>Sí (Más de 16 horas)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Consumo Hídrico</label>
                      <input type="text" placeholder="Ej. 1.5 Litros al día" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Preferencias Alimentarias</label>
                      <textarea rows="2" placeholder="Ej. Le encantan los lácteos, prefiere comida salada..." className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-teal-500 focus:border-teal-500 outline-none resize-none transition-colors"></textarea>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Rechazos / Alergias / Intolerancias</label>
                      <textarea rows="2" placeholder="Ej. Alergia al maní, intolerancia a la lactosa, no le gusta el brócoli..." className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-teal-500 focus:border-teal-500 outline-none resize-none transition-colors"></textarea>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
                      Ansiedad / Antojos
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Conductual</span>
                    </label>
                    <textarea rows="2" placeholder="¿En qué horario suele tener atracones o antojos? ¿Dulce o salado?" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-teal-500 focus:border-teal-500 outline-none resize-none transition-colors"></textarea>
                  </div>

                  {/* Recordatorio 24 horas */}
                  <div className="mt-6">
                    <label className="block text-sm font-semibold text-slate-700 mb-3">Recordatorio de 24 horas</label>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                      <table className="w-full text-left border-collapse text-sm bg-white">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-600 bg-slate-50">
                            <th className="px-4 py-3 font-semibold whitespace-nowrap w-48">Toma / Horario</th>
                            <th className="px-4 py-3 font-semibold whitespace-nowrap min-w-[200px]">Alimentos y Preparación</th>
                            <th className="px-4 py-3 font-semibold whitespace-nowrap min-w-[150px]">Cantidad / Porción Estimada</th>
                            <th className="px-4 py-3 font-semibold whitespace-nowrap min-w-[200px]">Lugar / Observaciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {['Desayuno', 'Media Mañana', 'Almuerzo / Comida', 'Merienda / Tarde', 'Cena'].map((toma) => (
                            <tr key={toma}>
                              <td className="px-4 py-2 align-top">
                                <div className="font-medium text-slate-800 mb-1">{toma}</div>
                                <input type="time" className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs focus:ring-teal-500 focus:border-teal-500 outline-none" />
                              </td>
                              <td className="px-4 py-2 align-top">
                                <textarea rows="2" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-teal-500 focus:border-teal-500 outline-none resize-none" placeholder="Ej. Huevos revueltos..."></textarea>
                              </td>
                              <td className="px-4 py-2 align-top">
                                <textarea rows="2" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-teal-500 focus:border-teal-500 outline-none resize-none" placeholder="Ej. 2 unidades..."></textarea>
                              </td>
                              <td className="px-4 py-2 align-top">
                                <textarea rows="2" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-teal-500 focus:border-teal-500 outline-none resize-none" placeholder="En casa, con apuro..."></textarea>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* Acción de Guardado */}
            <div className="flex justify-end pt-4 pb-8">
              <button className="flex items-center gap-2 bg-teal-600 text-white px-8 py-3 rounded-xl font-semibold text-sm hover:bg-teal-700 shadow-sm shadow-teal-200 transition-colors cursor-pointer">
                <Save className="w-4 h-4" />
                Guardar Anamnesis Completa
              </button>
            </div>

          </div>
        )}

        {/* ================================================================
            PESTAÑA: ANTROPOMETRÍA CLINICA (NUEVA)
            ================================================================ */}
        {activeTab === 'antropometria' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-2 fade-in duration-300">
            
            {/* Cabecera Antropometría */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Seguimiento Antropométrico</h2>
                <p className="text-sm text-slate-500">Histórico de mediciones y composición corporal</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center justify-center gap-2 bg-teal-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-teal-700 shadow-sm shadow-teal-200 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Registrar Nueva Medición
              </button>
            </div>

            {/* Tabla Histórico */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50">
                      <th className="px-6 py-4 whitespace-nowrap">Fecha</th>
                      <th className="px-4 py-4 whitespace-nowrap">Peso (kg)</th>
                      <th className="px-4 py-4 whitespace-nowrap">% Grasa</th>
                      <th className="px-4 py-4 whitespace-nowrap">Masa Musc. (kg)</th>
                      <th className="px-4 py-4 whitespace-nowrap">Cintura (cm)</th>
                      <th className="px-4 py-4 whitespace-nowrap">Cadera (cm)</th>
                      <th className="px-6 py-4 whitespace-nowrap">IMC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {antropometriaHistory.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-3 font-semibold text-slate-900">{row.fecha}</td>
                        <td className="px-4 py-3 text-slate-700">{row.peso}</td>
                        <td className="px-4 py-3 text-slate-700 font-medium text-amber-700">{row.grasa}</td>
                        <td className="px-4 py-3 text-slate-700 font-medium text-emerald-700">{row.muscular}</td>
                        <td className="px-4 py-3 text-slate-700">{row.cintura}</td>
                        <td className="px-4 py-3 text-slate-700">{row.cadera}</td>
                        <td className="px-6 py-3">
                          <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-xs font-bold">
                            {row.imc}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Layout Dividido para Visualización Estática (última medición) */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              
              {/* Esquemático Corporal (SVG Realista) */}
              <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col items-center relative min-h-[480px]">
                <h3 className="text-[15px] font-black text-slate-500 uppercase tracking-wide mb-6 mt-2 text-center w-full">Puntos de Referencia</h3>
                
                {/* Contenedor relativo para el SVG y las etiquetas */}
                <div className="relative w-full flex-1 max-w-[280px] mx-auto flex items-center justify-center">
                  
                  {/* SVG Silueta Humana Realista */}
                  <svg viewBox="0 0 200 420" className="w-full h-full drop-shadow-sm">
                    {/* Silueta Humana dependiente del género (Construida con vectores limpios) */}
                    {pacienteData.sexo === 'M' || pacienteData.sexo === 'masculino' ? (
                      <image href="/silueta-masculina.png" x="0" y="0" width="200" height="420" preserveAspectRatio="xMidYMid meet" />
                    ) : (
                      <image href="/silueta-femenina.png" x="0" y="0" width="200" height="420" preserveAspectRatio="xMidYMid meet" />
                    )}

                  </svg>
                  

                </div>
              </div>

              {/* Paneles de Datos Última Medición */}
              <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Panel Circunferencias */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-slate-500" />
                    <h3 className="font-bold text-slate-800 text-sm">Circunferencias (cm) - Última Med.</h3>
                  </div>
                  <div className="p-0">
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-100">
                        {['Cuello', 'Pecho/Tórax', 'Brazo (rel)', 'Cintura', 'Abdomen', 'Cadera', 'Muslo', 'Pantorrilla'].map((item) => (
                          <tr key={item} className="hover:bg-slate-50">
                            <td className="px-5 py-2.5 text-slate-600 font-medium">{item}</td>
                            <td className="px-5 py-2.5 text-right font-bold text-slate-900">--</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Panel Pliegues y Composición */}
                <div className="space-y-6">
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                      <Target className="w-4 h-4 text-slate-500" />
                      <h3 className="font-bold text-slate-800 text-sm">Composición Corporal</h3>
                    </div>
                    <div className="p-5 grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <p className="text-xs font-bold text-slate-500 uppercase">Masa Grasa</p>
                        <p className="text-xl font-black text-amber-600 mt-1">22.5 <span className="text-sm font-medium">%</span></p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <p className="text-xs font-bold text-slate-500 uppercase">Masa Muscular</p>
                        <p className="text-xl font-black text-emerald-600 mt-1">35.1 <span className="text-sm font-medium">kg</span></p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <p className="text-xs font-bold text-slate-500 uppercase">IMC</p>
                        <p className="text-xl font-black text-slate-800 mt-1">25.7</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <p className="text-xs font-bold text-slate-500 uppercase">Índice C/C</p>
                        <p className="text-xl font-black text-slate-800 mt-1">0.86</p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            PESTAÑA: SEGUIMIENTO CLINICO (NUEVA)
            ================================================================ */}
        {activeTab === 'seguimiento' && (
          <SeguimientoClinico pacienteId={id} />
        )}

        {/* ================================================================
            PESTAÑA: CITAS PACIENTE (NUEVA)
            ================================================================ */}
        {activeTab === 'citas' && (
          <CitasPaciente pacienteId={id} tenantId={paciente?.tenant_id} />
        )}

        {/* ================================================================
            PESTAÑA: PLAN NUTRICIONAL
            ================================================================ */}
        {activeTab === 'plan' && (
          <PlanNutricional
            pacienteId={id}
            tenantId={paciente?.tenant_id}
            pacienteData={pacienteData}
            planCargado={planCargado}
            clearPlanCargado={() => setPlanCargado(null)}
          />
        )}

        {/* ================================================================
            PESTAÑA: HISTORIAL DE PLANES NUTRICIONALES
            ================================================================ */}
        {activeTab === 'historial' && (
          <HistorialPlanes 
            pacienteId={id} 
            onCargarPlan={handleCargarPlan}
          />
        )}

      </div>

      {/* ================================================================
          MODAL: NUEVA MEDICIÓN ANTROPOMÉTRICA
          ================================================================ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Header Modal */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="bg-teal-100 p-2 rounded-lg text-teal-600">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Registrar Nueva Medición</h2>
                  <p className="text-sm text-slate-500">Completa los campos necesarios. Los cálculos se harán automáticamente.</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body Modal (Form) */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
              <form id="antroForm" onSubmit={handleGuardarMedicion} className="space-y-8">
                
                {/* Sección 1: Datos Generales */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-teal-500"></span> Datos Generales
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Peso (kg) *</label>
                      <input required name="peso" type="number" step="0.1" value={formAntro.peso} onChange={handleAntroChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-teal-500 focus:border-teal-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Talla (cm) *</label>
                      <input required name="talla" type="number" step="0.1" value={formAntro.talla} onChange={handleAntroChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-teal-500 focus:border-teal-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">IMC Calc.</label>
                      <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm font-bold text-slate-600">{imcCalc}</div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha</label>
                      <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-600">{new Date().toLocaleDateString()}</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Sección 2: Circunferencias */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span> Circunferencias (cm)
                    </h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      {[
                        {label: 'Cuello', name: 'c_cuello'}, {label: 'Tórax', name: 'c_torax'},
                        {label: 'Brazo Relajado', name: 'c_brazo_rel'}, {label: 'Brazo Contraído', name: 'c_brazo_con'},
                        {label: 'Cintura', name: 'c_cintura'}, {label: 'Abdomen', name: 'c_abdomen'},
                        {label: 'Cadera', name: 'c_cadera'}, {label: 'Muslo', name: 'c_muslo'},
                        {label: 'Pantorrilla', name: 'c_pantorrilla'}
                      ].map(field => (
                        <div key={field.name}>
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">{field.label}</label>
                          <input name={field.name} type="number" step="0.1" value={formAntro[field.name]} onChange={handleAntroChange} className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-teal-500 focus:border-teal-500 outline-none" />
                        </div>
                      ))}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Índice C/C Calc.</label>
                        <input name="icc" type="text" readOnly value={iccCalc} className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none" />
                      </div>
                    </div>
                  </div>

                  {/* Sección 3: Pliegues Cutáneos */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span> Pliegues Cutáneos (mm)
                    </h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      {[
                        {label: 'Tricipital', name: 'p_tricipital'}, {label: 'Bicipital', name: 'p_bicipital'},
                        {label: 'Subescapular', name: 'p_subescapular'}, {label: 'Suprailiaco', name: 'p_suprailiaco'},
                        {label: 'Abdominal', name: 'p_abdominal'}, {label: 'Muslo', name: 'p_muslo'},
                        {label: 'Pantorrilla', name: 'p_pantorrilla'}
                      ].map(field => (
                        <div key={field.name}>
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">{field.label}</label>
                          <input name={field.name} type="number" step="0.1" value={formAntro[field.name]} onChange={handleAntroChange} className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-teal-500 focus:border-teal-500 outline-none" />
                        </div>
                      ))}
                    </div>

                    {/* Previsualización Composición */}
                    <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                      <p className="text-xs font-semibold text-slate-500 mb-2">PROYECCIÓN AUTOMÁTICA</p>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-700">% Grasa: <span className="text-amber-600">{grasaCalc}</span></span>
                        <span className="text-sm font-bold text-slate-700">Índice C/C: <span className="text-slate-900">{iccCalc}</span></span>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* Footer Modal */}
            <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end gap-3">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer">
                Cancelar
              </button>
              <button type="submit" form="antroForm" className="flex items-center gap-2 bg-teal-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-teal-700 shadow-sm shadow-teal-200 transition-colors cursor-pointer">
                <Check className="w-4 h-4" />
                Guardar Ficha
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
