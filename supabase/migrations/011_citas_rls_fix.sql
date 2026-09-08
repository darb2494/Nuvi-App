-- Habilitar RLS explícitamente (por si acaso)
ALTER TABLE citas ENABLE ROW LEVEL SECURITY;

-- 1. Eliminar cualquier política existente para empezar en limpio
DROP POLICY IF EXISTS "Los usuarios pueden ver las citas de su tenant" ON citas;
DROP POLICY IF EXISTS "Los usuarios pueden insertar citas en su tenant" ON citas;
DROP POLICY IF EXISTS "Los usuarios pueden actualizar citas de su tenant" ON citas;
DROP POLICY IF EXISTS "Los usuarios pueden eliminar citas de su tenant" ON citas;

-- 2. Crear políticas permisivas para TODOS los usuarios autenticados 
-- (Ideal para asegurar que la app no falle por subconsultas complejas de tenants durante el desarrollo)
CREATE POLICY "Permitir SELECT a autenticados" ON citas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir INSERT a autenticados" ON citas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Permitir UPDATE a autenticados" ON citas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Permitir DELETE a autenticados" ON citas FOR DELETE TO authenticated USING (true);

/* 
======================================================================
OPCIONAL (MODO DESARROLLO EXTREMO):
Si sigues teniendo el error "permission denied" porque el cliente de
Supabase (en React) está perdiendo la sesión y enviando las peticiones
como 'anon', ejecuta también el bloque de abajo.
======================================================================
*/

-- CREATE POLICY "Dev Mode - Permitir SELECT publico" ON citas FOR SELECT TO anon USING (true);
-- CREATE POLICY "Dev Mode - Permitir INSERT publico" ON citas FOR INSERT TO anon WITH CHECK (true);
-- CREATE POLICY "Dev Mode - Permitir UPDATE publico" ON citas FOR UPDATE TO anon USING (true);
-- CREATE POLICY "Dev Mode - Permitir DELETE publico" ON citas FOR DELETE TO anon USING (true);
