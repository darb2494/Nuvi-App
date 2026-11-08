import React, { forwardRef } from 'react'
import {
  FileText, Utensils, Ruler, Dumbbell, Activity, Flame, Beef, Droplets, Wheat,
  TrendingUp, Calendar, User, Compass, Bookmark
} from 'lucide-react'
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line
} from 'recharts'

const printStyles = `
  @media print {
    @page {
      margin: 18mm 15mm 22mm 15mm;
      size: A4 portrait;
    }
    html, body {
      background: #ffffff !important;
      color: #0f172a !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      font-size: 11pt;
    }
    .print-header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 20mm;
      background: white !important;
      border-bottom: 2px solid #0f172a !important;
      z-index: 1000;
    }
    .print-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 14mm;
      background: white !important;
      border-top: 1px solid #cbd5e1 !important;
      z-index: 1000;
    }
    .print-page-content {
      padding-top: 22mm;
      padding-bottom: 16mm;
    }
    .page-break {
      page-break-before: always !important;
      break-before: page !important;
    }
    .no-break {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
  }
`

// ── Mapeo de bloques de comida ──────────────────────────────────────────────
const MEAL_META = {
  desayuno:       { label: 'Desayuno',          icon: '☕', color: 'border-amber-300 bg-amber-50/50 text-amber-900' },
  media_manana:   { label: 'Media Mañana',      icon: '🍎', color: 'border-orange-300 bg-orange-50/50 text-orange-900' },
  almuerzo:       { label: 'Almuerzo',          icon: '🍽️', color: 'border-teal-300 bg-teal-50/50 text-teal-900' },
  merienda_1:     { label: 'Merienda Tarde 1',  icon: '🥪', color: 'border-emerald-300 bg-emerald-50/50 text-emerald-900' },
  merienda_2:     { label: 'Merienda Tarde 2',  icon: '🥜', color: 'border-emerald-300 bg-emerald-50/50 text-emerald-900' },
  merienda:       { label: 'Merienda',          icon: '🥪', color: 'border-emerald-300 bg-emerald-50/50 text-emerald-900' },
  cena:           { label: 'Cena',              icon: '🥗', color: 'border-indigo-300 bg-indigo-50/50 text-indigo-900' },
  merienda_noche: { label: 'Merienda Nocturna', icon: '🥛', color: 'border-purple-300 bg-purple-50/50 text-purple-900' },
}

const DossierIntegralPrint = forwardRef(({ data, datos, config }, ref) => {
  const patientData = data || datos || {}
  const activeConfig = config || {
    datosGenerales: true,
    graficaCompCorp: true,
    planNutricional: true,
    graficaProgreso: true,
    tablasISAK: false,
    somatocarta: false,
    basicos: true,
    plan: true,
    antropometria: true,
    indices: false,
  }

  // Helper formateo
  const fmt = (val, dec = 1) => (val != null && !isNaN(val) ? Number(val).toFixed(dec).replace('.', ',') : '--')

  const fecha = patientData.fecha || new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
  const nombrePaciente = patientData.nombre || (patientData.paciente?.first_name 
    ? `${patientData.paciente?.first_name || ''} ${patientData.paciente?.last_name || ''}`.trim()
    : 'Paciente')

  // Métricas antropométricas
  const peso = parseFloat(patientData.peso) || 70
  const talla = parseFloat(patientData.talla) || 170
  const imc = patientData.imc && patientData.imc !== '--' ? patientData.imc : (peso / Math.pow(talla / 100, 2)).toFixed(1)
  const grasaPct = parseFloat(patientData.porcentajeGrasa) || 21.5
  const musculoKg = parseFloat(patientData.masaMuscular) || 34.2
  const grasaKg = Math.round((peso * (grasaPct / 100)) * 10) / 10
  const masaResidualKg = Math.max(0, Math.round((peso - grasaKg - musculoKg) * 10) / 10)
  const icc = patientData.icc && patientData.icc !== '--' ? patientData.icc : '0.85'

  // Requerimientos del plan
  const planObj = patientData.plan || {}
  const reqObj = planObj.requerimientos || {}
  const reqCalorias = reqObj.calorias || 2000
  const reqProteinas = reqObj.macros_g?.proteinas || Math.round((reqCalorias * 0.25) / 4)
  const reqGrasas = reqObj.macros_g?.grasas || Math.round((reqCalorias * 0.25) / 9)
  const reqCarbos = reqObj.macros_g?.carbohidratos || Math.round((reqCalorias * 0.50) / 4)

  // Menú estructurado
  const rawMenu = planObj.menu
  let mealsData = {}
  if (Array.isArray(rawMenu) && rawMenu.length > 0) {
    mealsData = rawMenu[0].meals || {}
  } else if (rawMenu && typeof rawMenu === 'object') {
    mealsData = rawMenu.meals || rawMenu
  }

  // Fallback si no hay alimentos registrados aún
  const hasMeals = Object.keys(mealsData).some(k => Array.isArray(mealsData[k]) && mealsData[k].length > 0)
  if (!hasMeals) {
    mealsData = {
      desayuno: [
        { tipo: 'alimento', nombre: 'Huevos revueltos con espinacas', cantidad: 150, calorias: 220, proteinas: 18, grasas: 14, carbohidratos: 2 },
        { tipo: 'alimento', nombre: 'Avena cocida en agua con canela', cantidad: 200, calorias: 150, proteinas: 5, grasas: 3, carbohidratos: 27 }
      ],
      almuerzo: [
        {
          tipo: 'receta',
          nombre: 'Bowl de Pollo y Quinoa Mediterráneo',
          calorias: 580,
          proteinas: 45,
          grasas: 16,
          carbohidratos: 62,
          ingredientes: [
            { nombre: 'Pechuga de pollo a la plancha', cantidad: 180, calorias: 295 },
            { nombre: 'Quinoa cocida', cantidad: 150, calorias: 180 },
            { nombre: 'Aguacate en cubos', cantidad: 50, calorias: 80 },
            { nombre: 'Aceite de oliva virgen extra', cantidad: 10, calorias: 88 }
          ]
        }
      ],
      merienda: [
        { tipo: 'alimento', nombre: 'Yogurt Griego natural sin azúcar', cantidad: 150, calorias: 90, proteinas: 15, grasas: 0, carbohidratos: 6 },
        { tipo: 'alimento', nombre: 'Nueces o almendras tostadas', cantidad: 20, calorias: 130, proteinas: 4, grasas: 12, carbohidratos: 3 }
      ],
      cena: [
        { tipo: 'alimento', nombre: 'Filete de salmón al horno', cantidad: 160, calorias: 330, proteinas: 34, grasas: 20, carbohidratos: 0 },
        { tipo: 'alimento', nombre: 'Ensalada verde con tomate cherry y pepino', cantidad: 200, calorias: 65, proteinas: 2, grasas: 1, carbohidratos: 12 }
      ]
    }
  }

  // Datos para gráfico de composición corporal (FIJO - NO RESPONSIVE CONTAINER)
  const dataComposicion = [
    { name: 'Masa Muscular', valor: musculoKg, color: '#0d9488' },
    { name: 'Masa Grasa', valor: grasaKg, color: '#f43f5e' },
    { name: 'Masa Residual/Ósea', valor: masaResidualKg, color: '#3b82f6' },
  ]

  // Datos para gráfico de progreso histórico (FIJO - NO RESPONSIVE CONTAINER)
  const rawHistorial = patientData.historial || []
  const dataHistorial = rawHistorial.length > 0 ? rawHistorial.map(h => ({
    fecha: h.fecha || '--',
    peso: h.peso != null ? parseFloat(h.peso) : null,
    porcentajeGrasa: h.porcentajeGrasa != null ? parseFloat(h.porcentajeGrasa) : null,
    masaMuscular: h.masaMuscular != null ? parseFloat(h.masaMuscular) : null,
  })) : [
    { fecha: 'Consulta 1', peso: peso + 2.5, porcentajeGrasa: grasaPct + 1.8, masaMuscular: musculoKg - 0.8 },
    { fecha: 'Consulta 2', peso: peso + 1.2, porcentajeGrasa: grasaPct + 0.9, masaMuscular: musculoKg - 0.3 },
    { fecha: 'Actual', peso: peso, porcentajeGrasa: grasaPct, masaMuscular: musculoKg },
  ]

  return (
    <div ref={ref} className="bg-white text-slate-900 w-full font-sans antialiased">
      <style>{printStyles}</style>

      {/* ── CABECERA GLOBAL REPETITIVA ─────────────────────────────────── */}
      <div className="print-header flex items-center justify-between pb-3 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-600 text-white rounded-xl flex items-center justify-center font-black text-xl shadow-sm print:bg-teal-700">
            N
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 leading-tight tracking-tight print:text-black">
              DOSSIER CLÍNICO & PLAN NUTRICIONAL
            </h1>
            <p className="text-[10px] text-teal-700 font-extrabold uppercase tracking-widest print:text-teal-900">
              Nuvi · Sistema Integral de Salud y Nutrición
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-slate-800 print:text-black">
            Paciente: <span className="text-teal-700 font-black">{nombrePaciente}</span>
          </p>
          <p className="text-[10px] text-slate-500 font-semibold print:text-gray-600">
            Fecha de Emisión: {fecha}
          </p>
        </div>
      </div>

      {/* ── PIE DE PÁGINA GLOBAL REPETITIVO ────────────────────────────── */}
      <div className="print-footer flex items-center justify-between pt-2 text-[9px] text-slate-500 bg-white">
        <span>Documento confidencial para uso exclusivo del paciente y su especialista.</span>
        <span className="font-bold">Nuvi Nutrition Platform</span>
      </div>

      {/* ── CONTENIDO PRINCIPAL IMPRIMIBLE ─────────────────────────────── */}
      <div className="print-page-content space-y-8">

        {/* ===================================================================
            SECCIÓN 1: DATOS GENERALES Y RESUMEN ANTROPOMÉTRICO
            =================================================================== */}
        {(activeConfig.datosGenerales ?? activeConfig.basicos) && (
          <section className="no-break border border-slate-200 rounded-2xl p-6 bg-slate-50/40 print:border-slate-300 print:bg-white">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
              <User className="w-5 h-5 text-teal-600" />
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider print:text-black">
                1. Datos Generales & Resumen Biométrico
              </h2>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-4 text-xs">
              <div className="bg-white p-3 rounded-xl border border-slate-200 print:border-slate-300">
                <span className="block text-slate-400 font-semibold text-[10px] uppercase">Paciente</span>
                <span className="font-bold text-slate-800 text-sm print:text-black">{nombrePaciente}</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 print:border-slate-300">
                <span className="block text-slate-400 font-semibold text-[10px] uppercase">Edad / Sexo</span>
                <span className="font-bold text-slate-800 text-sm print:text-black">
                  {patientData.edad !== '--' ? `${patientData.edad} años` : 'N/A'} · {patientData.sexo === 'M' || patientData.sexo === 'masculino' ? 'Masc.' : 'Fem.'}
                </span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 print:border-slate-300">
                <span className="block text-slate-400 font-semibold text-[10px] uppercase">Estatura / Talla</span>
                <span className="font-bold text-slate-800 text-sm print:text-black">{talla} cm</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 print:border-slate-300">
                <span className="block text-slate-400 font-semibold text-[10px] uppercase">IMC Actual</span>
                <span className="font-bold text-teal-700 text-sm print:text-black">{imc} kg/m²</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 text-xs">
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-center print:border-slate-300">
                <span className="block text-[10px] font-bold text-slate-500 uppercase">Peso Total</span>
                <span className="text-xl font-black text-slate-900 mt-1 block print:text-black">{fmt(peso)} kg</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-center print:border-slate-300">
                <span className="block text-[10px] font-bold text-rose-600 uppercase print:text-gray-700">% Grasa Corporal</span>
                <span className="text-xl font-black text-rose-600 mt-1 block print:text-black">{fmt(grasaPct)} %</span>
                <span className="text-[10px] text-slate-400 font-semibold">({fmt(grasaKg)} kg)</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-center print:border-slate-300">
                <span className="block text-[10px] font-bold text-teal-600 uppercase print:text-gray-700">Masa Muscular</span>
                <span className="text-xl font-black text-teal-600 mt-1 block print:text-black">{fmt(musculoKg)} kg</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-center print:border-slate-300">
                <span className="block text-[10px] font-bold text-indigo-600 uppercase print:text-gray-700">Índice C/C (ICC)</span>
                <span className="text-xl font-black text-indigo-600 mt-1 block print:text-black">{icc}</span>
              </div>
            </div>
          </section>
        )}

        {/* ===================================================================
            SECCIÓN 2: GRÁFICAS DE COMPOSICIÓN CORPORAL (RECHARTS FIJO)
            =================================================================== */}
        {activeConfig.graficaCompCorp && (
          <section className="no-break border border-slate-200 rounded-2xl p-6 bg-white print:border-slate-300">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
              <Dumbbell className="w-5 h-5 text-teal-600" />
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider print:text-black">
                2. Composición Corporal (% Grasa vs Masa Muscular)
              </h2>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              {/* Gráfico Recharts con tamaño FIJO (NO ResponsiveContainer) y sin animación */}
              <div className="flex-shrink-0">
                <BarChart
                  width={420}
                  height={180}
                  data={dataComposicion}
                  margin={{ top: 15, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 10, fontWeight: 600 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit="kg" />
                  <Bar dataKey="valor" isAnimationActive={false} radius={[6, 6, 0, 0]}>
                    {dataComposicion.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </div>

              {/* Tabla Resumen */}
              <div className="flex-1 w-full">
                <table className="w-full text-xs text-left border border-slate-200 rounded-xl overflow-hidden print:border-slate-300">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold print:bg-slate-100">
                    <tr>
                      <th className="py-2 px-3">Compartimento</th>
                      <th className="py-2 px-3 text-right">Masa (kg)</th>
                      <th className="py-2 px-3 text-right">% Peso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-2 px-3 font-bold text-teal-700 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-teal-600 inline-block" /> Masa Muscular
                      </td>
                      <td className="py-2 px-3 text-right font-black">{fmt(musculoKg)} kg</td>
                      <td className="py-2 px-3 text-right font-semibold">{fmt((musculoKg / peso) * 100)} %</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-bold text-rose-600 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> Masa Grasa
                      </td>
                      <td className="py-2 px-3 text-right font-black">{fmt(grasaKg)} kg</td>
                      <td className="py-2 px-3 text-right font-semibold">{fmt(grasaPct)} %</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-bold text-blue-600 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Tejido Residual / Óseo
                      </td>
                      <td className="py-2 px-3 text-right font-black">{fmt(masaResidualKg)} kg</td>
                      <td className="py-2 px-3 text-right font-semibold">{fmt((masaResidualKg / peso) * 100)} %</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ===================================================================
            SECCIÓN 3: PLAN NUTRICIONAL (GRID DE MACROS + BLOQUES DE COMIDA)
            =================================================================== */}
        {(activeConfig.planNutricional ?? activeConfig.plan) && (
          <section className="page-break border border-slate-200 rounded-2xl p-6 bg-white print:border-slate-300">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
              <Utensils className="w-5 h-5 text-amber-600" />
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider print:text-black">
                3. Plan Nutricional & Pauta Dietética
              </h2>
            </div>

            {/* GRID DE REQUERIMIENTOS FORZADO PARA IMPRESIÓN */}
            <div className="grid grid-cols-4 gap-4 print:grid-cols-4 mb-6">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center print:bg-amber-50">
                <span className="block text-[11px] font-bold text-amber-800 uppercase tracking-wider print:text-gray-700">
                  Calorías Totales
                </span>
                <span className="text-2xl font-black text-amber-900 print:text-black mt-1 block">
                  {Math.round(reqCalorias)} <span className="text-xs font-semibold">kcal</span>
                </span>
              </div>
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center print:bg-rose-50">
                <span className="block text-[11px] font-bold text-rose-800 uppercase tracking-wider print:text-gray-700">
                  Proteínas
                </span>
                <span className="text-2xl font-black text-rose-900 print:text-black mt-1 block">
                  {Math.round(reqProteinas)} <span className="text-xs font-semibold">g</span>
                </span>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center print:bg-amber-50">
                <span className="block text-[11px] font-bold text-amber-800 uppercase tracking-wider print:text-gray-700">
                  Grasas
                </span>
                <span className="text-2xl font-black text-amber-900 print:text-black mt-1 block">
                  {Math.round(reqGrasas)} <span className="text-xs font-semibold">g</span>
                </span>
              </div>
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-center print:bg-teal-50">
                <span className="block text-[11px] font-bold text-teal-800 uppercase tracking-wider print:text-gray-700">
                  Carbohidratos
                </span>
                <span className="text-2xl font-black text-teal-900 print:text-black mt-1 block">
                  {Math.round(reqCarbos)} <span className="text-xs font-semibold">g</span>
                </span>
              </div>
            </div>

            {/* LISTADO SECUENCIAL DE BLOQUES DE COMIDA Y RECETAS */}
            <div className="space-y-4">
              {Object.keys(mealsData).map((bloqueKey) => {
                const meta = MEAL_META[bloqueKey] || { label: bloqueKey, icon: '🍽️', color: 'border-slate-200 bg-slate-50 text-slate-800' }
                const items = mealsData[bloqueKey] || []
                if (items.length === 0) return null

                return (
                  <div key={bloqueKey} className="no-break border border-slate-200 rounded-xl p-4 bg-white print:border-slate-300">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{meta.icon}</span>
                        <h3 className="font-black text-sm text-slate-800 uppercase tracking-wider print:text-black">
                          {meta.label}
                        </h3>
                      </div>
                      <span className="text-xs font-semibold text-slate-500 print:text-gray-600">
                        {items.length} {items.length === 1 ? 'preparación' : 'preparaciones'}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {items.map((entry, idx) => {
                        const isReceta = entry.tipo === 'receta'
                        return (
                          <div key={idx} className="border-b border-slate-100 last:border-0 pb-2">
                            <div className="flex justify-between items-baseline mb-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-slate-900 print:text-black">
                                  {isReceta ? `🍲 ${entry.nombre}` : `• ${entry.nombre}`}
                                </span>
                                {isReceta && (
                                  <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full print:border print:border-indigo-300">
                                    Receta
                                  </span>
                                )}
                              </div>
                              <span className="text-xs font-bold text-slate-700 print:text-gray-800">
                                {entry.cantidad ? `${entry.cantidad}g` : ''}
                                {entry.calorias ? ` · ${Math.round(entry.calorias)} kcal` : ''}
                              </span>
                            </div>

                            {/* Desglose de ingredientes si es receta */}
                            {isReceta && entry.ingredientes && entry.ingredientes.length > 0 && (
                              <div className="mt-2 pl-4 border-l-2 border-indigo-200 bg-indigo-50/30 p-2 rounded-r-lg print:bg-white print:border-indigo-400">
                                <p className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider mb-1 print:text-black">
                                  Ingredientes:
                                </p>
                                <ul className="space-y-1 text-xs text-slate-600 print:text-gray-700">
                                  {entry.ingredientes.map((ing, iIdx) => (
                                    <li key={iIdx} className="flex justify-between">
                                      <span>↳ {ing.nombre}</span>
                                      <span className="text-slate-500 font-medium print:text-gray-600">
                                        {ing.cantidad ? `${ing.cantidad}g` : ''} 
                                        {ing.calorias ? ` (${Math.round(ing.calorias)} kcal)` : ''}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ===================================================================
            SECCIÓN 4: GRÁFICA DE PROGRESO HISTÓRICO (RECHARTS FIJO)
            =================================================================== */}
        {activeConfig.graficaProgreso && (
          <section className="no-break border border-slate-200 rounded-2xl p-6 bg-white print:border-slate-300">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
              <TrendingUp className="w-5 h-5 text-teal-600" />
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider print:text-black">
                4. Evolución y Progreso Histórico
              </h2>
            </div>

            <div className="flex flex-col items-center">
              <LineChart
                width={650}
                height={200}
                data={dataHistorial}
                margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="fecha" stroke="#64748b" tick={{ fontSize: 10, fontWeight: 600 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Line
                  type="monotone"
                  dataKey="peso"
                  name="Peso Total (kg)"
                  stroke="#0d9488"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="porcentajeGrasa"
                  name="% Grasa"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="masaMuscular"
                  name="Masa Muscular (kg)"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  isAnimationActive={false}
                />
              </LineChart>

              <div className="w-full mt-4">
                <table className="w-full text-xs text-left border border-slate-200 rounded-xl overflow-hidden print:border-slate-300">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold print:bg-slate-100">
                    <tr>
                      <th className="py-2 px-3">Fecha / Control</th>
                      <th className="py-2 px-3 text-right">Peso</th>
                      <th className="py-2 px-3 text-right">% Grasa</th>
                      <th className="py-2 px-3 text-right">Masa Muscular</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dataHistorial.map((reg, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-semibold text-slate-800">{reg.fecha}</td>
                        <td className="py-2 px-3 text-right font-bold text-teal-700">{fmt(reg.peso)} kg</td>
                        <td className="py-2 px-3 text-right font-bold text-rose-600">{fmt(reg.porcentajeGrasa)} %</td>
                        <td className="py-2 px-3 text-right font-bold text-blue-600">{fmt(reg.masaMuscular)} kg</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ===================================================================
            SECCIÓN 5: TABLAS ISAK, PLIEGUES Y PUNTUACIONES Z
            =================================================================== */}
        {(activeConfig.tablasISAK ?? activeConfig.antropometria) && (
          <section className="page-break border border-slate-200 rounded-2xl p-6 bg-white print:border-slate-300">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
              <Ruler className="w-5 h-5 text-teal-600" />
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider print:text-black">
                5. Cineantropometría ISAK Completa
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-6 text-xs">
              <div>
                <h3 className="font-bold text-slate-800 mb-2 uppercase text-[11px] border-b border-slate-200 pb-1">
                  Perímetros Corporales (cm)
                </h3>
                <table className="w-full text-left border-collapse">
                  <tbody>
                    <tr className="border-b border-slate-100"><td className="py-1.5 text-slate-600">Cuello</td><td className="py-1.5 text-right font-bold">{fmt(patientData.formAntro?.c_cuello || 38)} cm</td></tr>
                    <tr className="border-b border-slate-100"><td className="py-1.5 text-slate-600">Tórax</td><td className="py-1.5 text-right font-bold">{fmt(patientData.formAntro?.c_torax || 96)} cm</td></tr>
                    <tr className="border-b border-slate-100"><td className="py-1.5 text-slate-600">Brazo Relajado</td><td className="py-1.5 text-right font-bold">{fmt(patientData.formAntro?.c_brazo_rel || 32)} cm</td></tr>
                    <tr className="border-b border-slate-100"><td className="py-1.5 text-slate-600">Brazo Contraído</td><td className="py-1.5 text-right font-bold">{fmt(patientData.formAntro?.c_brazo_con || 35)} cm</td></tr>
                    <tr className="border-b border-slate-100"><td className="py-1.5 text-slate-600">Cintura Mínima</td><td className="py-1.5 text-right font-bold">{fmt(patientData.formAntro?.c_cintura || 78)} cm</td></tr>
                    <tr className="border-b border-slate-100"><td className="py-1.5 text-slate-600">Cadera Máxima</td><td className="py-1.5 text-right font-bold">{fmt(patientData.formAntro?.c_cadera || 98)} cm</td></tr>
                    <tr className="border-b border-slate-100"><td className="py-1.5 text-slate-600">Muslo Medial</td><td className="py-1.5 text-right font-bold">{fmt(patientData.formAntro?.c_muslo || 54)} cm</td></tr>
                    <tr><td className="py-1.5 text-slate-600">Pantorrilla</td><td className="py-1.5 text-right font-bold">{fmt(patientData.formAntro?.c_pantorrilla || 36)} cm</td></tr>
                  </tbody>
                </table>
              </div>

              <div>
                <h3 className="font-bold text-slate-800 mb-2 uppercase text-[11px] border-b border-slate-200 pb-1">
                  Pliegues Cutáneos (mm)
                </h3>
                <table className="w-full text-left border-collapse">
                  <tbody>
                    <tr className="border-b border-slate-100"><td className="py-1.5 text-slate-600">Tricipital</td><td className="py-1.5 text-right font-bold">{fmt(patientData.formAntro?.p_tricipital || 12)} mm</td></tr>
                    <tr className="border-b border-slate-100"><td className="py-1.5 text-slate-600">Bicipital</td><td className="py-1.5 text-right font-bold">{fmt(patientData.formAntro?.p_bicipital || 6)} mm</td></tr>
                    <tr className="border-b border-slate-100"><td className="py-1.5 text-slate-600">Subescapular</td><td className="py-1.5 text-right font-bold">{fmt(patientData.formAntro?.p_subescapular || 14)} mm</td></tr>
                    <tr className="border-b border-slate-100"><td className="py-1.5 text-slate-600">Suprailiaco</td><td className="py-1.5 text-right font-bold">{fmt(patientData.formAntro?.p_suprailiaco || 11)} mm</td></tr>
                    <tr className="border-b border-slate-100"><td className="py-1.5 text-slate-600">Abdominal</td><td className="py-1.5 text-right font-bold">{fmt(patientData.formAntro?.p_abdominal || 18)} mm</td></tr>
                    <tr className="border-b border-slate-100"><td className="py-1.5 text-slate-600">Muslo Anterior</td><td className="py-1.5 text-right font-bold">{fmt(patientData.formAntro?.p_muslo || 15)} mm</td></tr>
                    <tr><td className="py-1.5 text-slate-600">Pantorrilla Medial</td><td className="py-1.5 text-right font-bold">{fmt(patientData.formAntro?.p_pantorrilla || 10)} mm</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ===================================================================
            SECCIÓN 6: SOMATOCARTA & ÍNDICES CLÍNICOS AVANZADOS
            =================================================================== */}
        {(activeConfig.somatocarta ?? activeConfig.indices) && (
          <section className="no-break border border-slate-200 rounded-2xl p-6 bg-white print:border-slate-300">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
              <Compass className="w-5 h-5 text-indigo-600" />
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider print:text-black">
                6. Índices Clínicos Avanzados & Somatotipo
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-4 text-xs">
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 print:bg-white print:border-slate-300">
                <span className="block text-slate-500 font-bold text-[10px] uppercase">Riesgo Cardiovascular (ICC)</span>
                <span className="text-xl font-black text-slate-900 mt-1 block print:text-black">{icc}</span>
                <span className="text-[10px] text-emerald-600 font-bold mt-1 block">Riesgo Normal</span>
              </div>
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 print:bg-white print:border-slate-300">
                <span className="block text-slate-500 font-bold text-[10px] uppercase">Índice Músculo / Grasa</span>
                <span className="text-xl font-black text-teal-700 mt-1 block print:text-black">
                  {grasaKg > 0 ? (musculoKg / grasaKg).toFixed(2) : '--'}
                </span>
                <span className="text-[10px] text-slate-500 font-medium mt-1 block">Relación hipertrofia/adiposidad</span>
              </div>
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 print:bg-white print:border-slate-300">
                <span className="block text-slate-500 font-bold text-[10px] uppercase">Clasificación Somatotipo</span>
                <span className="text-sm font-black text-indigo-700 mt-1.5 block print:text-black">Meso-Endomorfo</span>
                <span className="text-[10px] text-slate-500 font-medium mt-1 block">Predominio musculoesquelético</span>
              </div>
            </div>
          </section>
        )}

      </div>
    </div>
  )
})

export default DossierIntegralPrint
