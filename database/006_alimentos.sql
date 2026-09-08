-- =============================================================================
-- MIGRACIÓN 006 — Tabla de Alimentos (Tabla INN - INCAP)
-- Plataforma: Supabase / PostgreSQL 15+
-- Versión:    1.0.0
-- Fecha:      2026-07-22
-- =============================================================================

-- ── Tabla principal de alimentos ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.alimentos (
  id                    INTEGER PRIMARY KEY,          -- Codigo INN
  nombre                TEXT        NOT NULL,         -- Alimento
  porcion_base          NUMERIC(8,2) DEFAULT 100,     -- Cantidad (g o ml)

  -- Macronutrientes (por porción_base)
  calorias              NUMERIC(8,2),                 -- Calorías (kcal)
  proteinas             NUMERIC(8,2),                 -- Proteína (g)
  grasas                NUMERIC(8,2),                 -- Grasas (g)
  carbohidratos         NUMERIC(8,2),                 -- Carbohidratos_Totales (g)
  carbohidratos_disp    NUMERIC(8,2),                 -- Carbohidratos_Dispon (g)
  fibra                 NUMERIC(8,2),                 -- Fibra_Dietética_Total (g)

  -- Micronutrientes como JSONB para mantener la tabla limpia
  -- Incluye: Humed, Fósforo, Potasio, Calcio, Hierro, Magnesio, Zinc,
  --          Cobre, Sodio, Vitamina_A, Caroteno, Tiamina, Riboflavina,
  --          Niacina, Vitamina_B6, Acid_Ascorb, Cenizas, Fibra_Insolub
  micros                JSONB        DEFAULT '{}',

  -- Metadatos del tenant (permite que cada consultorio pueda agregar alimentos propios)
  tenant_id             UUID         REFERENCES public.tenants(id) ON DELETE CASCADE,
  es_personalizado      BOOLEAN      DEFAULT FALSE,   -- TRUE = agregado por el nutricionista, FALSE = INN base
  
  created_at            TIMESTAMPTZ  DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  DEFAULT NOW()
);

-- ── Índices para búsqueda rápida ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_alimentos_nombre ON public.alimentos USING GIN (to_tsvector('spanish', nombre));
CREATE INDEX IF NOT EXISTS idx_alimentos_nombre_ilike ON public.alimentos (nombre);
CREATE INDEX IF NOT EXISTS idx_alimentos_tenant ON public.alimentos (tenant_id);

-- ── Trigger: actualizar updated_at automáticamente ───────────────────────────
CREATE OR REPLACE TRIGGER trg_alimentos_updated_at
  BEFORE UPDATE ON public.alimentos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE public.alimentos ENABLE ROW LEVEL SECURITY;

-- Política: Todo usuario autenticado puede leer alimentos base (tenant_id IS NULL)
--           y los alimentos de su propio tenant
CREATE POLICY "alimentos_select_policy" ON public.alimentos
  FOR SELECT USING (
    tenant_id IS NULL    -- registros INN públicos
    OR tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Política: Solo el nutricionista/superadmin puede insertar alimentos personalizados
CREATE POLICY "alimentos_insert_policy" ON public.alimentos
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('nutricionista', 'superadmin')
    )
  );

-- Política: Solo puede editar alimentos de su propio tenant
CREATE POLICY "alimentos_update_policy" ON public.alimentos
  FOR UPDATE USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('nutricionista', 'superadmin')
    )
  );

-- Política: Solo puede borrar alimentos personalizados de su tenant
CREATE POLICY "alimentos_delete_policy" ON public.alimentos
  FOR DELETE USING (
    es_personalizado = TRUE
    AND tenant_id IN (
      SELECT tenant_id FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('nutricionista', 'superadmin')
    )
  );

COMMENT ON TABLE public.alimentos IS 'Tabla de composición química de alimentos (base INN/INCAP) + alimentos personalizados por consultorio.';
