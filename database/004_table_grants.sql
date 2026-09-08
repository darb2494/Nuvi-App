-- =============================================================================
-- MIGRACIÓN 004 — Grants de tabla para exposición en PostgREST
-- Plataforma: Supabase / PostgreSQL 15+
-- Versión:    1.0.0
-- Fecha:      2026-07-21
-- =============================================================================
-- DIAGNÓSTICO:
--   Error PGRST125 "Invalid path specified in request URL" ocurre cuando el
--   rol que hace la petición no tiene NINGÚN privilegio de tabla (GRANT).
--   Sin GRANT, PostgREST no expone el endpoint en su schema cache, por lo
--   que RLS nunca llega a evaluarse — la tabla es "invisible" para ese rol.
--
-- CAUSA RAÍZ:
--   Las tablas creadas vía SQL Editor no reciben los grants automáticos que
--   sí aplica el Table Editor de Supabase. Hay que otorgarlos manualmente.
--
-- RELACIÓN GRANT ↔ RLS:
--   GRANT = "¿Puede este rol hablar con esta tabla en absoluto?"   (PostgREST)
--   RLS   = "¿Qué filas puede ver/modificar dentro de esa tabla?"  (PostgreSQL)
--   Ambos deben estar presentes. GRANT sin RLS = acceso total a filas.
--                                  RLS sin GRANT = endpoint invisible (PGRST125).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- CAPA 1 — Acceso anónimo (solo lo mínimo necesario para el registro)
-- -----------------------------------------------------------------------------

-- Permite que anon inserte en tenants durante el registro.
-- La RLS policy 'pol_tenants_anon_register' restringe a:
--   is_active = FALSE AND plan = 'free'
--
-- ⚠️  IMPORTANTE: PostgREST requiere al menos SELECT para incluir una tabla
--     en su schema cache. Sin SELECT, incluso INSERT devuelve PGRST125
--     ("Invalid path") porque la tabla es invisible para ese rol.
--     Sin una RLS policy SELECT para anon, el resultado de cualquier
--     SELECT será 0 filas — esto es seguro y esperado.
GRANT SELECT, INSERT ON public.tenants TO anon;


-- -----------------------------------------------------------------------------
-- CAPA 2 — Acceso autenticado (nutricionista, paciente — RLS controla las filas)
-- -----------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants                    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles                   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_invitations         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutricionista_paciente     TO authenticated;

-- Módulo de Anamnesis
GRANT SELECT, INSERT, UPDATE, DELETE ON public.anamnesis                  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.datos_personales           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.historial_medico           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parametros_digestivos      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restricciones_alimentarias TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.habitos_alimentarios       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medidas_antropometricas    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.anamnesis_archivos         TO authenticated;

-- Auditoría: solo lectura (escritura solo desde triggers SECURITY DEFINER)
GRANT SELECT ON public.audit_log     TO authenticated;

-- Catálogos: solo lectura
GRANT SELECT ON public.roles         TO authenticated;
GRANT SELECT ON public.permissions   TO authenticated;
GRANT SELECT ON public.role_permissions TO authenticated;

-- Secuencias de SMALLSERIAL (roles, permissions)
GRANT USAGE ON SEQUENCE public.roles_id_seq       TO authenticated;
GRANT USAGE ON SEQUENCE public.permissions_id_seq TO authenticated;


-- =============================================================================
-- VERIFICACIÓN
-- =============================================================================
-- Ejecuta esta query para confirmar los grants aplicados:
--
-- SELECT grantee, table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema = 'public'
--   AND grantee IN ('anon', 'authenticated')
-- ORDER BY table_name, grantee, privilege_type;
-- =============================================================================
