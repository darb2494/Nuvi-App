import React, { forwardRef } from 'react'
import { FileText, Utensils, Ruler, Dumbbell, Activity } from 'lucide-react'

const printStyles = `
  @media print {
    @page {
      margin: 15mm 15mm 25mm 15mm;
      size: A4;
    }
    body {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .print-header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 25mm;
    }
    .print-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 20mm;
    }
    .print-content {
      margin-top: 25mm;
    }
  }
`

const DossierIntegralPrint = forwardRef(({ data, datos, config = {} }, ref) => {
  const patientData = data || datos
  const activeConfig = config || {}
  if (!patientData) return null

  // Helper para formato de números
  const fmt = (val, dec = 1) => (val != null && isFinite(val) ? Number(val).toFixed(dec).replace('.', ',') : '--')
  const fecha = patientData.fecha || new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })

  // Mocks o mapeos temporales basados en los datos del historial
  const SeccionBasicos = () => (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
        <FileText className="w-5 h-5 text-slate-700" />
        <h2 className="text-lg font-black text-slate-800 uppercase">Datos Básicos y Anamnesis</h2>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="border border-slate-200 p-4 rounded-lg bg-slate-50">
          <p className="text-slate-500 font-bold mb-1">Motivo de Consulta</p>
          <p className="text-slate-800">Evaluación y control nutricional ({fecha}).</p>
        </div>
        <div className="border border-slate-200 p-4 rounded-lg bg-slate-50">
          <p className="text-slate-500 font-bold mb-1">Observaciones</p>
          <p className="text-slate-800">Paciente asiste a control regular.</p>
        </div>
      </div>
    </div>
  )

  const SeccionPlan = () => (
    <div className="print:break-before-page mb-8 pt-4">
      <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
        <Utensils className="w-5 h-5 text-amber-600" />
        <h2 className="text-lg font-black text-slate-800 uppercase">Plan Nutricional</h2>
      </div>
      <div className="text-sm">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg text-center">
            <span className="block text-amber-700 font-bold text-xs uppercase">Calorías</span>
            <span className="text-lg font-black text-amber-900">2200 kcal</span>
          </div>
          <div className="bg-rose-50 border border-rose-100 p-3 rounded-lg text-center">
            <span className="block text-rose-700 font-bold text-xs uppercase">Proteínas</span>
            <span className="text-lg font-black text-rose-900">140 g</span>
          </div>
          <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-center">
            <span className="block text-blue-700 font-bold text-xs uppercase">Carbohidratos</span>
            <span className="text-lg font-black text-blue-900">250 g</span>
          </div>
        </div>
        <p className="text-slate-500 italic text-xs">* El menú detallado se adjunta según los requerimientos anteriores.</p>
      </div>
    </div>
  )

  const SeccionAntropometria = () => (
    <div className="print:break-before-page mb-8 pt-4">
      <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
        <Ruler className="w-5 h-5 text-teal-600" />
        <h2 className="text-lg font-black text-slate-800 uppercase">Antropometría y Composición Corporal</h2>
      </div>
      <div className="border border-slate-200 rounded-lg p-4 mb-4">
        <h3 className="font-bold text-teal-700 text-sm uppercase tracking-wider mb-3 border-b border-slate-100 pb-2">Resultados Generales</h3>
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-slate-300">
              <th className="py-2">Métrica</th>
              <th className="py-2 text-right">Resultado</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="py-2 font-medium">Peso Total</td>
              <td className="py-2 text-right font-bold text-slate-800">{fmt(patientData.peso)} kg</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-2 font-medium">Porcentaje de Grasa</td>
              <td className="py-2 text-right font-bold text-rose-600">{fmt(patientData.porcentajeGrasa)} %</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-2 font-medium">Masa Muscular</td>
              <td className="py-2 text-right font-bold text-teal-600">{fmt(patientData.masaMuscular)} kg</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-2 font-medium">Índice Cintura-Cadera (ICC)</td>
              <td className="py-2 text-right font-bold">{fmt(patientData.icc, 2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )

  const SeccionIndices = () => (
    <div className="print:break-before-page mb-8 pt-4">
      <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
        <Activity className="w-5 h-5 text-indigo-600" />
        <h2 className="text-lg font-black text-slate-800 uppercase">Índices Clínicos Avanzados</h2>
      </div>
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="border border-slate-200 p-3 rounded-lg"><span className="text-slate-500 block">ICC (Cintura/Cadera)</span><span className="font-bold text-sm">{fmt(patientData.icc, 2)}</span></div>
        <div className="border border-slate-200 p-3 rounded-lg"><span className="text-slate-500 block">Índice Adiposo/Muscular</span><span className="font-bold text-sm">--</span></div>
      </div>
    </div>
  )

  return (
    <div ref={ref} className="print:w-full print:bg-white print:text-black">
      <style>{printStyles}</style>

      {/* REPEATING HEADER GLOBAL */}
      <div className="print-header flex items-center justify-between border-b-2 border-slate-800 pb-2 bg-white z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center font-black">N</div>
          <div>
            <h1 className="text-lg font-black text-slate-900 leading-none">Dossier Integral del Paciente</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Expediente Clínico Nuvi</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-slate-800">Fecha de Consulta: {fecha}</p>
          <p className="text-[10px] text-slate-500 font-medium">{patientData.nombre || 'Especialista Tratante'}</p>
        </div>
      </div>

      {/* REPEATING FOOTER */}
      <div className="print-footer flex flex-col items-center justify-end bg-white z-50 pt-2 border-t border-slate-200">
        <p className="text-[9px] text-slate-400">Generado automáticamente vía Nuvi - Sistema de Gestión Nutricional</p>
      </div>

      {/* CONTENIDO CON PADDING SUPERIOR */}
      <div className="print-content text-sm print:pt-4">
        
        {activeConfig.basicos && <SeccionBasicos />}
        {activeConfig.plan && <SeccionPlan />}
        {activeConfig.antropometria && <SeccionAntropometria />}
        {activeConfig.indices && <SeccionIndices />}

      </div>
    </div>
  )
})

export default DossierIntegralPrint
