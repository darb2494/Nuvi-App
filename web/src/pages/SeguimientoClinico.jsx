import { useState, useEffect } from 'react'
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts'
import { Activity, Plus, X, AlertTriangle, Droplet, TestTube, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

// Mock de evolución antropométrica (para la gráfica)
const mockEvolucion = []

export default function SeguimientoClinico({ pacienteId }) {
  const [laboratorios, setLaboratorios] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formLab, setFormLab] = useState({
    fecha_examen: new Date().toISOString().split('T')[0],
    glucosa: '',
    colesterol_total: '',
    hdl: '',
    ldl: '',
    trigliceridos: '',
    insulina: '',
    notas: ''
  })

  const fetchLaboratorios = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('laboratorios')
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('fecha_examen', { ascending: false })
      
      if (error) throw error
      setLaboratorios(data || [])
    } catch (err) {
      console.error('Error al cargar laboratorios:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (pacienteId) {
      fetchLaboratorios()
    }
  }, [pacienteId])

  const handleGuardarLab = async (e) => {
    e.preventDefault()
    setSaving(true)
    
    try {
      const payload = {
        paciente_id: pacienteId,
        fecha_examen: formLab.fecha_examen,
        glucosa: formLab.glucosa ? parseFloat(formLab.glucosa) : null,
        colesterol_total: formLab.colesterol_total ? parseFloat(formLab.colesterol_total) : null,
        hdl: formLab.hdl ? parseFloat(formLab.hdl) : null,
        ldl: formLab.ldl ? parseFloat(formLab.ldl) : null,
        trigliceridos: formLab.trigliceridos ? parseFloat(formLab.trigliceridos) : null,
        insulina: formLab.insulina ? parseFloat(formLab.insulina) : null,
        notas: formLab.notas || null
      }

      const { error } = await supabase
        .from('laboratorios')
        .insert([payload])

      if (error) throw error

      setIsModalOpen(false)
      setFormLab({
        fecha_examen: new Date().toISOString().split('T')[0],
        glucosa: '', colesterol_total: '', hdl: '', ldl: '', trigliceridos: '', insulina: '', notas: ''
      })
      
      fetchLaboratorios()
    } catch (err) {
      console.error('Error guardando laboratorio:', err)
      alert('Error al guardar el examen de laboratorio.')
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (e) => {
    setFormLab({ ...formLab, [e.target.name]: e.target.value })
  }

  // Helper para rangos clínicos
  const getValorStatus = (clave, valor) => {
    if (valor === null || valor === undefined) return { alert: false, text: '--' }
    
    let alert = false
    switch(clave) {
      case 'glucosa': alert = valor > 100 || valor < 70; break;
      case 'colesterol_total': alert = valor > 200; break;
      case 'ldl': alert = valor > 130; break;
      case 'hdl': alert = valor < 40; break;
      case 'trigliceridos': alert = valor > 150; break;
      case 'insulina': alert = valor > 25; break; // Aproximado
      default: break;
    }

    return {
      alert,
      text: valor,
      className: alert ? 'text-red-500 font-bold' : 'text-slate-700'
    }
  }

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-2 fade-in duration-300 pb-12">
      
      {/* ── Sección A: Gráficas de Evolución ──────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-teal-600" /> Gráficas de Evolución
            </h2>
            <p className="text-sm text-slate-500">Histórico antropométrico principal</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockEvolucion} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                <YAxis yAxisId="left" domain={['dataMin - 2', 'dataMax + 2']} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" domain={['dataMin - 2', 'dataMax + 2']} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontWeight: 600 }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Line yAxisId="left" type="monotone" name="Peso (kg)" dataKey="peso" stroke="#0d9488" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                <Line yAxisId="right" type="monotone" name="% Grasa Corporal" dataKey="grasa" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* ── Sección B: Perfil Bioquímico ─────────────────────────────── */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <TestTube className="w-5 h-5 text-indigo-600" /> Perfil Bioquímico
            </h2>
            <p className="text-sm text-slate-500">Histórico de exámenes de laboratorio</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Registrar Examen
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Cargando laboratorios...</div>
          ) : laboratorios.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <Droplet className="w-12 h-12 text-indigo-100 mb-3" />
              <p className="text-slate-500 font-medium">No hay exámenes de laboratorio registrados.</p>
              <button onClick={() => setIsModalOpen(true)} className="mt-4 text-indigo-600 font-semibold text-sm hover:underline">
                Añadir el primer examen
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                    <th className="px-5 py-3 whitespace-nowrap">Fecha Examen</th>
                    <th className="px-4 py-3 whitespace-nowrap">Glucosa <span className="text-[10px] font-normal text-slate-400 block">(mg/dL)</span></th>
                    <th className="px-4 py-3 whitespace-nowrap">Colesterol Tot. <span className="text-[10px] font-normal text-slate-400 block">(mg/dL)</span></th>
                    <th className="px-4 py-3 whitespace-nowrap">HDL <span className="text-[10px] font-normal text-slate-400 block">(mg/dL)</span></th>
                    <th className="px-4 py-3 whitespace-nowrap">LDL <span className="text-[10px] font-normal text-slate-400 block">(mg/dL)</span></th>
                    <th className="px-4 py-3 whitespace-nowrap">Triglicéridos <span className="text-[10px] font-normal text-slate-400 block">(mg/dL)</span></th>
                    <th className="px-4 py-3 whitespace-nowrap">Insulina <span className="text-[10px] font-normal text-slate-400 block">(µU/mL)</span></th>
                    <th className="px-5 py-3 min-w-[200px]">Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {laboratorios.map((lab) => (
                    <tr key={lab.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3 font-semibold text-slate-900">{lab.fecha_examen}</td>
                      <td className={`px-4 py-3 ${getValorStatus('glucosa', lab.glucosa).className}`}>
                        {getValorStatus('glucosa', lab.glucosa).text}
                      </td>
                      <td className={`px-4 py-3 ${getValorStatus('colesterol_total', lab.colesterol_total).className}`}>
                        {getValorStatus('colesterol_total', lab.colesterol_total).text}
                      </td>
                      <td className={`px-4 py-3 ${getValorStatus('hdl', lab.hdl).className}`}>
                        {getValorStatus('hdl', lab.hdl).text}
                      </td>
                      <td className={`px-4 py-3 ${getValorStatus('ldl', lab.ldl).className}`}>
                        {getValorStatus('ldl', lab.ldl).text}
                      </td>
                      <td className={`px-4 py-3 ${getValorStatus('trigliceridos', lab.trigliceridos).className}`}>
                        {getValorStatus('trigliceridos', lab.trigliceridos).text}
                      </td>
                      <td className={`px-4 py-3 ${getValorStatus('insulina', lab.insulina).className}`}>
                        {getValorStatus('insulina', lab.insulina).text}
                      </td>
                      <td className="px-5 py-3 text-slate-600 text-xs">{lab.notas || '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-3 bg-slate-50 text-[10px] text-slate-400 flex items-center justify-end gap-1.5 border-t border-slate-100">
                <AlertTriangle className="w-3 h-3 text-red-500" /> Los valores marcados en <span className="text-red-500 font-bold">rojo</span> se encuentran fuera de los rangos clínicos óptimos recomendados.
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Modal: Registrar Laboratorio ──────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                  <TestTube className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Registrar Examen Bioquímico</h2>
                  <p className="text-sm text-slate-500">Ingresa los valores reportados en el examen.</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
              <form id="labForm" onSubmit={handleGuardarLab} className="space-y-6">
                
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha del Examen</label>
                    <input 
                      type="date" 
                      name="fecha_examen" 
                      required 
                      value={formLab.fecha_examen} 
                      onChange={handleChange} 
                      className="w-full max-w-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors" 
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Glucosa (mg/dL)</label>
                      <input type="number" step="0.1" name="glucosa" value={formLab.glucosa} onChange={handleChange} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Insulina (µU/mL)</label>
                      <input type="number" step="0.1" name="insulina" value={formLab.insulina} onChange={handleChange} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Colesterol Total (mg/dL)</label>
                      <input type="number" step="0.1" name="colesterol_total" value={formLab.colesterol_total} onChange={handleChange} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">HDL (mg/dL)</label>
                      <input type="number" step="0.1" name="hdl" value={formLab.hdl} onChange={handleChange} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">LDL (mg/dL)</label>
                      <input type="number" step="0.1" name="ldl" value={formLab.ldl} onChange={handleChange} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Triglicéridos (mg/dL)</label>
                      <input type="number" step="0.1" name="trigliceridos" value={formLab.trigliceridos} onChange={handleChange} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                    </div>
                  </div>

                  <div className="mt-5">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Notas Clínicas o Alteraciones (Opcional)</label>
                    <textarea 
                      rows="2" 
                      name="notas" 
                      value={formLab.notas} 
                      onChange={handleChange} 
                      placeholder="Ej. Alteraciones tiroideas, paciente en ayuno de 12h, etc."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                    />
                  </div>
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
                form="labForm"
                disabled={saving}
                className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-colors cursor-pointer disabled:opacity-70"
              >
                {saving ? 'Guardando...' : 'Guardar Resultados'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
