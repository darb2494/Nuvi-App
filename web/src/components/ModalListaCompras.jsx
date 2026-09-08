import { useState, useMemo, useEffect } from 'react'
import { X, ShoppingCart, Copy, FileDown, MessageCircle, Check } from 'lucide-react'
import { jsPDF } from 'jspdf'

// ── Algoritmo de agrupación defensivo (Multi-Menú) ──────────────────────────
export function generarListaCompras(menus, activeBlocks, multipliers) {
  const lista = {}

  try {
    if (!Array.isArray(menus)) return []

    menus.forEach((menu, idx) => {
      const dias = multipliers[idx] || 0
      if (dias <= 0) return

      const meals = menu.meals || {}
      const bloques = Array.isArray(activeBlocks) && activeBlocks.length > 0
        ? activeBlocks
        : Object.keys(meals)

      bloques.forEach(key => {
        const entries = meals[key] || []
        if (!Array.isArray(entries)) return

        entries.forEach((entry) => {
          if (!entry || typeof entry !== 'object') return

          if (entry.tipo === 'receta') {
            const ingredientes = Array.isArray(entry.ingredientes) ? entry.ingredientes : []
            ingredientes.forEach(ing => {
              if (!ing || typeof ing !== 'object') return
              const nombre = String(ing.nombre || '').trim()
              if (!nombre) return
              const cantidad = parseFloat(ing.cantidad)
              if (isNaN(cantidad) || cantidad <= 0) return
              lista[nombre] = (lista[nombre] || 0) + cantidad * dias
            })
          } else {
            const nombre = String(entry.nombre || '').trim()
            if (!nombre) return
            const cantidad = parseFloat(entry.cantidad)
            if (isNaN(cantidad) || cantidad <= 0) return
            lista[nombre] = (lista[nombre] || 0) + cantidad * dias
          }
        })
      })
    })
  } catch (err) {
    console.error('Error en generarListaCompras:', err)
  }

  return Object.entries(lista)
    .filter(([, cantidad]) => cantidad > 0)
    .sort(([a], [b]) => a.localeCompare(b, 'es'))
    .map(([nombre, cantidad]) => ({
      nombre,
      cantidad: Math.round(cantidad * 10) / 10
    }))
}

// ── Modal Reutilizable de Lista de Compras ───────────────────────────────────
export default function ModalListaCompras({ isOpen, onClose, menus, activeBlocks }) {
  const [multipliers, setMultipliers] = useState({})
  const [copied, setCopied] = useState(false)

  // Inicializar multiplicadores
  useEffect(() => {
    if (!isOpen || !menus) return
    const initial = {}
    const count = menus.length
    if (count === 1) {
      initial[0] = 7
    } else {
      let remaining = 7
      for (let i = 0; i < count; i++) {
        if (i === count - 1) {
          initial[i] = remaining
        } else {
          const share = Math.ceil(remaining / (count - i))
          initial[i] = share
          remaining -= share
        }
      }
    }
    setMultipliers(initial)
  }, [isOpen, menus])

  const lista = useMemo(
    () => generarListaCompras(menus, activeBlocks, multipliers),
    [menus, activeBlocks, multipliers]
  )

  const totalDias = Object.values(multipliers).reduce((a, b) => a + b, 0)

  if (!isOpen) return null

  const buildTexto = () =>
    `🛒 Lista de Compras Nutricional (${totalDias} días)\n\n` +
    lista.map(item => `• ${item.nombre}: ${item.cantidad}g`).join('\n')

  // ── Copiar al portapapeles ─────────────────────────────────────────────────
  const handleCopy = async () => {
    if (lista.length === 0) return
    try {
      await navigator.clipboard.writeText(buildTexto())
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      alert('No se pudo copiar. Por favor copia el texto manualmente.')
    }
  }

  // ── Enviar por WhatsApp ───────────────────────────────────────────────────
  const handleWhatsApp = () => {
    if (lista.length === 0) return
    const url = `https://wa.me/?text=${encodeURIComponent(buildTexto())}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // ── Exportar PDF ──────────────────────────────────────────────────────────
  const handlePDF = () => {
    if (lista.length === 0) return

    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const margin = 18
    let y = margin

    // Encabezado
    doc.setFillColor(79, 70, 229)          // Indigo-600
    doc.rect(0, 0, pageW, 28, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Lista de Compras Nutricional', margin, 12)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Calculada para ${totalDias} día${totalDias > 1 ? 's' : ''}  ·  ${lista.length} ingredientes`, margin, 21)
    y = 38

    // Columnas (izq y der)
    const colW = (pageW - margin * 2 - 10) / 2
    const leftX = margin
    const rightX = margin + colW + 10
    const rowH = 9
    const half = Math.ceil(lista.length / 2)

    const drawItem = (item, x, yPos, shade) => {
      if (shade) {
        doc.setFillColor(245, 245, 255)
        doc.rect(x, yPos - 5.5, colW, rowH, 'F')
      }
      doc.setTextColor(30, 30, 30)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      // Bullet
      doc.setFillColor(79, 70, 229)
      doc.circle(x + 1.5, yPos - 1.5, 1, 'F')
      // Nombre truncado
      const truncado = doc.splitTextToSize(item.nombre, colW - 22)[0]
      doc.text(truncado, x + 5, yPos)
      // Cantidad derecha
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(79, 70, 229)
      doc.text(`${item.cantidad}g`, x + colW - 2, yPos, { align: 'right' })
    }

    lista.forEach((item, idx) => {
      const isLeft = idx < half
      const posIdx = isLeft ? idx : idx - half
      const x = isLeft ? leftX : rightX
      const yPos = y + posIdx * rowH

      // Nueva página si desborda
      const pageH = doc.internal.pageSize.getHeight()
      if (yPos > pageH - margin) {
        doc.addPage()
        y = margin
      }

      drawItem(item, x, yPos, posIdx % 2 === 1)
    })

    // Pie
    const totalY = Math.max(y + half * rowH, y + (lista.length - half) * rowH) + 10
    doc.setDrawColor(220, 220, 230)
    doc.line(margin, totalY, pageW - margin, totalY)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(150, 150, 160)
    doc.text('Generado por Nuvi · Sistema de Gestión Nutricional', pageW / 2, totalY + 6, { align: 'center' })

    doc.save(`lista-compras-${totalDias}dias.pdf`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">

        {/* Cabecera */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Lista de Compras Inteligente</h2>
              <p className="text-xs text-slate-500">Agrupa y calcula cantidades para el supermercado</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Panel de Multiplicadores */}
        <div className="px-5 pt-4 pb-3">
          <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex flex-col gap-3">
            <p className="text-sm font-semibold text-indigo-900">
              Días por cada opción:
            </p>
            <div className="flex flex-wrap items-center gap-4">
              {(menus || []).map((menu, idx) => (
                <div key={menu.id || idx} className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
                  <label className="text-xs font-semibold text-slate-600">{menu.nombre}:</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={multipliers[idx] ?? 0}
                      onChange={(e) => setMultipliers(prev => ({ ...prev, [idx]: parseInt(e.target.value) || 0 }))}
                      className="w-14 px-1 py-1 border border-slate-300 rounded-md text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>
              ))}
              
              <div className="flex items-center gap-2 ml-auto text-xs text-slate-500 font-medium bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
                <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded">
                  {totalDias} días totales
                </span>
                <span>·</span>
                <span>{lista.length} ingredientes</span>
                <span>·</span>
                <span>{lista.reduce((s, i) => s + i.cantidad, 0).toFixed(0)}g total</span>
              </div>
            </div>
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-5 pb-3">
          {lista.length === 0 ? (
            <div className="text-center py-14 text-slate-400">
              <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">No hay alimentos en el plan.</p>
              <p className="text-xs mt-1">Agrega ingredientes a los tiempos de comida para generar la lista.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
              {lista.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0 px-1 hover:bg-slate-50 rounded transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-slate-700 truncate">{item.nombre}</span>
                  </div>
                  <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg whitespace-nowrap ml-3">
                    {item.cantidad}g
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pie — 3 botones de exportación */}
        <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Cerrar
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {/* Copiar */}
            <button
              onClick={handleCopy}
              disabled={lista.length === 0}
              className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-xl font-semibold text-sm hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
              title="Copiar como texto"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
            </button>

            {/* WhatsApp */}
            <button
              onClick={handleWhatsApp}
              disabled={lista.length === 0}
              className="flex items-center gap-2 bg-[#25D366] text-white px-4 py-2 rounded-xl font-semibold text-sm hover:bg-[#1ebe5b] transition-colors cursor-pointer disabled:opacity-50 shadow-sm shadow-green-200"
              title="Enviar por WhatsApp"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </button>

            {/* PDF */}
            <button
              onClick={handlePDF}
              disabled={lista.length === 0}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl font-semibold text-sm hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50 shadow-sm shadow-red-200"
              title="Descargar PDF"
            >
              <FileDown className="w-4 h-4" />
              PDF
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
