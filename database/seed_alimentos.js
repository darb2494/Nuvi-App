/**
 * seed_alimentos.js
 * Script de importación masiva de la base de datos INN/INCAP a Supabase.
 *
 * Uso (desde la carpeta database/):
 *   node seed_alimentos.js
 *
 * El script busca automáticamente el .env en ../web/.env
 * y el inn_data.js en ../Tabla de Alimentos/inn_data.js
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

// ── Utilidad: parsear .env correctamente (maneja \r\n y valores con = en JWTs) ─
function parseEnvFile(filePath) {
  const vars = {}
  if (!existsSync(filePath)) return vars
  const content = readFileSync(filePath, 'utf8')
  // Dividir por líneas y manejar tanto \r\n (Windows) como \n (Unix)
  const lines = content.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    // Solo tomamos el PRIMER '=' como separador (el valor puede tener '=' adentro)
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.substring(0, eqIndex).trim()
    const val = trimmed.substring(eqIndex + 1).trim()
    vars[key] = val
  }
  return vars
}

// ── Localizar archivos ────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)

// Rutas a buscar (en orden de prioridad)
const envCandidates = [
  resolve(__dirname, '../web/.env'),       // ../web/.env desde database/
  resolve(__dirname, '.env'),              // database/.env
  resolve(process.cwd(), '.env'),          // directorio actual
  resolve(process.cwd(), '../web/.env'),   // si se corre desde otra carpeta
]

const innCandidates = [
  resolve(__dirname, '../Tabla de Alimentos/inn_data.js'),
  resolve(process.cwd(), '../Tabla de Alimentos/inn_data.js'),
  resolve(process.cwd(), 'Tabla de Alimentos/inn_data.js'),
]

// ── Cargar .env ───────────────────────────────────────────────────────────────
let envVars = {}
let envUsed = null
for (const candidate of envCandidates) {
  if (existsSync(candidate)) {
    envVars = parseEnvFile(candidate)
    envUsed = candidate
    break
  }
}

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL          || envVars['VITE_SUPABASE_URL']
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY  || envVars['SUPABASE_SERVICE_ROLE_KEY']

console.log('\n══════════════════════════════════════════')
console.log('  🌿 Nuvi — Importador de Alimentos INN')
console.log('══════════════════════════════════════════\n')

if (envUsed) {
  console.log(`📄 .env cargado desde: ${envUsed}`)
} else {
  console.error('❌ No se encontró ningún archivo .env en las rutas buscadas:')
  envCandidates.forEach(c => console.error(`   - ${c}`))
  process.exit(1)
}

if (!SUPABASE_URL) {
  console.error('❌ VITE_SUPABASE_URL no encontrada en el .env')
  process.exit(1)
}
if (!SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY no encontrada en el .env')
  console.error('\n   Para obtenerla:')
  console.error('   1. Ve a tu proyecto en supabase.com')
  console.error('   2. Settings → API → service_role (Secret)')
  console.error('   3. Agrégala al .env como: SUPABASE_SERVICE_ROLE_KEY=eyJ...\n')
  process.exit(1)
}

console.log(`🔗 Conectando a: ${SUPABASE_URL.replace(/https:\/\/([^.]+)\..*/, 'https://$1.supabase.co')}`)
console.log(`🔑 Service Role Key: ${SERVICE_KEY.substring(0, 20)}...✓\n`)

// ── Localizar inn_data.js ─────────────────────────────────────────────────────
let innPath = null
for (const candidate of innCandidates) {
  if (existsSync(candidate)) {
    innPath = candidate
    break
  }
}

if (!innPath) {
  console.error('❌ No se encontró inn_data.js en:')
  innCandidates.forEach(c => console.error(`   - ${c}`))
  process.exit(1)
}
console.log(`📂 Leyendo datos desde: ${innPath}`)

// ── Parsear inn_data.js ───────────────────────────────────────────────────────
const rawContent = readFileSync(innPath, 'utf8')

// Extraer el array JSON del export ES module
const jsonContent = rawContent
  .replace(/^export\s+const\s+INN_DATA\s*=\s*/, '')  // Quita "export const INN_DATA ="
  .replace(/;?\s*$/, '')                               // Quita el ; final

let INN_DATA
try {
  INN_DATA = new Function(`return ${jsonContent}`)()
} catch (err) {
  console.error('❌ Error al parsear inn_data.js:', err.message)
  process.exit(1)
}

console.log(`📊 Registros cargados: ${INN_DATA.length}\n`)

// ── Crear cliente Supabase con Service Role (bypass completo de RLS) ──────────
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// ── Mapear campos INN → tabla alimentos ──────────────────────────────────────
function mapAlimento(item) {
  return {
    id:                 Number(item.Codigo),   // NUMERIC — soporta decimales como 1.3
    nombre:             item.Alimento,
    porcion_base:       item.Cantidad        ?? 100,
    calorias:           item['Calorías']     ?? null,
    proteinas:          item['Proteína']     ?? null,
    grasas:             item.Grasas          ?? null,
    carbohidratos:      item.Carbohidratos_Totales  ?? null,
    carbohidratos_disp: item.Carbohidratos_Dispon   ?? null,
    fibra:              item.Fibra_Dietética_Total   ?? null,
    es_personalizado:   false,
    tenant_id:          null,
    micros: {
      humedad:      item.Humed                      ?? null,
      fosforo:      item['Fósforo']                 ?? null,
      potasio:      item.Potasio                    ?? null,
      calcio:       item.Calcio                     ?? null,
      hierro:       item.Hierro                     ?? null,
      magnesio:     item.Magnesio                   ?? null,
      zinc:         item.Zinc                       ?? null,
      cobre:        item.Cobre                      ?? null,
      sodio:        item.Sodio                      ?? null,
      cenizas:      item.Cenizas                    ?? null,
      fibra_insol:  item.Fibra_Dietética_Insolub     ?? null,
      vitamina_a:   item.Vitamina_A                 ?? null,
      caroteno:     item.Caroteno_equiv_Total        ?? null,
      tiamina:      item.Tiamina                    ?? null,
      riboflavina:  item.Riboflavina                ?? null,
      niacina:      item.Niacina                    ?? null,
      vitamina_b6:  item.Vitamina_B6                ?? null,
      vitamina_c:   item.Acid_Ascorb                ?? null,
    }
  }
}

// ── Inserción por lotes ───────────────────────────────────────────────────────
const CHUNK_SIZE = 200

async function seed() {
  console.log('🚀 Iniciando importación a Supabase...\n')

  const rows   = INN_DATA.map(mapAlimento)
  const chunks = []
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    chunks.push(rows.slice(i, i + CHUNK_SIZE))
  }

  let totalInserted = 0
  let totalErrors   = 0

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const from  = i * CHUNK_SIZE + 1
    const to    = from + chunk.length - 1
    process.stdout.write(`  📦 Lote ${i + 1}/${chunks.length} (registros ${from}–${to})... `)

    const { error } = await supabase
      .from('alimentos')
      .upsert(chunk, { onConflict: 'id' })

    if (error) {
      console.error(`\n  ❌ Error: ${error.message}`)
      totalErrors += chunk.length
    } else {
      console.log('✅')
      totalInserted += chunk.length
    }
  }

  console.log('\n──────────────────────────────────────────')
  if (totalErrors === 0) {
    console.log(`🎉 ¡Importación exitosa! ${totalInserted} alimentos cargados.`)
  } else {
    console.log(`⚠️  Importación con errores.`)
    console.log(`   ✅ Insertados: ${totalInserted}`)
    console.log(`   ❌ Fallidos:   ${totalErrors}`)
  }
  console.log('──────────────────────────────────────────\n')
}

seed().catch(err => {
  console.error('\n💥 Error inesperado:', err)
  process.exit(1)
})
