-- =============================================================================
-- MIGRACIÓN 003 — Fix de Registro: RLS Policy para INSERT de Tenants
-- Plataforma: Supabase / PostgreSQL 15+
-- Versión:    1.0.0
-- Fecha:      2026-07-21
-- =============================================================================
-- DIAGNÓSTICO DEL ERROR 404:
--   El error 404 en supabase.rpc() ocurre porque PostgREST no expone
--   funciones SECURITY DEFINER al rol 'anon' sin una cadena completa de
--   grants de schema + tipo que es difícil de garantizar en Supabase Cloud.
--
-- SOLUCIÓN ADOPTADA — RLS Policy directa (patrón canónico de Supabase):
--   En lugar de un RPC, permitimos que 'anon' haga INSERT en public.tenants
--   ÚNICAMENTE cuando is_active = FALSE y plan = 'free'.
--   Esto es seguro: un tenant inactivo no puede acceder a NINGÚN dato.
--   La activación sigue siendo manual (SuperAdmin la hace desde el dashboard).
--
-- Esta migración también corrige el fn_get_my_tenant_status para que funcione
-- correctamente con el rol 'authenticated'.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- PASO 1: Agregar política INSERT en public.tenants para registro anónimo
-- -----------------------------------------------------------------------------

-- Política: cualquier visitante puede crear UN tenant solo si está inactivo
-- (El registro se controla desde el frontend con validaciones + email único)
CREATE POLICY pol_tenants_anon_register ON public.tenants
  FOR INSERT
  TO anon                            -- Usuarios NO autenticados (registro)
  WITH CHECK (
    is_active = FALSE                -- Solo se permiten tenants inactivos
    AND plan   = 'free'              -- Solo el plan gratuito en registro
  );

COMMENT ON POLICY pol_tenants_anon_register ON public.tenants IS
  'Permite a usuarios anónimos crear tenants inactivos durante el registro. '
  'La activación manual del SuperAdmin es el control real de acceso.';


-- -----------------------------------------------------------------------------
-- PASO 2: Asegurar que fn_get_my_tenant_status funcione para 'authenticated'
-- -----------------------------------------------------------------------------

-- Re-crear la función con grants explícitos
CREATE OR REPLACE FUNCTION public.fn_get_my_tenant_status()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'is_active',   t.is_active,
    'tenant_name', t.name,
    'tenant_plan', t.plan::TEXT,
    'role',        p.role::TEXT
  )
  FROM   public.profiles p
  JOIN   public.tenants  t ON t.id = p.tenant_id
  WHERE  p.id         = auth.uid()
  AND    p.deleted_at IS NULL
  LIMIT  1;
$$;

-- Grants explícitos de schema y función
GRANT USAGE  ON SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_get_my_tenant_status() TO authenticated;

COMMENT ON FUNCTION public.fn_get_my_tenant_status IS
  'Devuelve {is_active, tenant_name, tenant_plan, role} del tenant del usuario actual. '
  'Usada por App.jsx para proteger rutas del dashboard.';


-- -----------------------------------------------------------------------------
-- PASO 3 (Opcional): Limpiar la función RPC anterior si fue creada
-- Solo ejecutar si fn_register_nutricionista existe en tu proyecto.
-- -----------------------------------------------------------------------------

-- DROP FUNCTION IF EXISTS public.fn_register_nutricionista(TEXT, TEXT);


-- =============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- =============================================================================
-- Ejecuta esta query para confirmar que todo quedó bien:
--
-- SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'tenants';
--
-- Debes ver 'pol_tenants_anon_register' con cmd = 'INSERT'.
-- =============================================================================
