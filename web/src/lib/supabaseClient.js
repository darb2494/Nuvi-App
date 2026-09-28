// src/lib/supabaseClient.js
//
// Cliente de Supabase para Nuvi.
//
// SETUP:
//   1. Copia .env.example → .env en la raíz de /web
//   2. Rellena VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY con los valores
//      de tu proyecto en: Supabase Dashboard → Project Settings → API
//   3. Reinicia el servidor de desarrollo (npm run dev)

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * `true` cuando faltan las variables de entorno.
 * App.jsx muestra una pantalla de configuración en lugar de crashear.
 */
export const isMissingConfig = !supabaseUrl || !supabaseKey

export const supabase = isMissingConfig
  ? null
  : createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession:    true,   // Persiste la sesión en localStorage
        autoRefreshToken:  true,   // Refresca el token automáticamente
        detectSessionInUrl: false, // Solo necesario para flujos OAuth (magic link, Google).
                                   // Desactivar evita que Supabase re-parsee la URL
                                   // y dispare onAuthStateChange al recuperar el foco.
      },
    })
