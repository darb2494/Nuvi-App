-- =============================================================================
-- MIGRACIÓN 007 — Tabla de Recetas (Plantillas de Comidas)
-- Plataforma: Supabase / PostgreSQL
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.recetas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  tipo_comida TEXT NOT NULL, -- 'desayuno', 'almuerzo', 'media_manana', etc.
  ingredientes JSONB NOT NULL DEFAULT '[]'::jsonb,
  calorias NUMERIC(8,2) DEFAULT 0,
  proteinas NUMERIC(8,2) DEFAULT 0,
  grasas NUMERIC(8,2) DEFAULT 0,
  carbohidratos NUMERIC(8,2) DEFAULT 0,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_recetas_nombre ON public.recetas USING GIN (to_tsvector('spanish', nombre));
CREATE INDEX IF NOT EXISTS idx_recetas_tenant ON public.recetas (tenant_id);

-- Trigger para updated_at
CREATE OR REPLACE TRIGGER trg_recetas_updated_at
  BEFORE UPDATE ON public.recetas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.recetas ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "recetas_select_policy" ON public.recetas
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "recetas_insert_policy" ON public.recetas
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('nutricionista', 'superadmin')
    )
  );

CREATE POLICY "recetas_update_policy" ON public.recetas
  FOR UPDATE USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('nutricionista', 'superadmin')
    )
  );

CREATE POLICY "recetas_delete_policy" ON public.recetas
  FOR DELETE USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('nutricionista', 'superadmin')
    )
  );

COMMENT ON TABLE public.recetas IS 'Almacena plantillas de comidas prearmadas (recetas) por consultorio.';
