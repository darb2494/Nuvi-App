-- Tabla de Perfil Profesional
CREATE TABLE perfiles_profesionales (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_completo TEXT,
  especialidad TEXT,
  telefono_contacto TEXT,
  instagram_url TEXT,
  sitio_web_url TEXT,
  avatar_url TEXT,
  firma_url TEXT,
  sello_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Políticas RLS
ALTER TABLE perfiles_profesionales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios pueden ver su propio perfil profesional"
ON perfiles_profesionales FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Los usuarios pueden insertar su propio perfil profesional"
ON perfiles_profesionales FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Los usuarios pueden actualizar su propio perfil profesional"
ON perfiles_profesionales FOR UPDATE
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Los usuarios pueden eliminar su propio perfil profesional"
ON perfiles_profesionales FOR DELETE
TO authenticated
USING (auth.uid() = id);
