-- =============================================================================
-- MIGRACIÓN 005 — RPC para creación de pacientes "Offline"
-- Plataforma: Supabase / PostgreSQL 15+
-- Versión:    1.0.0
-- Fecha:      2026-07-21
-- =============================================================================
-- DIAGNÓSTICO:
--   Un Nutricionista necesita crear un paciente desde el Dashboard sin que
--   el paciente tenga que registrarse manualmente ni confirmar un correo.
--
-- SOLUCIÓN:
--   Una función SECURITY DEFINER que se ejecuta con privilegios elevados
--   para poder insertar en `auth.users` (el esquema de GoTrue).
--   - Si no hay email, genera uno temporal (auth.users requiere email único).
--   - Genera una contraseña aleatoria para el usuario offline.
--   - Inyecta `tenant_id` y `role = 'paciente'` en el metadata.
--   - El trigger existente (`fn_handle_new_user`) creará el `public.profiles`.
--   - Luego esta función crea la relación `nutricionista_paciente`, 
--     el expediente `anamnesis` y sus `datos_personales`.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_crear_paciente_offline(
  p_nombre TEXT,
  p_apellidos TEXT,
  p_email TEXT,
  p_telefono TEXT,
  p_fecha_nacimiento DATE,
  p_genero TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER      -- Ejecuta con permisos del creador (postgres) para tocar auth.users
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_nutricionista_id UUID;
  v_tenant_id UUID;
  v_new_user_id UUID;
  v_final_email TEXT;
  v_password TEXT;
  v_anamnesis_id UUID;
BEGIN
  -- 1. Obtener contexto del usuario actual (el nutricionista que llama a la función)
  v_nutricionista_id := auth.uid();
  IF v_nutricionista_id IS NULL THEN
    RAISE EXCEPTION 'No estás autenticado.';
  END IF;

  -- Obtener el tenant_id del nutricionista
  SELECT tenant_id INTO v_tenant_id
  FROM public.profiles
  WHERE id = v_nutricionista_id AND role = 'nutricionista' AND deleted_at IS NULL;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró un perfil de nutricionista activo para tu cuenta.';
  END IF;

  -- 2. Preparar los datos del usuario offline
  v_new_user_id := gen_random_uuid();
  v_password := encode(gen_random_bytes(12), 'base64'); -- Contraseña compleja inútil (nadie la sabrá)
  
  IF p_email IS NULL OR trim(p_email) = '' THEN
    v_final_email := 'paciente_offline_' || replace(v_new_user_id::text, '-', '') || '@offline.local';
  ELSE
    v_final_email := trim(p_email);
    -- Verificar si el correo ya existe
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_final_email) THEN
      RAISE EXCEPTION 'El correo % ya está registrado en el sistema.', v_final_email;
    END IF;
  END IF;

  -- 3. Insertar en auth.users
  -- Esto disparará automáticamente el trigger `trg_on_auth_user_created` que insertará en `public.profiles`
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    v_new_user_id,
    '00000000-0000-0000-0000-000000000000',
    v_final_email,
    crypt(v_password, gen_salt('bf')),
    now(), -- Marcar como confirmado automáticamente
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object(
      'first_name', p_nombre,
      'last_name', p_apellidos,
      'phone', p_telefono,
      'role', 'paciente',
      'tenant_id', v_tenant_id
    ),
    'authenticated',
    'authenticated',
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  -- 4. Vincular nutricionista y paciente en el mismo tenant
  INSERT INTO public.nutricionista_paciente (tenant_id, nutricionista_id, paciente_id)
  VALUES (v_tenant_id, v_nutricionista_id, v_new_user_id);

  -- 5. Crear el expediente (Anamnesis)
  INSERT INTO public.anamnesis (tenant_id, paciente_id, nutricionista_id, status)
  VALUES (v_tenant_id, v_new_user_id, v_nutricionista_id, 'activo')
  RETURNING id INTO v_anamnesis_id;

  -- 6. Crear el registro de datos personales
  INSERT INTO public.datos_personales (
    anamnesis_id,
    tenant_id,
    fecha_nacimiento,
    genero
  ) VALUES (
    v_anamnesis_id,
    v_tenant_id,
    p_fecha_nacimiento,
    CAST(p_genero AS genero_tipo)
  );

  -- Retornar el ID del nuevo paciente creado
  RETURN v_new_user_id;
END;
$$;

-- Otorgar permiso de ejecución explícito a los usuarios autenticados
GRANT EXECUTE ON FUNCTION public.fn_crear_paciente_offline(TEXT, TEXT, TEXT, TEXT, DATE, TEXT) TO authenticated;
