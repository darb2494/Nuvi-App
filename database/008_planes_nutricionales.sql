-- ============================================================
-- Tabla: planes_nutricionales
-- Descripción: Almacena el plan nutricional completo generado
--              por el especialista para cada paciente.
-- Ejecutar en: Supabase SQL Editor
-- ============================================================

-- 1. Crear la tabla
CREATE TABLE IF NOT EXISTS public.planes_nutricionales (
  id               BIGSERIAL PRIMARY KEY,
  
  -- Relación con el paciente (debe existir en public.profiles)
  paciente_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Tenant (multi-tenant: cada nutricionista ve solo sus planes)
  tenant_id        UUID NOT NULL,

  -- Metadatos de la sesión
  fecha_creacion   TIMESTAMPTZ NOT NULL DEFAULT now(),
  bloques_activos  TEXT[] DEFAULT ARRAY['desayuno','almuerzo','cena'],

  -- Requerimientos calculados: fórmula, calorías objetivo, macros %/g
  -- Ejemplo:
  -- {
  --   "formula": "mifflin",
  --   "calorias": 2000,
  --   "macros_g": { "proteinas": 125, "grasas": 56, "carbohidratos": 250 }
  -- }
  requerimientos   JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Menú completo: objeto con cada bloque de comida como clave
  -- y un array de alimentos con sus cantidades y macros calculados
  -- Ejemplo:
  -- {
  --   "desayuno": [
  --     { "alimento_id": 42, "nombre": "Avena", "cantidad": 80,
  --       "porcion_base": 100, "macros": { "calorias": 300, ... } }
  --   ],
  --   "almuerzo": [ ... ]
  -- }
  menu             JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 2. Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_planes_paciente ON public.planes_nutricionales(paciente_id);
CREATE INDEX IF NOT EXISTS idx_planes_tenant   ON public.planes_nutricionales(tenant_id);
CREATE INDEX IF NOT EXISTS idx_planes_fecha    ON public.planes_nutricionales(fecha_creacion DESC);

-- 3. Habilitar RLS
ALTER TABLE public.planes_nutricionales ENABLE ROW LEVEL SECURITY;

-- 4. Otorgar permisos base al rol autenticado
GRANT ALL ON public.planes_nutricionales TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.planes_nutricionales_id_seq TO authenticated;

-- 5. Política: INSERT — solo puede insertar dentro de su propio tenant
DROP POLICY IF EXISTS "planes_insert_policy" ON public.planes_nutricionales;
CREATE POLICY "planes_insert_policy" ON public.planes_nutricionales
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- 6. Política: SELECT — solo puede leer planes de su tenant
DROP POLICY IF EXISTS "planes_select_policy" ON public.planes_nutricionales;
CREATE POLICY "planes_select_policy" ON public.planes_nutricionales
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- 7. Política: UPDATE
DROP POLICY IF EXISTS "planes_update_policy" ON public.planes_nutricionales;
CREATE POLICY "planes_update_policy" ON public.planes_nutricionales
  FOR UPDATE TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- 8. Política: DELETE
DROP POLICY IF EXISTS "planes_delete_policy" ON public.planes_nutricionales;
CREATE POLICY "planes_delete_policy" ON public.planes_nutricionales
  FOR DELETE TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );
