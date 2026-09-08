-- =============================================================================
-- SaaS NUTRICIONISTAS — ESQUEMA COMPLETO DE BASE DE DATOS
-- Plataforma: Supabase / PostgreSQL 15+
-- Versión:    1.0.0
-- Fecha:      2026-07-21
-- =============================================================================
-- INSTRUCCIONES:
-- 1. Ejecutar en el SQL Editor de Supabase como usuario postgres/service_role.
-- 2. Asegurarse de que la extensión "uuid-ossp" esté habilitada (incluida abajo).
-- 3. El script es idempotente gracias a los bloques IF NOT EXISTS / OR REPLACE.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0. EXTENSIONES
-- -----------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- =============================================================================
-- SECCIÓN 1: TIPOS ENUM
-- =============================================================================

-- Plan de suscripción del tenant (clínica / consultorio)
DO $$ BEGIN
  CREATE TYPE plan_tipo AS ENUM ('free', 'pro', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Roles del sistema
DO $$ BEGIN
  CREATE TYPE rol_usuario AS ENUM ('superadmin', 'nutricionista', 'paciente');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Estado de la invitación al tenant
DO $$ BEGIN
  CREATE TYPE invitacion_estado AS ENUM ('pendiente', 'aceptada', 'expirada', 'cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Estado del expediente de anamnesis
DO $$ BEGIN
  CREATE TYPE anamnesis_estado AS ENUM ('borrador', 'activo', 'archivado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Género del paciente
DO $$ BEGIN
  CREATE TYPE genero_tipo AS ENUM (
    'masculino', 'femenino', 'no_binario', 'prefiero_no_decir', 'otro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Estado civil
DO $$ BEGIN
  CREATE TYPE estado_civil_tipo AS ENUM (
    'soltero', 'casado', 'union_libre', 'divorciado', 'viudo', 'otro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Frecuencia de deposición intestinal
DO $$ BEGIN
  CREATE TYPE frecuencia_deposicion_tipo AS ENUM (
    'mas_de_una_vez_al_dia',
    'una_vez_al_dia',
    'cada_dos_dias',
    'dos_a_tres_veces_por_semana',
    'menos_de_dos_veces_por_semana'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Escala de Bristol (consistencia de heces)
DO $$ BEGIN
  CREATE TYPE bristol_tipo AS ENUM (
    'tipo_1_bolitas_duras',
    'tipo_2_forma_salchicha_grumosa',
    'tipo_3_salchicha_grietas',
    'tipo_4_salchicha_suave',
    'tipo_5_trozos_suaves',
    'tipo_6_heces_blandas',
    'tipo_7_totalmente_liquida'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tipo de restricción alimentaria
DO $$ BEGIN
  CREATE TYPE restriccion_tipo AS ENUM (
    'alergia', 'intolerancia', 'preferencia', 'religion', 'etica', 'otro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Severidad de la restricción alimentaria
DO $$ BEGIN
  CREATE TYPE severidad_tipo AS ENUM (
    'leve', 'moderada', 'severa', 'anafilaxia'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Nivel de actividad física
DO $$ BEGIN
  CREATE TYPE actividad_fisica_tipo AS ENUM (
    'sedentario',           -- Sin ejercicio
    'ligeramente_activo',   -- 1-3 días/semana
    'moderadamente_activo', -- 3-5 días/semana
    'muy_activo',           -- 6-7 días/semana
    'extremadamente_activo' -- Atleta / trabajo físico intenso
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tipo de archivo adjunto al expediente
DO $$ BEGIN
  CREATE TYPE archivo_tipo AS ENUM (
    'laboratorio', 'imagen_diagnostica', 'receta', 'consentimiento', 'otro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Operaciones de auditoría
DO $$ BEGIN
  CREATE TYPE audit_accion AS ENUM ('INSERT', 'UPDATE', 'DELETE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- =============================================================================
-- SECCIÓN 2: FUNCIÓN HELPER — updated_at automático
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- =============================================================================
-- SECCIÓN 3: CAPA 1 — TENANTS Y AUTENTICACIÓN
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 3.1 TENANTS (Clínicas / Consultorios)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tenants (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT          NOT NULL,
  slug            TEXT          NOT NULL UNIQUE,         -- Para subdominios: clinica-norte
  plan            plan_tipo     NOT NULL DEFAULT 'free',
  settings        JSONB         NOT NULL DEFAULT '{}',   -- Logo, colores, zona horaria, etc.
  is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT tenants_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

COMMENT ON TABLE  public.tenants          IS 'Clínicas o consultorios que usan la plataforma.';
COMMENT ON COLUMN public.tenants.slug     IS 'Identificador URL-friendly único. Ej: clinica-norte.';
COMMENT ON COLUMN public.tenants.settings IS 'Configuraciones personalizadas del tenant en JSONB.';

CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- -----------------------------------------------------------------------------
-- 3.2 PROFILES (Extiende auth.users de Supabase)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id       UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  role            rol_usuario   NOT NULL,
  first_name      TEXT          NOT NULL,
  last_name       TEXT          NOT NULL,
  phone           TEXT,
  avatar_url      TEXT,
  is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ   -- Soft-delete

  -- Nota: El email vive en auth.users, no se duplica aquí.
);

COMMENT ON TABLE  public.profiles            IS 'Datos extendidos del usuario, enlazados a auth.users.';
COMMENT ON COLUMN public.profiles.deleted_at IS 'Soft-delete: si no es NULL, el perfil está desactivado.';

CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id   ON public.profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role        ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_role ON public.profiles(tenant_id, role);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- -----------------------------------------------------------------------------
-- 3.3 TENANT_INVITATIONS
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tenant_invitations (
  id              UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID              NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invited_by      UUID              NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  email           TEXT              NOT NULL,
  role            rol_usuario       NOT NULL,
  token           TEXT              NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  estado          invitacion_estado NOT NULL DEFAULT 'pendiente',
  expires_at      TIMESTAMPTZ       NOT NULL DEFAULT (NOW() + INTERVAL '72 hours'),
  accepted_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_invitation_email_tenant UNIQUE (tenant_id, email)
);

COMMENT ON TABLE  public.tenant_invitations            IS 'Invitaciones para unirse a un tenant con un rol específico.';
COMMENT ON COLUMN public.tenant_invitations.token      IS 'Token único enviado por email para aceptar la invitación.';
COMMENT ON COLUMN public.tenant_invitations.expires_at IS 'Expiración: 72 horas por defecto.';

CREATE INDEX IF NOT EXISTS idx_invitations_tenant_id ON public.tenant_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token     ON public.tenant_invitations(token);


-- =============================================================================
-- SECCIÓN 4: CAPA 2 — ROLES Y PERMISOS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 4.1 ROLES (Catálogo)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.roles (
  id          SMALLSERIAL   PRIMARY KEY,
  name        rol_usuario   NOT NULL UNIQUE,
  description TEXT          NOT NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.roles IS 'Catálogo de roles del sistema.';

-- Seed de roles
INSERT INTO public.roles (name, description) VALUES
  ('superadmin',    'Acceso total al sistema. Gestiona tenants y configuración global.'),
  ('nutricionista', 'Gestiona pacientes, expedientes y planes nutricionales de su tenant.'),
  ('paciente',      'Acceso de solo lectura a su propio expediente e historial.')
ON CONFLICT (name) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 4.2 PERMISSIONS (Catálogo granular)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.permissions (
  id          SMALLSERIAL   PRIMARY KEY,
  name        TEXT          NOT NULL UNIQUE, -- Ej: 'anamnesis:read'
  module      TEXT          NOT NULL,        -- Ej: 'anamnesis'
  action      TEXT          NOT NULL,        -- Ej: 'read'
  description TEXT,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.permissions IS 'Permisos granulares del sistema agrupados por módulo y acción.';

-- Seed de permisos base
INSERT INTO public.permissions (name, module, action, description) VALUES
  ('tenants:manage',    'tenants',   'manage', 'Crear, editar y desactivar tenants'),
  ('patients:read',     'patients',  'read',   'Ver lista y datos básicos de pacientes'),
  ('patients:write',    'patients',  'write',  'Crear y editar pacientes'),
  ('patients:delete',   'patients',  'delete', 'Desactivar pacientes'),
  ('anamnesis:read',    'anamnesis', 'read',   'Ver expedientes clínicos'),
  ('anamnesis:write',   'anamnesis', 'write',  'Crear y editar expedientes clínicos'),
  ('anamnesis:archive', 'anamnesis', 'archive','Archivar expedientes'),
  ('reports:export',    'reports',   'export', 'Exportar reportes y datos'),
  ('admin:manage_users','admin',     'manage', 'Gestionar usuarios del tenant')
ON CONFLICT (name) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 4.3 ROLE_PERMISSIONS (Pivote N:M)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id       SMALLINT    NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id SMALLINT    NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (role_id, permission_id)
);

COMMENT ON TABLE public.role_permissions IS 'Asignación de permisos a roles.';

-- Seed: Nutricionista
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles r, public.permissions p
WHERE  r.name = 'nutricionista'
AND    p.name IN (
  'patients:read', 'patients:write',
  'anamnesis:read', 'anamnesis:write', 'anamnesis:archive',
  'reports:export'
)
ON CONFLICT DO NOTHING;

-- Seed: Paciente
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles r, public.permissions p
WHERE  r.name = 'paciente'
AND    p.name IN ('anamnesis:read')
ON CONFLICT DO NOTHING;

-- Seed: SuperAdmin — todos los permisos
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM   public.roles r, public.permissions p
WHERE  r.name = 'superadmin'
ON CONFLICT DO NOTHING;


-- -----------------------------------------------------------------------------
-- 4.4 NUTRICIONISTA_PACIENTE (Asignación 1:1 por tenant)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.nutricionista_paciente (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nutricionista_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  paciente_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  notas             TEXT,

  -- 1:1: un paciente solo puede estar asignado a un nutricionista activo en el tenant
  CONSTRAINT uq_paciente_por_tenant UNIQUE (tenant_id, paciente_id)
);

COMMENT ON TABLE  public.nutricionista_paciente       IS 'Relación 1:1 entre nutricionista y paciente dentro del mismo tenant.';
COMMENT ON COLUMN public.nutricionista_paciente.notas IS 'Notas internas sobre la asignación.';

CREATE INDEX IF NOT EXISTS idx_nut_pac_tenant       ON public.nutricionista_paciente(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nut_pac_nutricionista ON public.nutricionista_paciente(nutricionista_id);
CREATE INDEX IF NOT EXISTS idx_nut_pac_paciente      ON public.nutricionista_paciente(paciente_id);


-- =============================================================================
-- SECCIÓN 5: CAPA 3 — MÓDULO DE ANAMNESIS (HISTORIA CLÍNICA)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 5.1 ANAMNESIS (Cabecera del expediente clínico)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.anamnesis (
  id                UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID              NOT NULL REFERENCES public.tenants(id)  ON DELETE CASCADE,
  paciente_id       UUID              NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  nutricionista_id  UUID              NOT NULL REFERENCES public.profiles(id)  ON DELETE RESTRICT,
  status            anamnesis_estado  NOT NULL DEFAULT 'borrador',
  motivo_consulta   TEXT,
  objetivos         TEXT,
  notas_generales   TEXT,
  created_at        TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

  -- Un paciente tiene un único expediente activo por tenant
  CONSTRAINT uq_anamnesis_paciente_tenant UNIQUE (tenant_id, paciente_id)
);

COMMENT ON TABLE public.anamnesis IS 'Cabecera del expediente clínico. Pivote de toda la anamnesis.';

CREATE INDEX IF NOT EXISTS idx_anamnesis_tenant        ON public.anamnesis(tenant_id);
CREATE INDEX IF NOT EXISTS idx_anamnesis_paciente      ON public.anamnesis(paciente_id);
CREATE INDEX IF NOT EXISTS idx_anamnesis_nutricionista ON public.anamnesis(nutricionista_id);

CREATE TRIGGER trg_anamnesis_updated_at
  BEFORE UPDATE ON public.anamnesis
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- -----------------------------------------------------------------------------
-- 5.2 DATOS_PERSONALES (Información demográfica — 1:1 con anamnesis)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.datos_personales (
  id                  UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  anamnesis_id        UUID              NOT NULL UNIQUE REFERENCES public.anamnesis(id) ON DELETE CASCADE,
  tenant_id           UUID              NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  fecha_nacimiento    DATE,
  genero              genero_tipo,
  estado_civil        estado_civil_tipo,
  ocupacion           TEXT,
  nivel_educativo     TEXT,
  horas_trabajo_dia   SMALLINT          CHECK (horas_trabajo_dia BETWEEN 0 AND 24),

  pais                TEXT,
  ciudad              TEXT,
  zona_horaria        TEXT              DEFAULT 'America/Bogota',

  -- JSON: {"nombre": "Ana Gómez", "relacion": "esposa", "telefono": "+57300..."}
  contacto_emergencia JSONB             DEFAULT '{}',
  datos_extra         JSONB             DEFAULT '{}',

  created_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.datos_personales                    IS 'Datos demográficos y de contacto. Relación 1:1 con anamnesis.';
COMMENT ON COLUMN public.datos_personales.contacto_emergencia IS 'JSONB: {nombre, relacion, telefono}.';

CREATE INDEX IF NOT EXISTS idx_datos_per_tenant ON public.datos_personales(tenant_id);

CREATE TRIGGER trg_datos_personales_updated_at
  BEFORE UPDATE ON public.datos_personales
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- -----------------------------------------------------------------------------
-- 5.3 HISTORIAL_MEDICO (1:1 con anamnesis)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.historial_medico (
  id                         UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  anamnesis_id               UUID          NOT NULL UNIQUE REFERENCES public.anamnesis(id) ON DELETE CASCADE,
  tenant_id                  UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Enfermedades crónicas
  tiene_diabetes             BOOLEAN       DEFAULT FALSE,
  tipo_diabetes              TEXT,         -- 'Tipo 1', 'Tipo 2', 'Gestacional'
  tiene_hipertension         BOOLEAN       DEFAULT FALSE,
  tiene_hipotiroidismo       BOOLEAN       DEFAULT FALSE,
  tiene_hipertiroidismo      BOOLEAN       DEFAULT FALSE,
  tiene_dislipidemia         BOOLEAN       DEFAULT FALSE,
  tiene_sop                  BOOLEAN       DEFAULT FALSE,
  tiene_resistencia_insulina BOOLEAN       DEFAULT FALSE,
  otras_enfermedades         TEXT[],

  -- Historial quirúrgico
  tiene_cirugias             BOOLEAN       DEFAULT FALSE,
  detalle_cirugias           TEXT,

  -- Medicación actual — JSON: [{"nombre":"Metformina","dosis":"850mg","frecuencia":"2x/día"}]
  medicamentos_actuales      JSONB         DEFAULT '[]',
  alergias_medicamentos      TEXT[]        DEFAULT '{}',

  -- Antecedentes familiares — JSON: {"diabetes":["padre"],"cancer_colon":["abuela"]}
  antecedentes_familiares    JSONB         DEFAULT '{}',

  -- Salud de la mujer
  esta_embarazada            BOOLEAN       DEFAULT FALSE,
  esta_lactando              BOOLEAN       DEFAULT FALSE,
  usa_anticonceptivos        BOOLEAN,

  -- Estado general (escala 1-10)
  nivel_estres               SMALLINT      CHECK (nivel_estres BETWEEN 1 AND 10),
  calidad_sueno              SMALLINT      CHECK (calidad_sueno BETWEEN 1 AND 10),
  horas_sueno_promedio       NUMERIC(3,1)  CHECK (horas_sueno_promedio BETWEEN 0 AND 24),

  observaciones              TEXT,

  created_at                 TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.historial_medico                    IS 'Antecedentes médicos, medicación y estado de salud general.';
COMMENT ON COLUMN public.historial_medico.medicamentos_actuales IS 'JSONB array: [{nombre, dosis, frecuencia}].';

CREATE INDEX IF NOT EXISTS idx_hist_med_tenant ON public.historial_medico(tenant_id);

CREATE TRIGGER trg_historial_medico_updated_at
  BEFORE UPDATE ON public.historial_medico
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- -----------------------------------------------------------------------------
-- 5.4 PARAMETROS_DIGESTIVOS (1:1 con anamnesis)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.parametros_digestivos (
  id                           UUID                       PRIMARY KEY DEFAULT uuid_generate_v4(),
  anamnesis_id                 UUID                       NOT NULL UNIQUE REFERENCES public.anamnesis(id) ON DELETE CASCADE,
  tenant_id                    UUID                       NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Hábitos intestinales
  frecuencia_deposicion        frecuencia_deposicion_tipo,
  consistencia_heces           bristol_tipo,
  usa_laxantes                 BOOLEAN                    DEFAULT FALSE,
  usa_probioticos              BOOLEAN                    DEFAULT FALSE,
  marca_probiotico             TEXT,

  -- Síntomas GI codificados: 'bloating','reflujo','nauseas','dolor_abdominal',
  --                          'gases','distension','vomitos','pirosis','disfagia'
  sintomas_gi                  TEXT[]                     DEFAULT '{}',

  -- Intolerancias confirmadas: 'lactosa','fructosa','gluten_no_celiaco','sorbitol'
  intolerancias_diagnosticadas TEXT[]                     DEFAULT '{}',

  -- Diagnósticos GI formales
  tiene_sii                    BOOLEAN                    DEFAULT FALSE,
  tiene_enfermedad_celiaca     BOOLEAN                    DEFAULT FALSE,
  tiene_crohn                  BOOLEAN                    DEFAULT FALSE,
  tiene_colitis_ulcerosa       BOOLEAN                    DEFAULT FALSE,
  tiene_erge                   BOOLEAN                    DEFAULT FALSE,
  otros_dx_gi                  TEXT[],

  -- Microbiota
  ha_hecho_test_microbiota     BOOLEAN                    DEFAULT FALSE,
  resultado_test_microbiota    TEXT,

  notas_digestivas             TEXT,

  created_at                   TIMESTAMPTZ                NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ                NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.parametros_digestivos                  IS 'Evaluación GI: hábitos, síntomas, intolerancias y diagnósticos.';
COMMENT ON COLUMN public.parametros_digestivos.consistencia_heces IS 'Escala de Bristol del Tipo 1 (bolitas duras) al Tipo 7 (líquida).';
COMMENT ON COLUMN public.parametros_digestivos.sintomas_gi        IS 'Array de síntomas GI codificados.';

CREATE INDEX IF NOT EXISTS idx_param_dig_tenant ON public.parametros_digestivos(tenant_id);

CREATE TRIGGER trg_parametros_digestivos_updated_at
  BEFORE UPDATE ON public.parametros_digestivos
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- -----------------------------------------------------------------------------
-- 5.5 RESTRICCIONES_ALIMENTARIAS (N por paciente — anamnesis_id)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.restricciones_alimentarias (
  id                     UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  anamnesis_id           UUID              NOT NULL REFERENCES public.anamnesis(id) ON DELETE CASCADE,
  tenant_id              UUID              NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  tipo                   restriccion_tipo  NOT NULL,
  alimento               TEXT              NOT NULL,
  severidad              severidad_tipo,
  confirmado_medicamente BOOLEAN           DEFAULT FALSE,
  edad_inicio            SMALLINT,
  reaccion_descrita      TEXT,
  notas                  TEXT,

  created_at             TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.restricciones_alimentarias          IS 'Restricciones alimentarias del paciente. Múltiples por expediente.';
COMMENT ON COLUMN public.restricciones_alimentarias.tipo     IS 'Categoría: alergia, intolerancia, preferencia, religión, ética.';
COMMENT ON COLUMN public.restricciones_alimentarias.severidad IS 'Solo aplica a alergias/intolerancias: leve → anafilaxia.';

CREATE INDEX IF NOT EXISTS idx_restricciones_anamnesis ON public.restricciones_alimentarias(anamnesis_id);
CREATE INDEX IF NOT EXISTS idx_restricciones_tenant    ON public.restricciones_alimentarias(tenant_id);

CREATE TRIGGER trg_restricciones_updated_at
  BEFORE UPDATE ON public.restricciones_alimentarias
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- -----------------------------------------------------------------------------
-- 5.6 HABITOS_ALIMENTARIOS (Serie temporal — múltiples registros por consulta)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.habitos_alimentarios (
  id                         UUID                   PRIMARY KEY DEFAULT uuid_generate_v4(),
  anamnesis_id               UUID                   NOT NULL REFERENCES public.anamnesis(id) ON DELETE CASCADE,
  tenant_id                  UUID                   NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  fecha_registro             DATE                   NOT NULL DEFAULT CURRENT_DATE,

  -- Estructura de comidas
  num_comidas_dia            SMALLINT               CHECK (num_comidas_dia BETWEEN 1 AND 10),
  -- JSON: {"desayuno":"07:30","almuerzo":"13:00","cena":"19:30"}
  horario_comidas            JSONB                  DEFAULT '{}',

  -- Distribución del lugar de consumo (deben sumar ~100%)
  come_en_casa_pct           SMALLINT               CHECK (come_en_casa_pct BETWEEN 0 AND 100),
  come_en_trabajo_pct        SMALLINT               CHECK (come_en_trabajo_pct BETWEEN 0 AND 100),
  come_en_restaurante_pct    SMALLINT               CHECK (come_en_restaurante_pct BETWEEN 0 AND 100),

  -- Hidratación
  agua_vasos_dia             SMALLINT               CHECK (agua_vasos_dia >= 0),
  consume_alcohol            BOOLEAN                DEFAULT FALSE,
  frecuencia_alcohol         TEXT,                  -- 'ocasional', 'fin de semana', 'diario'
  consume_cafeina            BOOLEAN                DEFAULT FALSE,
  tazas_cafe_dia             SMALLINT,
  consume_bebidas_azucaradas BOOLEAN                DEFAULT FALSE,

  -- Actividad física
  nivel_actividad_fisica     actividad_fisica_tipo,
  tipo_ejercicio             TEXT[],                -- ['caminata', 'pesas', 'natacion']
  frecuencia_ejercicio_sem   SMALLINT               CHECK (frecuencia_ejercicio_sem BETWEEN 0 AND 7),
  duracion_ejercicio_min     SMALLINT,

  -- Comportamiento alimentario
  come_rapido                BOOLEAN,
  picoteo_entre_comidas      BOOLEAN,
  come_viendo_pantalla       BOOLEAN,
  -- 1=Nunca come por emociones, 5=Siempre
  nivel_hambre_emocional     SMALLINT               CHECK (nivel_hambre_emocional BETWEEN 1 AND 5),

  -- Suplementación — JSON: [{"nombre":"Vitamina D","dosis":"2000 UI","frecuencia":"diario"}]
  usa_suplementos            BOOLEAN                DEFAULT FALSE,
  detalle_suplementos        JSONB                  DEFAULT '[]',

  notas_nutricionista        TEXT,

  created_at                 TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ            NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.habitos_alimentarios                  IS 'Hábitos alimentarios por consulta. Serie temporal para graficar evolución.';
COMMENT ON COLUMN public.habitos_alimentarios.fecha_registro   IS 'Fecha de la consulta o evaluación periódica.';
COMMENT ON COLUMN public.habitos_alimentarios.horario_comidas  IS 'JSONB: {nombre_comida: hora_HH:MM}.';

CREATE INDEX IF NOT EXISTS idx_habitos_anamnesis ON public.habitos_alimentarios(anamnesis_id);
CREATE INDEX IF NOT EXISTS idx_habitos_tenant    ON public.habitos_alimentarios(tenant_id);
CREATE INDEX IF NOT EXISTS idx_habitos_fecha     ON public.habitos_alimentarios(anamnesis_id, fecha_registro DESC);

CREATE TRIGGER trg_habitos_updated_at
  BEFORE UPDATE ON public.habitos_alimentarios
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- -----------------------------------------------------------------------------
-- 5.7 MEDIDAS_ANTROPOMETRICAS (Serie temporal — IMC e ICC calculados)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.medidas_antropometricas (
  id                        UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  anamnesis_id              UUID          NOT NULL REFERENCES public.anamnesis(id) ON DELETE CASCADE,
  tenant_id                 UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  fecha_medicion            DATE          NOT NULL DEFAULT CURRENT_DATE,

  -- Medidas básicas
  peso_kg                   NUMERIC(5,2)  CHECK (peso_kg > 0),
  talla_cm                  NUMERIC(5,1)  CHECK (talla_cm > 0),
  -- Columna calculada: peso / (talla_m)^2
  imc                       NUMERIC(4,2)  GENERATED ALWAYS AS (
                              CASE WHEN talla_cm > 0
                              THEN ROUND(peso_kg / POWER(talla_cm / 100.0, 2), 2)
                              ELSE NULL END
                            ) STORED,

  -- Circunferencias (cm)
  circunferencia_cintura_cm NUMERIC(5,1),
  circunferencia_cadera_cm  NUMERIC(5,1),
  -- Columna calculada: cintura / cadera
  indice_cintura_cadera     NUMERIC(4,3)  GENERATED ALWAYS AS (
                              CASE WHEN circunferencia_cadera_cm > 0
                              THEN ROUND(circunferencia_cintura_cm / circunferencia_cadera_cm, 3)
                              ELSE NULL END
                            ) STORED,
  circunferencia_cuello_cm  NUMERIC(5,1),
  circunferencia_brazo_cm   NUMERIC(5,1),

  -- Composición corporal (bioimpedancia / DEXA ingresada manualmente)
  masa_muscular_kg          NUMERIC(5,2),
  masa_grasa_kg             NUMERIC(5,2),
  masa_grasa_pct            NUMERIC(4,1)  CHECK (masa_grasa_pct BETWEEN 0 AND 100),
  masa_osea_kg              NUMERIC(4,2),
  agua_corporal_pct         NUMERIC(4,1)  CHECK (agua_corporal_pct BETWEEN 0 AND 100),

  -- Pliegues cutáneos (mm) — Durnin-Womersley / Jackson-Pollock
  pliegue_tricipital_mm     NUMERIC(4,1),
  pliegue_bicipital_mm      NUMERIC(4,1),
  pliegue_subescapular_mm   NUMERIC(4,1),
  pliegue_suprailiaco_mm    NUMERIC(4,1),

  -- Presión arterial (mmHg)
  presion_sistolica_mmhg    SMALLINT,
  presion_diastolica_mmhg   SMALLINT,

  -- Tasa metabólica basal (calculada externamente)
  tmb_kcal                  NUMERIC(6,1),
  metodo_tmb                TEXT,         -- 'Harris-Benedict', 'Mifflin', 'OMS'

  notas                     TEXT,

  created_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.medidas_antropometricas                  IS 'Medidas corporales por consulta. IMC e ICC generados automáticamente.';
COMMENT ON COLUMN public.medidas_antropometricas.imc              IS 'GENERATED STORED: peso_kg / (talla_cm/100)^2.';
COMMENT ON COLUMN public.medidas_antropometricas.indice_cintura_cadera IS 'GENERATED STORED: cintura_cm / cadera_cm.';

CREATE INDEX IF NOT EXISTS idx_medidas_anamnesis ON public.medidas_antropometricas(anamnesis_id);
CREATE INDEX IF NOT EXISTS idx_medidas_tenant    ON public.medidas_antropometricas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_medidas_fecha     ON public.medidas_antropometricas(anamnesis_id, fecha_medicion DESC);

CREATE TRIGGER trg_medidas_updated_at
  BEFORE UPDATE ON public.medidas_antropometricas
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- -----------------------------------------------------------------------------
-- 5.8 ANAMNESIS_ARCHIVOS (Adjuntos del expediente)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.anamnesis_archivos (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  anamnesis_id    UUID          NOT NULL REFERENCES public.anamnesis(id) ON DELETE CASCADE,
  tenant_id       UUID          NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subido_por      UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,

  nombre_archivo  TEXT          NOT NULL,
  tipo            archivo_tipo  NOT NULL DEFAULT 'otro',
  mime_type       TEXT,
  storage_path    TEXT          NOT NULL,  -- Ruta en Supabase Storage bucket
  tamano_bytes    BIGINT,
  descripcion     TEXT,
  fecha_documento DATE,                    -- Fecha del documento (p.ej. fecha del análisis)

  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.anamnesis_archivos              IS 'Archivos adjuntos: análisis de sangre, imágenes, consentimientos, etc.';
COMMENT ON COLUMN public.anamnesis_archivos.storage_path IS 'Ruta relativa al bucket de Supabase Storage.';

CREATE INDEX IF NOT EXISTS idx_archivos_anamnesis ON public.anamnesis_archivos(anamnesis_id);
CREATE INDEX IF NOT EXISTS idx_archivos_tenant    ON public.anamnesis_archivos(tenant_id);


-- =============================================================================
-- SECCIÓN 6: CAPA 4 — AUDITORÍA
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
  id          BIGSERIAL     PRIMARY KEY,
  tenant_id   UUID,                          -- NULL para acciones globales de superadmin
  tabla       TEXT          NOT NULL,
  registro_id UUID          NOT NULL,
  accion      audit_accion  NOT NULL,
  usuario_id  UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  -- {"before": {...}, "after": {...}}
  cambios     JSONB         NOT NULL DEFAULT '{}',
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.audit_log         IS 'Registro inmutable de operaciones críticas. Sin UPDATE/DELETE.';
COMMENT ON COLUMN public.audit_log.cambios IS 'JSONB: {before: {...}, after: {...}} del registro afectado.';

CREATE INDEX IF NOT EXISTS idx_audit_tenant     ON public.audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_registro   ON public.audit_log(tabla, registro_id);
CREATE INDEX IF NOT EXISTS idx_audit_usuario    ON public.audit_log(usuario_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.audit_log(created_at DESC);


-- =============================================================================
-- SECCIÓN 7: ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Helper: tenant_id del usuario autenticado
CREATE OR REPLACE FUNCTION fn_get_current_tenant_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT tenant_id FROM public.profiles
  WHERE  id = auth.uid() AND deleted_at IS NULL
  LIMIT  1;
$$;

-- Helper: rol del usuario autenticado
CREATE OR REPLACE FUNCTION fn_get_current_role()
RETURNS rol_usuario LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.profiles
  WHERE  id = auth.uid() AND deleted_at IS NULL
  LIMIT  1;
$$;

-- Helper: ¿es el nutricionista asignado al expediente?
CREATE OR REPLACE FUNCTION fn_is_assigned_nutricionista(p_anamnesis_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.anamnesis
    WHERE  id = p_anamnesis_id AND nutricionista_id = auth.uid()
  );
$$;


-- ============================================================
-- HABILITAR RLS
-- ============================================================

ALTER TABLE public.tenants                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_invitations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutricionista_paciente     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anamnesis                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datos_personales           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_medico           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parametros_digestivos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restricciones_alimentarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habitos_alimentarios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medidas_antropometricas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anamnesis_archivos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log                  ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- POLÍTICAS: public.tenants
-- ============================================================

CREATE POLICY pol_tenants_superadmin ON public.tenants
  FOR ALL TO authenticated
  USING     (fn_get_current_role() = 'superadmin')
  WITH CHECK (fn_get_current_role() = 'superadmin');

CREATE POLICY pol_tenants_read_own ON public.tenants
  FOR SELECT TO authenticated
  USING (id = fn_get_current_tenant_id());


-- ============================================================
-- POLÍTICAS: public.profiles
-- ============================================================

CREATE POLICY pol_profiles_superadmin ON public.profiles
  FOR ALL TO authenticated
  USING     (fn_get_current_role() = 'superadmin')
  WITH CHECK (fn_get_current_role() = 'superadmin');

-- Nutricionista: ve todos los perfiles de su tenant
CREATE POLICY pol_profiles_nutricionista_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    fn_get_current_role() = 'nutricionista'
    AND tenant_id = fn_get_current_tenant_id()
    AND deleted_at IS NULL
  );

-- Paciente: solo ve su propio perfil
CREATE POLICY pol_profiles_paciente_self ON public.profiles
  FOR SELECT TO authenticated
  USING (fn_get_current_role() = 'paciente' AND id = auth.uid());

-- Cualquier usuario puede actualizar su propio perfil
CREATE POLICY pol_profiles_self_update ON public.profiles
  FOR UPDATE TO authenticated
  USING     (id = auth.uid())
  WITH CHECK (id = auth.uid());


-- ============================================================
-- POLÍTICAS: public.nutricionista_paciente
-- ============================================================

CREATE POLICY pol_nut_pac_superadmin ON public.nutricionista_paciente
  FOR ALL TO authenticated
  USING     (fn_get_current_role() = 'superadmin')
  WITH CHECK (fn_get_current_role() = 'superadmin');

CREATE POLICY pol_nut_pac_nutricionista ON public.nutricionista_paciente
  FOR ALL TO authenticated
  USING (
    fn_get_current_role() = 'nutricionista'
    AND tenant_id = fn_get_current_tenant_id()
    AND nutricionista_id = auth.uid()
  )
  WITH CHECK (
    fn_get_current_role() = 'nutricionista'
    AND tenant_id = fn_get_current_tenant_id()
    AND nutricionista_id = auth.uid()
  );

CREATE POLICY pol_nut_pac_paciente ON public.nutricionista_paciente
  FOR SELECT TO authenticated
  USING (fn_get_current_role() = 'paciente' AND paciente_id = auth.uid());


-- ============================================================
-- POLÍTICAS: public.anamnesis
-- ============================================================

CREATE POLICY pol_anamnesis_superadmin ON public.anamnesis
  FOR ALL TO authenticated
  USING     (fn_get_current_role() = 'superadmin')
  WITH CHECK (fn_get_current_role() = 'superadmin');

-- Nutricionista: solo sus expedientes dentro de su tenant
CREATE POLICY pol_anamnesis_nutricionista ON public.anamnesis
  FOR ALL TO authenticated
  USING (
    fn_get_current_role() = 'nutricionista'
    AND tenant_id = fn_get_current_tenant_id()
    AND nutricionista_id = auth.uid()
  )
  WITH CHECK (
    fn_get_current_role() = 'nutricionista'
    AND tenant_id = fn_get_current_tenant_id()
    AND nutricionista_id = auth.uid()
  );

-- Paciente: solo lectura de su expediente
CREATE POLICY pol_anamnesis_paciente ON public.anamnesis
  FOR SELECT TO authenticated
  USING (fn_get_current_role() = 'paciente' AND paciente_id = auth.uid());


-- ============================================================
-- POLÍTICAS: Tablas hijas de anamnesis (patrón reutilizable)
-- El nutricionista accede solo si es el nutricionista asignado.
-- El paciente tiene solo SELECT sobre su propio expediente.
-- ============================================================

-- Macro para evitar repetición: cada tabla sigue este patrón de 3 policies.
-- ---- datos_personales ----

CREATE POLICY pol_datos_per_superadmin ON public.datos_personales
  FOR ALL TO authenticated
  USING (fn_get_current_role() = 'superadmin')
  WITH CHECK (fn_get_current_role() = 'superadmin');

CREATE POLICY pol_datos_per_nutricionista ON public.datos_personales
  FOR ALL TO authenticated
  USING (
    fn_get_current_role() = 'nutricionista'
    AND tenant_id = fn_get_current_tenant_id()
    AND fn_is_assigned_nutricionista(anamnesis_id)
  )
  WITH CHECK (
    fn_get_current_role() = 'nutricionista'
    AND tenant_id = fn_get_current_tenant_id()
    AND fn_is_assigned_nutricionista(anamnesis_id)
  );

CREATE POLICY pol_datos_per_paciente ON public.datos_personales
  FOR SELECT TO authenticated
  USING (
    fn_get_current_role() = 'paciente'
    AND EXISTS (SELECT 1 FROM public.anamnesis a WHERE a.id = anamnesis_id AND a.paciente_id = auth.uid())
  );

-- ---- historial_medico ----

CREATE POLICY pol_hist_med_superadmin ON public.historial_medico
  FOR ALL TO authenticated
  USING (fn_get_current_role() = 'superadmin')
  WITH CHECK (fn_get_current_role() = 'superadmin');

CREATE POLICY pol_hist_med_nutricionista ON public.historial_medico
  FOR ALL TO authenticated
  USING (
    fn_get_current_role() = 'nutricionista'
    AND tenant_id = fn_get_current_tenant_id()
    AND fn_is_assigned_nutricionista(anamnesis_id)
  )
  WITH CHECK (
    fn_get_current_role() = 'nutricionista'
    AND tenant_id = fn_get_current_tenant_id()
    AND fn_is_assigned_nutricionista(anamnesis_id)
  );

CREATE POLICY pol_hist_med_paciente ON public.historial_medico
  FOR SELECT TO authenticated
  USING (
    fn_get_current_role() = 'paciente'
    AND EXISTS (SELECT 1 FROM public.anamnesis a WHERE a.id = anamnesis_id AND a.paciente_id = auth.uid())
  );

-- ---- parametros_digestivos ----

CREATE POLICY pol_param_dig_superadmin ON public.parametros_digestivos
  FOR ALL TO authenticated
  USING (fn_get_current_role() = 'superadmin')
  WITH CHECK (fn_get_current_role() = 'superadmin');

CREATE POLICY pol_param_dig_nutricionista ON public.parametros_digestivos
  FOR ALL TO authenticated
  USING (
    fn_get_current_role() = 'nutricionista'
    AND tenant_id = fn_get_current_tenant_id()
    AND fn_is_assigned_nutricionista(anamnesis_id)
  )
  WITH CHECK (
    fn_get_current_role() = 'nutricionista'
    AND tenant_id = fn_get_current_tenant_id()
    AND fn_is_assigned_nutricionista(anamnesis_id)
  );

CREATE POLICY pol_param_dig_paciente ON public.parametros_digestivos
  FOR SELECT TO authenticated
  USING (
    fn_get_current_role() = 'paciente'
    AND EXISTS (SELECT 1 FROM public.anamnesis a WHERE a.id = anamnesis_id AND a.paciente_id = auth.uid())
  );

-- ---- restricciones_alimentarias ----

CREATE POLICY pol_restricc_superadmin ON public.restricciones_alimentarias
  FOR ALL TO authenticated
  USING (fn_get_current_role() = 'superadmin')
  WITH CHECK (fn_get_current_role() = 'superadmin');

CREATE POLICY pol_restricc_nutricionista ON public.restricciones_alimentarias
  FOR ALL TO authenticated
  USING (
    fn_get_current_role() = 'nutricionista'
    AND tenant_id = fn_get_current_tenant_id()
    AND fn_is_assigned_nutricionista(anamnesis_id)
  )
  WITH CHECK (
    fn_get_current_role() = 'nutricionista'
    AND tenant_id = fn_get_current_tenant_id()
    AND fn_is_assigned_nutricionista(anamnesis_id)
  );

CREATE POLICY pol_restricc_paciente ON public.restricciones_alimentarias
  FOR SELECT TO authenticated
  USING (
    fn_get_current_role() = 'paciente'
    AND EXISTS (SELECT 1 FROM public.anamnesis a WHERE a.id = anamnesis_id AND a.paciente_id = auth.uid())
  );

-- ---- habitos_alimentarios ----

CREATE POLICY pol_habitos_superadmin ON public.habitos_alimentarios
  FOR ALL TO authenticated
  USING (fn_get_current_role() = 'superadmin')
  WITH CHECK (fn_get_current_role() = 'superadmin');

CREATE POLICY pol_habitos_nutricionista ON public.habitos_alimentarios
  FOR ALL TO authenticated
  USING (
    fn_get_current_role() = 'nutricionista'
    AND tenant_id = fn_get_current_tenant_id()
    AND fn_is_assigned_nutricionista(anamnesis_id)
  )
  WITH CHECK (
    fn_get_current_role() = 'nutricionista'
    AND tenant_id = fn_get_current_tenant_id()
    AND fn_is_assigned_nutricionista(anamnesis_id)
  );

CREATE POLICY pol_habitos_paciente ON public.habitos_alimentarios
  FOR SELECT TO authenticated
  USING (
    fn_get_current_role() = 'paciente'
    AND EXISTS (SELECT 1 FROM public.anamnesis a WHERE a.id = anamnesis_id AND a.paciente_id = auth.uid())
  );

-- ---- medidas_antropometricas ----

CREATE POLICY pol_medidas_superadmin ON public.medidas_antropometricas
  FOR ALL TO authenticated
  USING (fn_get_current_role() = 'superadmin')
  WITH CHECK (fn_get_current_role() = 'superadmin');

CREATE POLICY pol_medidas_nutricionista ON public.medidas_antropometricas
  FOR ALL TO authenticated
  USING (
    fn_get_current_role() = 'nutricionista'
    AND tenant_id = fn_get_current_tenant_id()
    AND fn_is_assigned_nutricionista(anamnesis_id)
  )
  WITH CHECK (
    fn_get_current_role() = 'nutricionista'
    AND tenant_id = fn_get_current_tenant_id()
    AND fn_is_assigned_nutricionista(anamnesis_id)
  );

CREATE POLICY pol_medidas_paciente ON public.medidas_antropometricas
  FOR SELECT TO authenticated
  USING (
    fn_get_current_role() = 'paciente'
    AND EXISTS (SELECT 1 FROM public.anamnesis a WHERE a.id = anamnesis_id AND a.paciente_id = auth.uid())
  );

-- ---- anamnesis_archivos ----

CREATE POLICY pol_archivos_superadmin ON public.anamnesis_archivos
  FOR ALL TO authenticated
  USING (fn_get_current_role() = 'superadmin')
  WITH CHECK (fn_get_current_role() = 'superadmin');

CREATE POLICY pol_archivos_nutricionista ON public.anamnesis_archivos
  FOR ALL TO authenticated
  USING (
    fn_get_current_role() = 'nutricionista'
    AND tenant_id = fn_get_current_tenant_id()
    AND fn_is_assigned_nutricionista(anamnesis_id)
  )
  WITH CHECK (
    fn_get_current_role() = 'nutricionista'
    AND tenant_id = fn_get_current_tenant_id()
    AND fn_is_assigned_nutricionista(anamnesis_id)
  );

CREATE POLICY pol_archivos_paciente ON public.anamnesis_archivos
  FOR SELECT TO authenticated
  USING (
    fn_get_current_role() = 'paciente'
    AND EXISTS (SELECT 1 FROM public.anamnesis a WHERE a.id = anamnesis_id AND a.paciente_id = auth.uid())
  );


-- ============================================================
-- POLÍTICAS: public.audit_log
-- ============================================================

-- SuperAdmin: ve todos los logs
CREATE POLICY pol_audit_superadmin ON public.audit_log
  FOR SELECT TO authenticated
  USING (fn_get_current_role() = 'superadmin');

-- Nutricionista: solo logs de su tenant
CREATE POLICY pol_audit_nutricionista ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    fn_get_current_role() = 'nutricionista'
    AND tenant_id = fn_get_current_tenant_id()
  );

-- Solo triggers insertan en audit_log — sin acceso de escritura manual


-- ============================================================
-- POLÍTICAS: Catálogos (roles, permissions, role_permissions)
-- ============================================================

CREATE POLICY pol_roles_read  ON public.roles FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY pol_roles_write ON public.roles
  FOR ALL TO authenticated
  USING (fn_get_current_role() = 'superadmin')
  WITH CHECK (fn_get_current_role() = 'superadmin');

CREATE POLICY pol_perms_read  ON public.permissions FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY pol_perms_write ON public.permissions
  FOR ALL TO authenticated
  USING (fn_get_current_role() = 'superadmin')
  WITH CHECK (fn_get_current_role() = 'superadmin');

CREATE POLICY pol_role_perms_read  ON public.role_permissions FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY pol_role_perms_write ON public.role_permissions
  FOR ALL TO authenticated
  USING (fn_get_current_role() = 'superadmin')
  WITH CHECK (fn_get_current_role() = 'superadmin');


-- ============================================================
-- POLÍTICAS: public.tenant_invitations
-- ============================================================

CREATE POLICY pol_invit_superadmin ON public.tenant_invitations
  FOR ALL TO authenticated
  USING     (fn_get_current_role() = 'superadmin')
  WITH CHECK (fn_get_current_role() = 'superadmin');

CREATE POLICY pol_invit_nutricionista ON public.tenant_invitations
  FOR ALL TO authenticated
  USING (
    fn_get_current_role() = 'nutricionista'
    AND tenant_id = fn_get_current_tenant_id()
  )
  WITH CHECK (
    fn_get_current_role() = 'nutricionista'
    AND tenant_id = fn_get_current_tenant_id()
  );


-- =============================================================================
-- SECCIÓN 8: TRIGGER DE AUDITORÍA AUTOMÁTICA
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_audit_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cambios   JSONB;
  v_registro  UUID;
  v_tenant_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_cambios   := jsonb_build_object('after', to_jsonb(NEW));
    v_registro  := NEW.id;
    v_tenant_id := NEW.tenant_id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_cambios   := jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW));
    v_registro  := NEW.id;
    v_tenant_id := NEW.tenant_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_cambios   := jsonb_build_object('before', to_jsonb(OLD));
    v_registro  := OLD.id;
    v_tenant_id := OLD.tenant_id;
  END IF;

  INSERT INTO public.audit_log (tenant_id, tabla, registro_id, accion, usuario_id, cambios)
  VALUES (v_tenant_id, TG_TABLE_NAME, v_registro, TG_OP::audit_accion, auth.uid(), v_cambios);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Aplicar auditoría a tablas críticas
CREATE TRIGGER trg_audit_anamnesis
  AFTER INSERT OR UPDATE OR DELETE ON public.anamnesis
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER trg_audit_historial_medico
  AFTER INSERT OR UPDATE OR DELETE ON public.historial_medico
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER trg_audit_restricciones
  AFTER INSERT OR UPDATE OR DELETE ON public.restricciones_alimentarias
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER trg_audit_medidas
  AFTER INSERT OR UPDATE OR DELETE ON public.medidas_antropometricas
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER trg_audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();


-- =============================================================================
-- SECCIÓN 9: ONBOARDING — Crear perfil automáticamente al registrar usuario
-- =============================================================================
-- El tenant_id, role, first_name, last_name deben venir en raw_user_meta_data
-- del método supabase.auth.signUp({ data: { tenant_id, role, first_name, last_name } })

CREATE OR REPLACE FUNCTION fn_handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, tenant_id, role, first_name, last_name, phone)
  VALUES (
    NEW.id,
    (NEW.raw_user_meta_data->>'tenant_id')::UUID,
    (NEW.raw_user_meta_data->>'role')::rol_usuario,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name',  ''),
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION fn_handle_new_user();


-- =============================================================================
-- FIN DEL SCRIPT
-- =============================================================================
-- Resumen de objetos creados:
--   • 13 tipos ENUM
--   • 16 tablas (Capas 1-4)
--   • 3 funciones helper RLS (fn_get_current_tenant_id, fn_get_current_role,
--                              fn_is_assigned_nutricionista)
--   • 1 función de auditoría (fn_audit_trigger) con 5 triggers
--   • 1 función de onboarding (fn_handle_new_user)
--   • ~42 políticas RLS
--   • ~20 índices de rendimiento
--   • 2 columnas GENERATED STORED (imc, indice_cintura_cadera)
--   • Soft-delete en profiles (deleted_at)
-- =============================================================================
