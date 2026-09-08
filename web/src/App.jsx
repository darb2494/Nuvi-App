// src/App.jsx
//
// Punto de entrada de la aplicación Nuvi.
// Gestiona el estado de sesión global y el enrutamiento por rol/estado.
//
// ── Árbol de decisión de rutas ────────────────────────────────────────────────
//
//   No hay .env         → <SetupScreen />       (guía de configuración)
//   Sin sesión          → <Auth />              (login / registro)
//   Con sesión +
//     is_active = false → <PendingApproval />   (en espera de pago manual)
//     is_active = true  → <DashboardLayout />   (App principal + react-router)
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase, isMissingConfig } from './lib/supabaseClient'
import Auth from './pages/Auth'
import PendingApproval from './pages/PendingApproval'
import DashboardLayout from './layouts/DashboardLayout'
import Dashboard from './pages/Dashboard'
import Pacientes from './pages/Pacientes'
import ExpedientePaciente from './pages/ExpedientePaciente'
import Alimentos from './pages/Alimentos'
import Recetas from './pages/Recetas'
import AgendaGlobal from './pages/AgendaGlobal'
import Configuracion from './pages/Configuracion'

// ── Pantalla de configuración inicial (falta .env) ───────────────────────────

function SetupScreen() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white border border-amber-200 rounded-2xl shadow-sm p-8 max-w-lg w-full flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <span className="text-3xl">⚙️</span>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Configuración requerida</h1>
            <p className="text-sm text-slate-500">
              Falta el archivo <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">.env</code>
            </p>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 leading-relaxed">
          <p className="font-semibold mb-1">¿Cómo solucionar esto?</p>
          <ol className="list-decimal list-inside space-y-1.5">
            <li>Crea el archivo <code className="bg-amber-100 px-1 rounded font-mono text-xs">web/.env</code></li>
            <li>Pega tus credenciales de Supabase:</li>
          </ol>
        </div>
        <pre className="bg-slate-900 text-teal-300 rounded-xl p-4 text-xs font-mono leading-relaxed overflow-x-auto select-all">
{`VITE_SUPABASE_URL=https://TU_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_ADMIN_WHATSAPP=5219991234567`}
        </pre>
        <div className="text-sm text-slate-600 space-y-1">
          <p>📍 Encuéntralas en:</p>
          <p className="font-medium text-slate-800">
            Supabase Dashboard →{' '}
            <span className="text-teal-700">Project Settings</span> →{' '}
            <span className="text-teal-700">API</span>
          </p>
        </div>
        <p className="text-xs text-slate-400 bg-slate-50 rounded-lg p-3">
          💡 Después de crear el archivo, reinicia el servidor con{' '}
          <code className="font-mono">npm run dev</code> para que Vite recargue las variables.
        </p>
      </div>
    </div>
  )
}

// ── Spinner de carga ──────────────────────────────────────────────────────────

function LoadingScreen({ message = 'Cargando Nuvi...' }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
        <p className="text-slate-500 text-sm font-medium">{message}</p>
      </div>
    </div>
  )
}

// ── Componente raíz ───────────────────────────────────────────────────────────

export default function App() {
  const [session,    setSession]    = useState(undefined)
  const [tenantInfo, setTenantInfo] = useState(undefined) // undefined = cargando, null = sin perfil, objeto = ok
  const [appLoading, setAppLoading] = useState(true)
  const [authError,  setAuthError]  = useState(null)

  // ── Carga el estado del tenant para el usuario con sesión activa ───────────
  const loadTenantStatus = useCallback(async (currentSession) => {
    const { data, error } = await supabase.rpc('fn_get_my_tenant_status')
    
    let tenant_id = null
    if (currentSession?.user?.id) {
      const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', currentSession.user.id).single()
      tenant_id = profile?.tenant_id
    }

    if (!error && data) {
      setTenantInfo({ ...data, tenant_id })
    } else {
      console.error('[Nuvi] Error fetching tenant status:', error || 'No data returned')
      setTenantInfo(null) // null significa que falló o no tiene perfil
      setAuthError('Tu cuenta fue creada pero falta configurar tu perfil y consultorio. Por favor, contacta a soporte o registra la cuenta de nuevo.')
    }
  }, [])

  // ── Inicialización: sesión + estado del tenant ─────────────────────────────
  useEffect(() => {
    if (isMissingConfig) {
      setAppLoading(false)
      return
    }

    // 1. Obtener sesión actual
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      // Si hay error (ej. token malformado), limpiamos la sesión y forzamos logout
      if (error) {
        console.warn('[Nuvi] Sesión inválida detectada, limpiando...', error.message)
        await supabase.auth.signOut()
        setSession(null)
        setTenantInfo(null)
        setAppLoading(false)
        return
      }
      setSession(session)
      if (session) await loadTenantStatus(session)
      setAppLoading(false)
    })

    // 2. Escuchar cambios de sesión (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // TOKEN_REFRESH_FAILED: el refresh token expiró o es inválido (error 400)
        // En este caso Supabase manda session = null. Limpiamos todo.
        if (event === 'TOKEN_REFRESHED' && !session) {
          console.warn('[Nuvi] Token refresh falló, cerrando sesión automáticamente')
          await supabase.auth.signOut()
          setSession(null)
          setTenantInfo(null)
          return
        }

        if (event === 'SIGNED_OUT') {
          setSession(null)
          setTenantInfo(null)
          return
        }

        setSession(session)
        if (session) {
          await loadTenantStatus(session)
        } else {
          setTenantInfo(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [loadTenantStatus])

  // ── Árbol de renderizado ───────────────────────────────────────────────────

  // Falta .env
  if (isMissingConfig) return <SetupScreen />

  // Cargando estado general inicial
  if (appLoading) return <LoadingScreen />

  // Sin sesión → pantalla de Auth
  if (!session) return <Auth />

  // Con sesión pero aún cargando el estado del tenant
  if (tenantInfo === undefined) return <LoadingScreen message="Verificando tu cuenta..." />

  // Error crítico — mostrar pantalla de error sin hacer logout automático
  if (tenantInfo === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md bg-white border border-amber-200 rounded-2xl shadow-sm p-6 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Error al cargar tu cuenta</h2>
          <p className="text-slate-500 text-sm mb-6">No pudimos verificar tu consultorio. Por favor cierra sesión e intenta de nuevo.</p>
          <button
            onClick={() => {
              localStorage.clear()
              supabase.auth.signOut().finally(() => {
                window.location.replace(window.location.origin)
              })
            }}
            className="px-5 py-2.5 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

  // Tenant inactivo → pantalla de aprobación pendiente
  if (!tenantInfo.is_active) {
    return (
      <PendingApproval
        tenantName={tenantInfo.tenant_name}
        userEmail={session.user.email}
        onStatusChange={loadTenantStatus}
      />
    )
  }

  // Tenant activo → Dashboard (react-router-dom)
  // Al envolver el router completo aquí, garantizamos que NADIE sin sesión o tenant_activo 
  // pueda acceder a las rutas. Actúa como el nivel más alto de "ProtectedRoute".
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<DashboardLayout session={session} tenantName={tenantInfo.tenant_name} />}>
          <Route path="/" element={<Dashboard />} />
          {/* Aquí puedes agregar las rutas futuras (se irán reemplazando con componentes reales) */}
          <Route path="/pacientes" element={<Pacientes session={session} tenantName={tenantInfo.tenant_name} />} />
          <Route path="/pacientes/:id" element={<ExpedientePaciente />} />
          <Route path="/agenda" element={<AgendaGlobal session={session} tenantName={tenantInfo.tenant_name} />} />
          <Route path="/alimentos" element={<Alimentos session={session} tenantId={tenantInfo.tenant_id} />} />
          <Route path="/recetas" element={<Recetas session={session} tenantId={tenantInfo.tenant_id} />} />
          <Route path="/configuracion" element={<Configuracion session={session} />} />
          
          {/* Fallback 404 para cualquier ruta no encontrada dentro del dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
