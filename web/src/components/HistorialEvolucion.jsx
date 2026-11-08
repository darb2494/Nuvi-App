import React, { useState, useEffect, useRef } from 'react'
import { TrendingDown, TrendingUp, Activity, Scale, Dumbbell, User, Info, Printer, X, FileText } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import DossierIntegralPrint from './DossierIntegralPrint'
import ExportDashboardModal from './ExportDashboardModal'
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Line
} from 'recharts'
import { supabase } from '../lib/supabaseClient'

export default function HistorialEvolucion({ pacienteId }) {
  const [historialConsultas, setHistorialConsultas] = useState([])
  const [loading, setLoading] = useState(true)

  // Estado para la pestaña de métrica seleccionada
  const [metricaSeleccionada, setMetricaSeleccionada] = useState('peso')

  // Estado para Dossier Integral PDF
  const [showExportModal, setShowExportModal] = useState(false)
  const [printData, setPrintData] = useState(null)
  const [printConfig, setPrintConfig] = useState({
    basicos: true,
    plan: true,
    antropometria: true,
    indices: false
  })
  
  const printRef = useRef(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Dossier_Integral_${printData?.fecha || 'Global'}`,
    onAfterPrint: () => setShowExportModal(false)
  })

  const handleGenerarPDF = (configuracion) => {
    setPrintConfig(configuracion)
    setShowExportModal(false)
    setTimeout(() => {
      handlePrint()
    }, 150)
  }

  const openPrintModal = (registro) => {
    setPrintData(registro)
    setShowExportModal(true)
  }

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        // Primero, obtener el anamnesis_id del paciente
        const { data: anamnesis, error: anamnesisError } = await supabase
          .from('anamnesis')
          .select('id')
          .eq('paciente_id', pacienteId)
          .maybeSingle()
        
        if (anamnesisError || !anamnesis) {
          setHistorialConsultas([])
          setLoading(false)
          return
        }

        // Luego, obtener todas las medidas antropométricas
        const { data: medidas, error: medidasError } = await supabase
          .from('medidas_antropometricas')
          .select('fecha_medicion, peso_kg, masa_grasa_pct, masa_muscular_kg, indice_cintura_cadera')
          .eq('anamnesis_id', anamnesis.id)
          .order('fecha_medicion', { ascending: true }) // Importante para la gráfica (antiguo a reciente)
        
        if (medidasError) throw medidasError

        // Formatear los datos para la gráfica y la tabla
        const formattedData = (medidas || []).map(m => {
          const dateObj = new Date(m.fecha_medicion)
          // Sumar el timezone offset para evitar que salga un día antes
          dateObj.setMinutes(dateObj.getMinutes() + dateObj.getTimezoneOffset())
          
          return {
            fecha: dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
            peso: m.peso_kg ? Number(m.peso_kg) : 0,
            porcentajeGrasa: m.masa_grasa_pct ? Number(m.masa_grasa_pct) : 0,
            masaMuscular: m.masa_muscular_kg ? Number(m.masa_muscular_kg) : 0,
            icc: m.indice_cintura_cadera ? Number(m.indice_cintura_cadera) : 0
          }
        })

        setHistorialConsultas(formattedData)
      } catch (error) {
        console.error('Error al cargar historial de evolución:', error)
      } finally {
        setLoading(false)
      }
    }

    if (pacienteId) {
      fetchData()
    }
  }, [pacienteId])

  // Opciones de métricas para la gráfica
  const opcionesMetricas = [
    { id: 'peso', label: 'Peso (kg)', color: '#0f766e' },
    { id: 'porcentajeGrasa', label: 'Grasa Corporal (%)', color: '#ef4444' },
    { id: 'masaMuscular', label: 'Masa Muscular (kg)', color: '#3b82f6' },
    { id: 'icc', label: 'ICC', color: '#f59e0b' }
  ]

  const metricaActual = opcionesMetricas.find(m => m.id === metricaSeleccionada)

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
      </div>
    )
  }

  // Eliminar el early return de estado vacío (lo manejamos dentro del JSX principal)

  const isEmpty = !historialConsultas || historialConsultas.length === 0
  const primeraConsulta = !isEmpty ? historialConsultas[0] : {}
  const ultimaConsulta = !isEmpty ? historialConsultas[historialConsultas.length - 1] : {}

  const calcularDiferencia = (key, invertido = false) => {
    if (isEmpty) return { diff: 0, diffAbs: '0.0', isGood: true, diffText: '0', trendIcon: null }
    const diff = ultimaConsulta[key] - primeraConsulta[key]
    const diffAbs = Math.abs(diff).toFixed(1)
    
    // Si invertido es true (ej. masa muscular), subir es bueno
    let isGood = invertido ? diff > 0 : diff < 0
    // Si no hay cambio, lo consideramos neutral
    if (diff === 0) isGood = true 

    const diffText = diff > 0 ? `+${diffAbs}` : `-${diffAbs}`
    const trendIcon = diff > 0 ? <TrendingUp className="w-3 h-3" /> : (diff < 0 ? <TrendingDown className="w-3 h-3" /> : null)

    return { diff, diffAbs, isGood, diffText, trendIcon }
  }

  const kpis = isEmpty ? [] : [
    {
      titulo: 'Peso Actual',
      valor: ultimaConsulta.peso ? `${ultimaConsulta.peso} kg` : '--',
      icono: <Scale className="w-5 h-5 text-teal-600" />,
      analisis: calcularDiferencia('peso', false), // Bajar es bueno
      unidad: 'kg'
    },
    {
      titulo: 'Grasa Corporal',
      valor: ultimaConsulta.porcentajeGrasa ? `${ultimaConsulta.porcentajeGrasa} %` : '--',
      icono: <Activity className="w-5 h-5 text-red-500" />,
      analisis: calcularDiferencia('porcentajeGrasa', false), // Bajar es bueno
      unidad: '%'
    },
    {
      titulo: 'Masa Muscular',
      valor: ultimaConsulta.masaMuscular ? `${ultimaConsulta.masaMuscular} kg` : '--',
      icono: <Dumbbell className="w-5 h-5 text-blue-500" />,
      analisis: calcularDiferencia('masaMuscular', true), // Subir es bueno
      unidad: 'kg'
    },
    {
      titulo: 'Índice Cintura-Cadera',
      valor: ultimaConsulta.icc || '--',
      icono: <User className="w-5 h-5 text-amber-500" />,
      analisis: calcularDiferencia('icc', false), // Bajar es bueno
      unidad: ''
    }
  ]

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* 1. CABECERA FIJA Y VISIBLE SIEMPRE */}
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-600" /> Historial de Planes
          </h2>
          <p className="text-sm text-slate-500 mt-1">Evolución y documentos clínicos del paciente</p>
        </div>
        
        <button
          onClick={() => {
            if (historialConsultas.length > 0) {
              setPrintData(historialConsultas[historialConsultas.length - 1])
            }
            setShowExportModal(true)
          }}
          disabled={isEmpty}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-all whitespace-nowrap
            ${!isEmpty 
              ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-200 cursor-pointer' 
              : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'}`}
        >
          📄 Exportar Dossier
        </button>
      </div>

      {isEmpty ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex flex-col items-center justify-center text-center animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <Activity className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Aún no hay datos suficientes</h3>
          <p className="text-slate-500 max-w-md">
            Las gráficas de evolución aparecerán después de la primera consulta de control. Registra las medidas iniciales en la pestaña de Antropometría para comenzar el seguimiento.
          </p>
        </div>
      ) : (
        <>
          {/* 2. Panel Superior: Tarjetas de Progreso (KPIs) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => (
          <div key={idx} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-slate-50 rounded-xl">
                {kpi.icono}
              </div>
              <h4 className="text-sm font-semibold text-slate-600">{kpi.titulo}</h4>
            </div>
            
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-2xl font-black text-slate-900 tracking-tight">{kpi.valor}</span>
            </div>
            
            {historialConsultas.length > 1 && kpi.valor !== '--' ? (
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold ${
                  kpi.analisis.isGood 
                    ? 'bg-emerald-100 text-emerald-700' 
                    : (kpi.analisis.diff === 0 ? 'bg-slate-100 text-slate-600' : 'bg-rose-100 text-rose-700')
                }`}>
                  {kpi.analisis.trendIcon}
                  {kpi.analisis.diff === 0 ? 'Sin cambios' : `${kpi.analisis.diffText} ${kpi.unidad}`}
                </span>
                <span className="text-xs text-slate-400 font-medium">desde el inicio</span>
              </div>
            ) : (
              <span className="text-xs text-slate-400 font-medium">Datos iniciales</span>
            )}
          </div>
        ))}
      </div>

      {/* 3. Gráfica Interactiva Principal (recharts) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="font-bold text-slate-900 text-lg">Evolución de {metricaActual?.label}</h3>
          
          <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto hide-scrollbar">
            {opcionesMetricas.map(metrica => (
              <button
                key={metrica.id}
                onClick={() => setMetricaSeleccionada(metrica.id)}
                className={`flex-1 sm:flex-none whitespace-nowrap px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  metricaSeleccionada === metrica.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                {metrica.label.split(' ')[0]} {/* Versión corta para el tab */}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {historialConsultas.length === 1 ? (
            <div className="h-72 bg-slate-50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center p-6">
              <Info className="w-8 h-8 text-slate-400 mb-3" />
              <h4 className="text-slate-700 font-semibold mb-1">Se necesita otra consulta</h4>
              <p className="text-sm text-slate-500 max-w-sm">Registra al menos una segunda visita para poder trazar la línea de tendencia del progreso.</p>
            </div>
          ) : (
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historialConsultas} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="fecha" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                    dy={10}
                  />
                  <YAxis 
                    domain={['auto', 'auto']}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                    dx={-10}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: 'none', 
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                      fontWeight: 600
                    }}
                    itemStyle={{ color: '#0f172a' }}
                    labelStyle={{ color: '#64748b', marginBottom: '4px', fontSize: '12px' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey={metricaSeleccionada} 
                    name={metricaActual.label}
                    stroke={metricaActual.color} 
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                    activeDot={{ r: 8, stroke: metricaActual.color, strokeWidth: 2, fill: '#fff' }}
                    animationDuration={1500}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* 4. Tabla de Registro Histórico (Bottom) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-bold text-slate-900">Registro Histórico Detallado</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Peso</th>
                <th className="px-6 py-4">Grasa Corporal</th>
                <th className="px-6 py-4">Masa Muscular</th>
                <th className="px-6 py-4">ICC</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* Mostramos del más reciente al más antiguo */}
              {[...historialConsultas].reverse().map((registro, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">
                    {registro.fecha}
                    {idx === 0 && <span className="ml-2 inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-700 uppercase">Actual</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{registro.peso ? `${registro.peso} kg` : '--'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{registro.porcentajeGrasa ? `${registro.porcentajeGrasa} %` : '--'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{registro.masaMuscular ? `${registro.masaMuscular} kg` : '--'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{registro.icc || '--'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button onClick={() => openPrintModal(registro)} className="p-2 bg-white text-slate-500 hover:text-teal-600 border border-slate-200 rounded-lg shadow-sm transition-colors inline-flex items-center gap-2" title="Exportar Dossier a PDF">
                      <Printer className="w-4 h-4" /> <span className="text-[11px] font-bold">Dossier</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}

      {/* MODAL DE CONFIGURACIÓN DE EXPORTACIÓN DOSSIER */}
      {showExportModal && (
        <ExportDashboardModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          onExport={handleGenerarPDF}
        />
      )}

      {/* PLANTILLA MAESTRA OCULTA PARA IMPRESIÓN (Off-Screen absoluto para Recharts) */}
      <div className="absolute -left-[10000px] top-0 print:static print:block w-full">
        <DossierIntegralPrint ref={printRef} data={printData} datos={printData} config={printConfig} />
      </div>

    </div>
  )
}
