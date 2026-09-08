// src/pages/PendingApproval.jsx
//
// Pantalla de bloqueo para usuarios cuyo tenant tiene is_active = FALSE.
// Se muestra después del login cuando el pago manual aún no fue confirmado.
//
// Configura el número de WhatsApp del administrador en:
//   /web/.env → VITE_ADMIN_WHATSAPP=5219991234567
//   (formato internacional sin + ni espacios)

import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

// ── Iconos inline ─────────────────────────────────────────────────────────────

const IconClock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

const IconWhatsApp = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12.004 2.003C6.476 2.003 2 6.479 2 12.007c0 1.868.487 3.623 1.34 5.147L2 22l4.996-1.311A9.96 9.96 0 0 0 12.004 22C17.532 22 22 17.523 22 11.995c0-5.528-4.468-9.992-9.996-9.992zm0 18.188a8.18 8.18 0 0 1-4.17-1.14l-.3-.178-3.098.812.825-3.02-.196-.31a8.183 8.183 0 0 1-1.254-4.353c0-4.527 3.683-8.21 8.21-8.21 4.527 0 8.202 3.683 8.202 8.21 0 4.527-3.683 8.189-8.21 8.189z"/>
  </svg>
)

const IconRefresh = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
)

const IconLogOut = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)

// ── Datos de configuración ────────────────────────────────────────────────────

// Número de WhatsApp del administrador en formato internacional (sin +)
// Configura esto en /web/.env como VITE_ADMIN_WHATSAPP
const ADMIN_WHATSAPP = import.meta.env.VITE_ADMIN_WHATSAPP || '521XXXXXXXXXX'

// ── Componente principal ──────────────────────────────────────────────────────

export default function PendingApproval({ tenantName, userEmail, onStatusChange }) {
  const [checking, setChecking] = useState(false)
  const [checkMessage, setCheckMessage] = useState(null)

  // ── Verificar si el tenant ya fue activado ────────────────────────────────
  const handleCheckStatus = async () => {
    setChecking(true)
    setCheckMessage(null)

    const { data, error } = await supabase.rpc('fn_get_my_tenant_status')

    if (error) {
      setCheckMessage({ type: 'error', text: 'No se pudo verificar el estado. Intenta de nuevo.' })
    } else if (data?.is_active === true) {
      setCheckMessage({ type: 'success', text: '¡Tu cuenta fue activada! Redirigiendo...' })
      // Notificar a App.jsx para actualizar el estado
      setTimeout(() => onStatusChange?.(), 1500)
    } else {
      setCheckMessage({ type: 'info', text: 'Tu cuenta aún está pendiente de activación.' })
    }

    setChecking(false)
  }

  // ── Abrir WhatsApp con mensaje pre-llenado ────────────────────────────────
  const handleWhatsApp = () => {
    const message = encodeURIComponent(
      `Hola, soy *${userEmail}* y acabo de registrar el consultorio *"${tenantName || 'mi clínica'}"* en Nuvi. ` +
      `Quiero confirmar mi pago para activar mi cuenta. 🙌`
    )
    window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${message}`, '_blank', 'noopener,noreferrer')
  }

  // ── Cerrar sesión ─────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-teal-50/30 flex flex-col items-center justify-center p-6">

      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-10">
        <div className="w-9 h-9 bg-teal-600 rounded-xl flex items-center justify-center">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 12h4m4-4v8M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0z" />
          </svg>
        </div>
        <span className="text-xl font-bold text-slate-900 tracking-tight">Nuvi</span>
      </div>

      {/* Card principal */}
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-100 overflow-hidden">

        {/* Banda superior decorativa */}
        <div className="h-2 bg-gradient-to-r from-teal-500 via-cyan-400 to-teal-600" />

        <div className="p-8 flex flex-col items-center gap-6 text-center">

          {/* Ícono de estado */}
          <div className="relative">
            <div className="w-20 h-20 bg-amber-50 border-2 border-amber-200 rounded-full flex items-center justify-center text-amber-500">
              <IconClock />
            </div>
            {/* Pulso animado */}
            <span className="absolute inset-0 rounded-full border-2 border-amber-300 animate-ping opacity-40" />
          </div>

          {/* Título */}
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold text-slate-900">
              Cuenta pendiente de activación
            </h1>
            {tenantName && (
              <p className="text-sm text-slate-500">
                Consultorio:{' '}
                <span className="font-semibold text-slate-700">{tenantName}</span>
              </p>
            )}
          </div>

          {/* Descripción */}
          <p className="text-slate-500 text-sm leading-relaxed max-w-sm">
            Tu registro fue exitoso. Para activar tu cuenta y acceder al panel de Nuvi, 
            confirma tu pago con el administrador por WhatsApp.
          </p>

          {/* Pasos del proceso */}
          <div className="w-full bg-slate-50 rounded-2xl p-4 text-left">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Proceso de activación
            </p>
            <ol className="flex flex-col gap-3">
              {[
                { step: '1', label: 'Registro completado', done: true },
                { step: '2', label: 'Confirmar pago con el administrador', done: false, active: true },
                { step: '3', label: 'Cuenta activada — acceso total', done: false },
              ].map(({ step, label, done, active }) => (
                <li key={step} className="flex items-center gap-3">
                  <span className={`
                    w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                    ${done   ? 'bg-teal-500 text-white' : ''}
                    ${active ? 'bg-amber-400 text-white' : ''}
                    ${!done && !active ? 'bg-slate-200 text-slate-400' : ''}
                  `}>
                    {done ? '✓' : step}
                  </span>
                  <span className={`text-sm ${done ? 'text-teal-700 font-medium' : active ? 'text-amber-700 font-semibold' : 'text-slate-400'}`}>
                    {label}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* Mensaje de verificación de estado */}
          {checkMessage && (
            <div className={`
              w-full rounded-xl px-4 py-3 text-sm font-medium
              ${checkMessage.type === 'success' ? 'bg-teal-50 text-teal-700 border border-teal-200' : ''}
              ${checkMessage.type === 'error'   ? 'bg-red-50 text-red-700 border border-red-200'   : ''}
              ${checkMessage.type === 'info'    ? 'bg-blue-50 text-blue-700 border border-blue-200' : ''}
            `}>
              {checkMessage.text}
            </div>
          )}

          {/* Botones de acción */}
          <div className="w-full flex flex-col gap-3">

            {/* CTA principal — WhatsApp */}
            <button
              onClick={handleWhatsApp}
              className="
                flex items-center justify-center gap-2.5
                w-full py-3.5 rounded-xl
                bg-[#25D366] hover:bg-[#1ebe5a] active:bg-[#17a84f]
                text-white font-semibold text-sm
                shadow-lg shadow-green-200
                transition-all duration-200
                cursor-pointer
              "
            >
              <IconWhatsApp />
              Contactar al administrador por WhatsApp
            </button>

            {/* Verificar estado */}
            <button
              onClick={handleCheckStatus}
              disabled={checking}
              className="
                flex items-center justify-center gap-2
                w-full py-3 rounded-xl
                border border-slate-200 bg-white
                text-slate-600 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50
                font-medium text-sm
                transition-all duration-200
                disabled:opacity-60 disabled:cursor-not-allowed
                cursor-pointer
              "
            >
              <span className={checking ? 'animate-spin' : ''}><IconRefresh /></span>
              {checking ? 'Verificando...' : 'Verificar estado de mi cuenta'}
            </button>
          </div>

          {/* Información de la cuenta y logout */}
          <div className="w-full flex items-center justify-between pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-400 truncate max-w-[200px]">
              {userEmail}
            </p>
            <button
              onClick={handleLogout}
              className="
                flex items-center gap-1.5 text-xs text-slate-400
                hover:text-red-500 transition-colors cursor-pointer
              "
            >
              <IconLogOut />
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-8 text-xs text-slate-400">
        ¿Problemas con tu registro?{' '}
        <a
          href={`mailto:soporte@nuvi.app?subject=Problema con registro&body=Email: ${userEmail}`}
          className="text-teal-600 hover:text-teal-700 underline underline-offset-2"
        >
          soporte@nuvi.app
        </a>
      </p>
    </div>
  )
}
