-- =============================================================================
-- CORRECCIÓN: Permisos y RLS para la tabla alimentos
-- Ejecuta esto en el SQL Editor de Supabase si el seed falla con "permission denied"
-- =============================================================================

-- 1. Otorgar permisos explícitos al rol service_role (bypass RLS en escritura masiva)
GRANT ALL ON public.alimentos TO service_role;
GRANT ALL ON public.alimentos TO postgres;

-- 2. También otorgar SELECT al rol anon y authenticated (para que el frontend lea)
GRANT SELECT ON public.alimentos TO anon;
GRANT SELECT ON public.alimentos TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.alimentos TO authenticated;

-- 3. Verificar que RLS esté habilitado correctamente
ALTER TABLE public.alimentos ENABLE ROW LEVEL SECURITY;

-- 4. Si las políticas anteriores causaron problemas, las recreamos limpias:
DROP POLICY IF EXISTS "alimentos_select_policy" ON public.alimentos;
DROP POLICY IF EXISTS "alimentos_insert_policy"  ON public.alimentos;
DROP POLICY IF EXISTS "alimentos_update_policy"  ON public.alimentos;
DROP POLICY IF EXISTS "alimentos_delete_policy"  ON public.alimentos;

-- Todos los usuarios autenticados (y anon) pueden VER los alimentos base INN
CREATE POLICY "alimentos_select_policy" ON public.alimentos
  FOR SELECT USING (
    tenant_id IS NULL   -- registros INN públicos (sin tenant)
    OR tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- El nutricionista/superadmin puede INSERTAR alimentos personalizados de su tenant
CREATE POLICY "alimentos_insert_policy" ON public.alimentos
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles
      WHERE id = auth.uid() AND role IN ('nutricionista', 'superadmin')
    )
  );

-- Solo puede EDITAR alimentos de su tenant
CREATE POLICY "alimentos_update_policy" ON public.alimentos
  FOR UPDATE USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles
      WHERE id = auth.uid() AND role IN ('nutricionista', 'superadmin')
    )
  );

-- Solo puede BORRAR alimentos PERSONALIZADOS de su tenant
CREATE POLICY "alimentos_delete_policy" ON public.alimentos
  FOR DELETE USING (
    es_personalizado = TRUE
    AND tenant_id IN (
      SELECT tenant_id FROM public.profiles
      WHERE id = auth.uid() AND role IN ('nutricionista', 'superadmin')
    )
  );

-- 5. Confirmar que todo quedó bien
SELECT
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'alimentos'
ORDER BY grantee, privilege_type;
