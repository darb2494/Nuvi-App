# Variables de Entorno — Nuvi Web

Crea un archivo `.env` en la raíz del proyecto `/web` con el siguiente contenido.
NUNCA subas este archivo a Git. Ya está incluido en `.gitignore`.

```env
VITE_SUPABASE_URL=https://TU_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## ¿Dónde encuentro estos valores?

1. Ve a tu proyecto en https://supabase.com/dashboard
2. Navega a: **Project Settings → API**
3. Copia:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon / public key** → `VITE_SUPABASE_ANON_KEY`
