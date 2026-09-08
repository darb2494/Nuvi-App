import { useState, useEffect } from 'react'
import { Users, CalendarDays, TrendingUp, UserPlus, CalendarPlus, Clock, ArrowRight } from 'lucide-react'
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

// ── Datos Falsos (Mock Data) ──────────────────────────────────────────────────

// Eliminado el mock data para cargar en tiempo real

// ── Componentes Pequeños ──────────────────────────────────────────────────────

function MetricCard({ title, value, icon: Icon, trend }) {
  return (
    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-col gap-4 transition-all hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600">
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <span className={`text-sm font-semibold px-2.5 py-1 rounded-full ${
            trend.startsWith('+') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
          }`}>
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-slate-500 text-sm font-medium">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>
      </div>
    </div>
  )
}

// ── Vista Principal ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate()
  
  const [citasHoy, setCitasHoy] = useState([])
  const [loadingCitas, setLoadingCitas] = useState(true)
  const [ingresosMes, setIngresosMes] = useState(0)
  const [loadingIngresos, setLoadingIngresos] = useState(true)
  
  const [pacientesActivos, setPacientesActivos] = useState(0)
  const [weeklyData, setWeeklyData] = useState([])
  const [loadingDashboard, setLoadingDashboard] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // 1. Pacientes Activos
        const { count, error: errPacientes } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'paciente')
        
        if (!errPacientes) setPacientesActivos(count || 0)

        // 2. Actividad Semanal (Últimos 7 días)
        const today = new Date()
        const days = []
        for (let i = 6; i >= 0; i--) {
          const d = new Date()
          d.setDate(today.getDate() - i)
          const offset = d.getTimezoneOffset()
          const localDate = new Date(d.getTime() - (offset * 60 * 1000))
          
          days.push({
            dayStr: d.toLocaleDateString('es-ES', { weekday: 'short' }),
            dateStr: localDate.toISOString().split('T')[0],
            patients: 0
          })
        }

        const startDate = days[0].dateStr
        const endDate = days[6].dateStr

        const { data: citasSemana, error: errCitas } = await supabase
          .from('citas')
          .select('fecha')
          .eq('estado', 'Completada')
          .gte('fecha', startDate)
          .lte('fecha', endDate)

        if (!errCitas && citasSemana) {
          citasSemana.forEach(cita => {
            const dayEntry = days.find(d => d.dateStr === cita.fecha)
            if (dayEntry) dayEntry.patients++
          })
        }

        setWeeklyData(days.map(d => ({ 
          day: d.dayStr.charAt(0).toUpperCase() + d.dayStr.slice(1).replace('.', ''), 
          patients: d.patients 
        })))

      } catch (err) {
        console.error('Error cargando métricas generales:', err)
      } finally {
        setLoadingDashboard(false)
      }
    }

    fetchDashboardData()
  }, [])

  useEffect(() => {
    const fetchIngresosMes = async () => {
      try {
        const today = new Date()
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]

        const { data, error } = await supabase
          .from('citas')
          .select('costo')
          .eq('estado', 'Completada')
          .gte('fecha', firstDay)
          .lte('fecha', lastDay)

        if (error) throw error
        
        const sum = data.reduce((acc, curr) => acc + (Number(curr.costo) || 0), 0)
        setIngresosMes(sum)
      } catch (err) {
        console.error('Error calculando ingresos:', err)
      } finally {
        setLoadingIngresos(false)
      }
    }

    fetchIngresosMes()
  }, [])

  useEffect(() => {
    const fetchCitasHoy = async () => {
      try {
        const today = new Date()
        const offset = today.getTimezoneOffset()
        const localDate = new Date(today.getTime() - (offset * 60 * 1000))
        const dateString = localDate.toISOString().split('T')[0]

        const { data, error } = await supabase
          .from('citas')
          .select(`
            id, hora, tipo_cita, estado, paciente_id, nombre_contacto,
            profiles:paciente_id(first_name, last_name)
          `)
          .eq('fecha', dateString)
          .order('hora', { ascending: true })

        if (error) throw error
        setCitasHoy(data || [])
      } catch (err) {
        console.error('Error cargando citas de hoy:', err)
      } finally {
        setLoadingCitas(false)
      }
    }

    fetchCitasHoy()
  }, [])

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      {/* ── Encabezado y Acciones Rápidas ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Panel General
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Resumen de actividad y métricas clave de tu consultorio.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/agenda', { state: { openNuevaCita: true } })}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium text-sm hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm cursor-pointer"
          >
            <CalendarPlus className="w-4 h-4" />
            Nueva Cita
          </button>
          <button 
            onClick={() => navigate('/pacientes', { state: { openNuevoPaciente: true } })}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl font-medium text-sm hover:bg-teal-700 active:bg-teal-800 transition-colors shadow-sm shadow-teal-200 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Nuevo Paciente
          </button>
        </div>
      </div>

      {/* ── Tarjetas de Métricas (Top) ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <MetricCard 
          title="Pacientes Activos" 
          value={loadingDashboard ? '-' : pacientesActivos} 
          icon={Users} 
        />
        <MetricCard 
          title="Citas para Hoy" 
          value={loadingCitas ? '-' : citasHoy.length} 
          icon={CalendarDays} 
        />
        <MetricCard 
          title="Ingresos del Mes" 
          value={loadingIngresos ? '-' : `$${ingresosMes.toLocaleString('en-US')}`} 
          icon={TrendingUp} 
        />
      </div>

      {/* ── Contenido Principal (Grid 2 Columnas) ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Columna Izquierda: Gráfico (Ocupa 2/3 en Desktop) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Actividad Semanal</h2>
              <p className="text-sm text-slate-500">Pacientes atendidos por día</p>
            </div>
            <select className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-teal-500 focus:border-teal-500 block px-3 py-1.5 cursor-pointer outline-none">
              <option>Esta semana</option>
              <option>Semana pasada</option>
            </select>
          </div>
          
          <div className="flex-1 min-h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPatients" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="day" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }} 
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#0f172a', fontWeight: 600 }}
                />
                <Area 
                  type="monotone" 
                  dataKey="patients" 
                  name="Pacientes"
                  stroke="#0d9488" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorPatients)" 
                  activeDot={{ r: 6, fill: '#0d9488', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Columna Derecha: Agenda / Citas (Ocupa 1/3 en Desktop) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden max-h-[450px]">
          <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-teal-600" />
              <h2 className="text-base font-bold text-slate-900">Agenda de Hoy</h2>
            </div>
            <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-2 py-1 rounded-md">
              {loadingCitas ? '...' : `${citasHoy.length} citas`}
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2">
            {loadingCitas ? (
              <div className="flex justify-center items-center h-40">
                <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
              </div>
            ) : citasHoy.length === 0 ? (
              <div className="p-8 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4 shadow-inner">
                  <CalendarDays className="w-8 h-8 opacity-50" />
                </div>
                <h3 className="text-slate-900 font-semibold mb-1">Tu día está libre</h3>
                <p className="text-slate-500 text-sm mb-6 max-w-[200px] leading-relaxed">
                  No tienes pacientes programados para el día de hoy.
                </p>
                <button 
                  onClick={() => navigate('/agenda', { state: { openNuevaCita: true } })}
                  className="w-full flex items-center justify-center gap-2 bg-white border-2 border-dashed border-slate-300 text-slate-600 rounded-xl px-4 py-2.5 font-medium text-sm hover:border-teal-500 hover:text-teal-700 hover:bg-teal-50 transition-all cursor-pointer"
                >
                  <CalendarPlus className="w-4 h-4" />
                  Agendar cita
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {citasHoy.map(cita => {
                  const timeStr = cita.hora ? cita.hora.substring(0, 5) : ''
                  let nombre = cita.nombre_contacto || 'Pre-registro'
                  if (cita.profiles) {
                    nombre = `${cita.profiles.first_name} ${cita.profiles.last_name || ''}`
                  }
                  
                  return (
                    <div key={cita.id} className="p-4 flex items-center gap-4 hover:bg-slate-50 rounded-xl transition-colors group">
                      <div className="bg-slate-100 text-slate-800 font-bold px-3 py-1.5 rounded-lg text-sm border border-slate-200">
                        {timeStr}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-slate-900 font-bold text-sm truncate">{nombre}</h4>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{cita.tipo_cita}</p>
                      </div>
                      {cita.paciente_id ? (
                        <Link to={`/pacientes/${cita.paciente_id}`} className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all" title="Ver Expediente">
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      ) : (
                        <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Pre
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {citasHoy.length > 0 && (
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
              <button 
                onClick={() => navigate('/agenda')}
                className="w-full flex items-center justify-center gap-2 text-teal-600 font-semibold text-sm hover:text-teal-700 transition-colors cursor-pointer py-1"
              >
                Ver agenda completa <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
