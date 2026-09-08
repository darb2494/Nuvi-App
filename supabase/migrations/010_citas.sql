-- Tabla de Citas
CREATE TABLE citas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  nombre_contacto TEXT,
  telefono_contacto TEXT,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  tipo_cita TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'Agendada' CHECK (estado IN ('Agendada', 'Completada', 'Cancelada', 'No asistió')),
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Políticas RLS
ALTER TABLE citas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios pueden ver las citas de su tenant" 
ON citas FOR SELECT 
TO authenticated 
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Los usuarios pueden insertar citas en su tenant" 
ON citas FOR INSERT 
TO authenticated 
WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Los usuarios pueden actualizar citas de su tenant" 
ON citas FOR UPDATE 
TO authenticated 
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Los usuarios pueden eliminar citas de su tenant" 
ON citas FOR DELETE 
TO authenticated 
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
