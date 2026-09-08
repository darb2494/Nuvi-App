-- Agregar columna de costo a la tabla de citas
ALTER TABLE citas ADD COLUMN costo NUMERIC DEFAULT 0;

-- (Opcional) Si quieres que las citas anteriores que no tenían costo empiecen en 0
UPDATE citas SET costo = 0 WHERE costo IS NULL;
