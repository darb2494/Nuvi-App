-- =============================================================================
-- MIGRACIÓN 002 — RPC de Registro Seguro con Aprobación Manual
-- Plataforma: Supabase / PostgreSQL 15+
-- Versión:    1.0.0
-- Fecha:      2026-07-21
-- =============================================================================
-- PROPÓSITO:
--   El frontend no puede hacer INSERT directo en public.tenants porque RLS
--   bloquea a los usuarios anónimos. Esta función SECURITY DEFINER actúa como
--   un proxy confiable que bypasea RLS y ejecuta el registro de forma atómica.
--
-- FLUJO:
--   1. Frontend llama a supabase.rpc('fn_register_nutricionista', {...})
--   2. Esta función crea el tenant con is_active = FALSE
--   3. Frontend llama a supabase.auth.signUp() con el tenant_id devuelto
--   4. El trigger fn_handle_new_user crea el perfil en public.profiles
--   5. SuperAdmin activa manualmente el tenant cuando el pago es confirmado
-- =============================================================================


-- -----------------------------------------------------------------------------
-- FUNCIÓN 1: fn_register_nutricionista
-- Crea el tenant y devuelve su UUID para que el frontend complete el signUp.
-- Accesible por el rol 'anon' (usuario no autenticado).
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_register_nutricionista(
  p_clinic_name TEXT,   -- Nombre del consultorio (ej: "Nutrición Integral Norte")
  p_slug        TEXT    -- Slug URL-safe generado en el frontend
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER                 -- Bypasea RLS, corre como dueño de la función
SET search_path = public         -- Evita search_path injection
AS $$
DECLARE
  v_tenant_id   UUID;
  v_final_slug  TEXT := trim(p_slug);
  v_slug_exists BOOLEAN;
BEGIN
  -- ── Validaciones de entrada ──────────────────────────────────────────────
  IF length(trim(p_clinic_name)) < 3 THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'El nombre del consultorio debe tener al menos 3 caracteres.'
    );
  END IF;

  IF v_final_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'El slug del consultorio contiene caracteres inválidos.'
    );
  END IF;

  -- ── Garantizar unicidad del slug (añade sufijo si ya existe) ─────────────
  SELECT EXISTS(SELECT 1 FROM public.tenants WHERE slug = v_final_slug)
  INTO   v_slug_exists;

  IF v_slug_exists THEN
    v_final_slug := v_final_slug || '-' || substr(md5(random()::TEXT), 1, 6);
  END IF;

  -- ── Crear el tenant con is_active = FALSE (pendiente de aprobación) ──────
  --    El SuperAdmin lo activará manualmente al confirmar el pago.
  INSERT INTO public.tenants (name, slug, plan, is_active)
  VALUES (trim(p_clinic_name), v_final_slug, 'free', FALSE)
  RETURNING id INTO v_tenant_id;

  -- ── Devolver el tenant_id al frontend para el siguiente paso (signUp) ────
  RETURN jsonb_build_object(
    'success',   TRUE,
    'tenant_id', v_tenant_id::TEXT,
    'slug',      v_final_slug
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Error inesperado — devolver mensaje genérico (no exponer internos)
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Ocurrió un error al crear el consultorio. Por favor intenta de nuevo.'
    );
END;
$$;

-- Permitir que usuarios NO autenticados (anon) llamen a esta función
GRANT EXECUTE ON FUNCTION public.fn_register_nutricionista(TEXT, TEXT) TO anon;

COMMENT ON FUNCTION public.fn_register_nutricionista IS
  'Crea un tenant inactivo y devuelve su UUID. Llamada por usuarios anónimos durante el registro. '
  'El tenant queda con is_active=FALSE hasta que el SuperAdmin confirme el pago manualmente.';


-- -----------------------------------------------------------------------------
-- FUNCIÓN 2: fn_get_my_tenant_status
-- Devuelve el estado de activación del tenant del usuario autenticado.
-- Usada por App.jsx para decidir si mostrar el dashboard o la pantalla de espera.
-- -----------------------------------------------------------------------------

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
    'tenant_plan', t.plan,
    'role',        p.role
  )
  FROM   public.profiles  p
  JOIN   public.tenants   t ON t.id = p.tenant_id
  WHERE  p.id = auth.uid()
  AND    p.deleted_at IS NULL
  LIMIT  1;
$$;

-- Solo usuarios autenticados pueden consultar su propio estado
GRANT EXECUTE ON FUNCTION public.fn_get_my_tenant_status() TO authenticated;

COMMENT ON FUNCTION public.fn_get_my_tenant_status IS
  'Devuelve {is_active, tenant_name, tenant_plan, role} del tenant del usuario actual. '
  'Usada para proteger rutas del dashboard.';


-- =============================================================================
-- FIN DE MIGRACIÓN 002
-- =============================================================================
-- Instrucciones:
--   1. Ejecutar este script en el SQL Editor de Supabase.
--   2. Verificar en Database → Functions que aparezcan:
--        - fn_register_nutricionista
--        - fn_get_my_tenant_status
--   3. En Supabase Dashboard → Authentication → Policies, confirmar que
--      el rol 'anon' tiene EXECUTE sobre fn_register_nutricionista.
-- =============================================================================
