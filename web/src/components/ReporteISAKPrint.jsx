import React, { forwardRef } from 'react'
import { Dumbbell } from 'lucide-react'

// Utilidad para forzar márgenes y layout A4 en @media print
// La cabecera fija y el footer fijo requieren márgenes en el body o en el wrapper
// para no solapar el contenido principal.
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
    .print-break-avoid {
      page-break-inside: avoid;
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
    /* Dejar espacio para header y footer en la tabla/contenido */
    .print-content {
      margin-top: 25mm;
    }
  }
`

const ReporteISAKPrint = forwardRef(({ data, calc, config }, ref) => {
  if (!data || !calc) return null

  const { form } = data
  const fecha = form.fechaMedicion || new Date().toISOString().split('T')[0]
  
  // Helpers
  const fmt = (val, dec = 1) => (val != null && isFinite(val) ? Number(val).toFixed(dec).replace('.', ',') : '--')

  return (
    <div ref={ref} className="print:w-full print:bg-white print:text-black">
      <style>{printStyles}</style>

      {/* REPEATING HEADER */}
      <div className="print-header flex items-center justify-between border-b-2 border-teal-600 pb-2 bg-white z-50">
        <div className="flex items-center gap-2">
          <Dumbbell className="w-6 h-6 text-teal-600" />
          <div>
            <h1 className="text-lg font-black text-slate-900 leading-none">Antropometría ISAK</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Expediente Clínico Nuvi</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-slate-800">Fecha: {fecha}</p>
          <p className="text-[10px] text-slate-500 font-medium">Evaluado por: Lic. Grecia Bethencourt</p>
        </div>
      </div>

      {/* REPEATING FOOTER */}
      <div className="print-footer flex flex-col items-center justify-end bg-white z-50 pt-2 border-t border-slate-200">
        <div className="w-48 border-t border-slate-400 mb-1"></div>
        <p className="text-[10px] font-bold text-slate-700">Firma del Especialista</p>
        <p className="text-[9px] text-slate-400">Generado automáticamente vía Nuvi</p>
      </div>

      {/* CONTENT */}
      <div className="print-content text-sm space-y-6 pt-4">
        
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-slate-800 uppercase tracking-wide">Reporte de Composición Corporal</h2>
          {form.notas && <p className="text-xs text-slate-600 mt-2 max-w-2xl mx-auto italic">" {form.notas} "</p>}
        </div>

        {config.resumen && (
          <div className="print-break-avoid border border-slate-200 rounded-lg p-4">
            <h3 className="font-bold text-teal-700 text-sm uppercase tracking-wider mb-3 border-b border-slate-100 pb-2">Resumen de Medidas Base</h3>
            <div className="grid grid-cols-4 gap-4 text-xs">
              <div><span className="text-slate-500 block">Masa</span><span className="font-bold">{fmt(form.masa)} kg</span></div>
              <div><span className="text-slate-500 block">Talla</span><span className="font-bold">{fmt(form.talla)} cm</span></div>
              <div><span className="text-slate-500 block">Sum 6 Pliegues</span><span className="font-bold">{fmt(calc.suma6)} mm</span></div>
              <div><span className="text-slate-500 block">Sum 8 Pliegues</span><span className="font-bold">{fmt(calc.suma8)} mm</span></div>
            </div>
          </div>
        )}

        {config.composicion && (
          <div className="print-break-avoid">
             <h3 className="font-bold text-teal-700 text-sm uppercase tracking-wider mb-3 border-b border-slate-100 pb-2">Fraccionamiento Tisular (ISAK)</h3>
             <table className="w-full text-xs text-left">
               <thead>
                 <tr className="border-b border-slate-300">
                   <th className="py-2">Componente</th>
                   <th className="py-2 text-right">Masa (kg)</th>
                   <th className="py-2 text-right">Porcentaje (%)</th>
                   <th className="py-2 text-right">Z-Score</th>
                 </tr>
               </thead>
               <tbody>
                 <tr className="border-b border-slate-100">
                   <td className="py-1">Tejido Adiposo (Kerr)</td>
                   <td className="py-1 text-right">{fmt(calc.masaAdiposa, 2)}</td>
                   <td className="py-1 text-right">{fmt(calc.masaAdiposa && form.masa ? (calc.masaAdiposa / form.masa) * 100 : null, 1)}%</td>
                   <td className="py-1 text-right">{fmt(calc.zMasaAdiposa, 2)}</td>
                 </tr>
                 <tr className="border-b border-slate-100">
                   <td className="py-1">Tejido Muscular (Lee)</td>
                   <td className="py-1 text-right">{fmt(calc.masaMuscular, 2)}</td>
                   <td className="py-1 text-right">{fmt(calc.masaMuscular && form.masa ? (calc.masaMuscular / form.masa) * 100 : null, 1)}%</td>
                   <td className="py-1 text-right">{fmt(calc.zMasaMuscular, 2)}</td>
                 </tr>
                 <tr className="border-b border-slate-100">
                   <td className="py-1">Tejido Óseo (Rocha)</td>
                   <td className="py-1 text-right">{fmt(calc.masaOsea, 2)}</td>
                   <td className="py-1 text-right">{fmt(calc.masaOsea && form.masa ? (calc.masaOsea / form.masa) * 100 : null, 1)}%</td>
                   <td className="py-1 text-right">{fmt(calc.zMasaOsea, 2)}</td>
                 </tr>
               </tbody>
             </table>
          </div>
        )}

        {config.somatotipo && (
          <div className="print-break-avoid">
            <h3 className="font-bold text-teal-700 text-sm uppercase tracking-wider mb-3 border-b border-slate-100 pb-2">Somatotipo Heath-Carter</h3>
            <div className="flex items-center gap-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="block text-slate-500 font-bold mb-1">Clasificación</span>
                <span className="text-sm font-black text-slate-800 uppercase">{calc.somatoCompleto?.label || '--'}</span>
              </div>
              <div className="flex gap-4">
                <div><span className="block text-slate-500">Endomorfia</span><span className="font-bold">{fmt(calc.endomorfia)}</span></div>
                <div><span className="block text-slate-500">Mesomorfia</span><span className="font-bold">{fmt(calc.mesomorfia)}</span></div>
                <div><span className="block text-slate-500">Ectomorfia</span><span className="font-bold">{fmt(calc.ectomorfia)}</span></div>
              </div>
            </div>
          </div>
        )}

        {config.indices && (
          <div className="print-break-avoid">
            <h3 className="font-bold text-teal-700 text-sm uppercase tracking-wider mb-3 border-b border-slate-100 pb-2">Índices Clínicos</h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div><span className="text-slate-500 block">Índice Músculo/Óseo</span><span className="font-bold">{fmt(calc.indiceMusculoOseo, 2)}</span></div>
              <div><span className="text-slate-500 block">Índice Adiposo/Muscular</span><span className="font-bold">{fmt(calc.indiceAdiposoMuscular, 2)}</span></div>
              <div><span className="text-slate-500 block">Índice de Conicidad</span><span className="font-bold">{fmt(calc.indiceConicidad, 3)}</span></div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
})

export default ReporteISAKPrint
