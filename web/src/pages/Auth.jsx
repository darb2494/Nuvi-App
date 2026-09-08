// src/pages/Auth.jsx
//
// Página de Autenticación de Nuvi.
// Maneja: Inicio de Sesión y Registro (nutricionista + tenant).
//
// Flujo de Registro:
//   1. Usuario completa nombre, clínica, email y contraseña.
//   2. Se crea un registro en public.tenants con el nombre de la clínica.
//   3. supabase.auth.signUp() pasa el tenant_id y role='nutricionista'
//      en raw_user_meta_data, lo que activa el trigger fn_handle_new_user
//      y crea automáticamente el perfil en public.profiles.

import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

// ── Iconos SVG inline (sin dependencias externas) ───────────────────────────

const IconEmail = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="3" />
    <path d="m2 7 10 7 10-7" />
  </svg>
)

const IconLock = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    <circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none" />
  </svg>
)

const IconUser = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.582-7 8-7s8 3 8 7" />
  </svg>
)

const IconClinic = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21V8l9-5 9 5v13" />
    <path d="M9 21V14h6v7" />
    <path d="M12 9v3m-1.5-1.5h3" />
  </svg>
)

const IconEye = ({ off }) => off ? (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
) : (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const IconSpinner = () => (
  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
  </svg>
)

// ── Componente de campo de formulario ────────────────────────────────────────

function InputField({ id, label, type = 'text', value, onChange, icon, placeholder, rightElement, required = true }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-teal-600 ml-0.5">*</span>}
      </label>
      <div className="relative flex items-center">
        {icon && (
          <span className="absolute left-3.5 text-slate-400 pointer-events-none select-none">
            {icon}
          </span>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          className="
            w-full rounded-xl border border-slate-200 bg-white
            pl-11 pr-11 py-3 text-slate-900 text-sm
            placeholder:text-slate-400
            outline-none ring-0
            transition-all duration-200
            focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20
            hover:border-slate-300
          "
        />
        {rightElement && (
          <span className="absolute right-3.5 text-slate-400 cursor-pointer">
            {rightElement}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Alerta de feedback ────────────────────────────────────────────────────────

function Alert({ type, message }) {
  if (!message) return null

  const styles = {
    error:   'bg-red-50 border-red-200 text-red-700',
    success: 'bg-teal-50 border-teal-200 text-teal-700',
  }

  const icons = {
    error:   '⚠',
    success: '✓',
  }

  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${styles[type]}`} role="alert">
      <span className="mt-0.5 font-bold text-base leading-none">{icons[type]}</span>
      <p className="leading-snug">{message}</p>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Convierte "Clínica Nutrición Norte" → "clinica-nutricion-norte"
 * para usarlo como slug del tenant.
 */
function generateSlug(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // elimina tildes
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50)
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function Auth() {
  // Modo: 'login' | 'register'
  const [mode, setMode] = useState('login')

  // Campos compartidos
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)

  // Campos solo de registro
  const [fullName,    setFullName]    = useState('')
  const [clinicName,  setClinicName]  = useState('')

  // Estado UI
  const [loading,  setLoading]  = useState(false)
  const [feedback, setFeedback] = useState({ type: null, message: null })

  // ── Limpiar formulario al cambiar modo
  const switchMode = (newMode) => {
    setMode(newMode)
    setEmail('')
    setPassword('')
    setFullName('')
    setClinicName('')
    setFeedback({ type: null, message: null })
  }

  // ── LOGIN ────────────────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setFeedback({ type: null, message: null })

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      const msg =
        error.message === 'Invalid login credentials'
          ? 'Email o contraseña incorrectos. Por favor verifica tus datos.'
          : error.message
      setFeedback({ type: 'error', message: msg })
    } else {
      setFeedback({ type: 'success', message: '¡Bienvenido de vuelta! Redirigiendo...' })
      // La redirección la manejará el router de la app al detectar la sesión activa.
    }

    setLoading(false)
  }

  // ── REGISTRO ─────────────────────────────────────────────────────────────────
  //
  // Flujo:
  //   1. Se genera el UUID del tenant en el cliente (crypto.randomUUID).
  //      Esto evita necesitar SELECT después del INSERT (anon no tiene política SELECT).
  //   2. INSERT directo en public.tenants con is_active = FALSE.
  //      Permitido por la RLS policy 'pol_tenants_anon_register'.
  //   3. supabase.auth.signUp() con el tenant_id en raw_user_meta_data.
  //      El trigger fn_handle_new_user crea el perfil en public.profiles.
  //
  const handleRegister = async (e) => {
    e.preventDefault()
    setLoading(true)
    setFeedback({ type: null, message: null })

    // Validaciones del cliente (antes de tocar la red)
    if (fullName.trim().split(' ').length < 2) {
      setFeedback({ type: 'error', message: 'Por favor ingresa tu nombre completo (nombre y apellido).' })
      setLoading(false)
      return
    }
    if (clinicName.trim().length < 3) {
      setFeedback({ type: 'error', message: 'El nombre del consultorio debe tener al menos 3 caracteres.' })
      setLoading(false)
      return
    }
    if (password.length < 8) {
      setFeedback({ type: 'error', message: 'La contraseña debe tener al menos 8 caracteres.' })
      setLoading(false)
      return
    }

    try {
      const [firstName, ...rest] = fullName.trim().split(' ')
      const lastName   = rest.join(' ')
      const uniqueSlug = `${generateSlug(clinicName)}-${Date.now().toString(36)}`

      // ── Paso 1: Generar UUID en el cliente ───────────────────────────────
      // crypto.randomUUID() es nativo en todos los browsers modernos y Node 14+.
      // Usarlo aquí evita hacer .select() después del INSERT, lo cual fallaría
      // porque 'anon' no tiene política SELECT en public.tenants. (PGRST125)
      const tenantId = crypto.randomUUID()

      // ── Paso 2: Crear el tenant ───────────────────────────────────────────
      // La política RLS 'pol_tenants_anon_register' permite este INSERT solo
      // cuando is_active = FALSE y plan = 'free'.
      const { error: tenantError } = await supabase
        .from('tenants')
        .insert({
          id:        tenantId,       // ← UUID pre-generado, sin necesidad de leerlo de vuelta
          name:      clinicName.trim(),
          slug:      uniqueSlug,
          plan:      'free',
          is_active: false,          // Inactivo hasta aprobación manual del SuperAdmin
        })

      if (tenantError) {
        console.error('[Nuvi] Error al crear tenant:', tenantError)
        throw new Error(
          tenantError.code === '23505'
            ? 'Ya existe un consultorio con ese nombre. Prueba con uno diferente.'
            : `No pudimos crear el consultorio (${tenantError.code ?? tenantError.message}).`
        )
      }

      // ── Paso 3: Registrar al usuario en Supabase Auth ────────────────────
      // El trigger fn_handle_new_user leerá raw_user_meta_data y creará
      // automáticamente el perfil en public.profiles.
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            tenant_id:  tenantId,    // ← Mismo UUID generado en el cliente
            role:       'nutricionista',
            first_name: firstName,
            last_name:  lastName,
          },
        },
      })

      if (signUpError) {
        console.error('[Nuvi] Error en signUp:', signUpError)
        throw new Error(
          signUpError.message === 'User already registered'
            ? 'Ya existe una cuenta con este email. ¿Quieres iniciar sesión?'
            : signUpError.message
        )
      }

      // ── Éxito ─────────────────────────────────────────────────────────────
      setFeedback({
        type: 'success',
        message: '¡Registro exitoso! Revisa tu correo para confirmar tu cuenta. Una vez que el administrador active tu consultorio, podrás ingresar.',
      })
      setEmail(''); setPassword(''); setFullName(''); setClinicName('')

    } catch (err) {
      setFeedback({ type: 'error', message: err.message })
    } finally {
      setLoading(false)
    }
  }


  // ── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex">

      {/* ── Panel izquierdo — Branding ─────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-gradient-to-br from-teal-800 via-teal-700 to-cyan-600 p-12 relative overflow-hidden">

        {/* Decoración de fondo */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/5 rounded-full" />
          <div className="absolute top-1/3 -right-32 w-80 h-80 bg-white/5 rounded-full" />
          <div className="absolute -bottom-20 left-1/4 w-72 h-72 bg-white/5 rounded-full" />
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 5v5l3 3" />
                <path d="M8 12h4" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">Nuvi</span>
          </div>
        </div>

        {/* Contenido central */}
        <div className="relative z-10 flex flex-col gap-8">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              La plataforma clínica que tus pacientes merecen
            </h1>
            <p className="text-teal-100 text-lg leading-relaxed">
              Gestiona expedientes, planes nutricionales y el seguimiento de cada paciente desde un solo lugar.
            </p>
          </div>

          {/* Feature bullets */}
          <ul className="flex flex-col gap-4">
            {[
              { icon: '📋', text: 'Historia clínica digital completa' },
              { icon: '📊', text: 'Seguimiento antropométrico con gráficas' },
              { icon: '🔒', text: 'Datos seguros con cifrado extremo a extremo' },
              { icon: '📱', text: 'App móvil para tus pacientes' },
            ].map(({ icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center text-lg backdrop-blur-sm flex-shrink-0">
                  {icon}
                </span>
                <span className="text-teal-50 text-sm font-medium">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer del panel */}
        <p className="relative z-10 text-teal-300 text-xs">
          © {new Date().getFullYear()} Nuvi Health Technologies
        </p>
      </div>

      {/* ── Panel derecho — Formulario ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-slate-50">

        <div className="w-full max-w-[420px] flex flex-col gap-8">

          {/* Cabecera del formulario */}
          <div className="flex flex-col gap-1">
            {/* Logo móvil (visible solo en pantallas pequeñas) */}
            <div className="flex items-center gap-2 mb-4 lg:hidden">
              <div className="w-8 h-8 bg-teal-600 rounded-xl flex items-center justify-center">
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 12h4m4-4v8M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0z" />
                </svg>
              </div>
              <span className="text-xl font-bold text-slate-900">Nuvi</span>
            </div>

            <h2 className="text-2xl font-bold text-slate-900">
              {mode === 'login' ? 'Bienvenido de vuelta' : 'Crea tu cuenta'}
            </h2>
            <p className="text-slate-500 text-sm">
              {mode === 'login'
                ? 'Ingresa tus credenciales para acceder a tu panel.'
                : 'Configura tu consultorio en menos de 2 minutos.'}
            </p>
          </div>

          {/* Tabs Login / Registro */}
          <div className="flex bg-white rounded-2xl p-1 border border-slate-200 shadow-sm">
            {['login', 'register'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`
                  flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer
                  ${mode === m
                    ? 'bg-teal-600 text-white shadow-md shadow-teal-200'
                    : 'text-slate-500 hover:text-slate-700'}
                `}
              >
                {m === 'login' ? 'Iniciar Sesión' : 'Registrarse'}
              </button>
            ))}
          </div>

          {/* Alerta de feedback */}
          <Alert type={feedback.type} message={feedback.message} />

          {/* ── Formulario de Login ──────────────────────────────────────── */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="flex flex-col gap-5" noValidate>

              <InputField
                id="login-email"
                label="Correo electrónico"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={<IconEmail />}
                placeholder="tu@correo.com"
              />

              <InputField
                id="login-password"
                label="Contraseña"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<IconLock />}
                placeholder="••••••••"
                rightElement={
                  <button type="button" onClick={() => setShowPass(!showPass)} aria-label="Mostrar contraseña">
                    <IconEye off={showPass} />
                  </button>
                }
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-sm text-teal-600 hover:text-teal-700 font-medium transition-colors cursor-pointer"
                  onClick={() => {
                    // TODO: implementar recuperación de contraseña
                    alert('Función de recuperación de contraseña próximamente.')
                  }}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="
                  flex items-center justify-center gap-2
                  w-full py-3 rounded-xl
                  bg-teal-600 hover:bg-teal-700 active:bg-teal-800
                  text-white font-semibold text-sm
                  shadow-lg shadow-teal-200
                  transition-all duration-200
                  disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none
                  cursor-pointer
                "
              >
                {loading ? <><IconSpinner /> Ingresando...</> : 'Iniciar Sesión'}
              </button>
            </form>
          )}

          {/* ── Formulario de Registro ───────────────────────────────────── */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="flex flex-col gap-5" noValidate>

              <InputField
                id="reg-fullname"
                label="Nombre completo"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                icon={<IconUser />}
                placeholder="Dra. María González"
              />

              <InputField
                id="reg-clinic"
                label="Nombre del Consultorio / Clínica"
                type="text"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                icon={<IconClinic />}
                placeholder="Nutrición Integral Norte"
              />

              <InputField
                id="reg-email"
                label="Correo electrónico"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={<IconEmail />}
                placeholder="tu@correo.com"
              />

              <InputField
                id="reg-password"
                label="Contraseña"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<IconLock />}
                placeholder="Mínimo 8 caracteres"
                rightElement={
                  <button type="button" onClick={() => setShowPass(!showPass)} aria-label="Mostrar contraseña">
                    <IconEye off={showPass} />
                  </button>
                }
              />

              {/* Barra de fortaleza de contraseña */}
              {password.length > 0 && (
                <PasswordStrength password={password} />
              )}

              {/* Términos */}
              <p className="text-xs text-slate-500 text-center leading-relaxed">
                Al registrarte, aceptas nuestros{' '}
                <a href="#" className="text-teal-600 underline underline-offset-2 hover:text-teal-700">
                  Términos de Servicio
                </a>{' '}
                y{' '}
                <a href="#" className="text-teal-600 underline underline-offset-2 hover:text-teal-700">
                  Política de Privacidad
                </a>.
              </p>

              <button
                type="submit"
                disabled={loading || !email || !password || !fullName || !clinicName}
                className="
                  flex items-center justify-center gap-2
                  w-full py-3 rounded-xl
                  bg-teal-600 hover:bg-teal-700 active:bg-teal-800
                  text-white font-semibold text-sm
                  shadow-lg shadow-teal-200
                  transition-all duration-200
                  disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none
                  cursor-pointer
                "
              >
                {loading
                  ? <><IconSpinner /> Creando cuenta...</>
                  : 'Crear cuenta gratuita'}
              </button>
            </form>
          )}

          {/* Divisor */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium">Software médico certificado</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Badges de confianza */}
          <div className="flex items-center justify-center gap-6">
            {[
              { label: 'Datos cifrados',    icon: '🔐' },
              { label: 'HIPAA Compliant',   icon: '🏥' },
              { label: 'Soporte 24/7',      icon: '🛡️' },
            ].map(({ label, icon }) => (
              <div key={label} className="flex flex-col items-center gap-1 text-center">
                <span className="text-lg">{icon}</span>
                <span className="text-[11px] text-slate-500 font-medium leading-tight">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Componente de fortaleza de contraseña ─────────────────────────────────────

function PasswordStrength({ password }) {
  const checks = [
    { label: '8+ caracteres',   ok: password.length >= 8 },
    { label: 'Mayúscula',       ok: /[A-Z]/.test(password) },
    { label: 'Número',          ok: /\d/.test(password) },
    { label: 'Símbolo',         ok: /[^A-Za-z0-9]/.test(password) },
  ]

  const score = checks.filter((c) => c.ok).length

  const barColors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-teal-500']
  const labels    = ['Muy débil', 'Débil', 'Buena', 'Fuerte']

  return (
    <div className="flex flex-col gap-2">
      {/* Barras de progreso */}
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`
              h-1.5 flex-1 rounded-full transition-all duration-300
              ${i < score ? barColors[score - 1] : 'bg-slate-200'}
            `}
          />
        ))}
      </div>
      {/* Etiqueta y checks */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${score < 2 ? 'text-red-500' : score < 4 ? 'text-yellow-600' : 'text-teal-600'}`}>
          {labels[score - 1] ?? 'Ingresa una contraseña'}
        </span>
        <div className="flex gap-2">
          {checks.map(({ label, ok }) => (
            <span
              key={label}
              title={label}
              className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium transition-colors ${
                ok ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
