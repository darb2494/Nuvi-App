/**
 * fix_nombres_alimentos.js
 *
 * Lee todos los alimentos de Supabase, reformatea los nombres que usan
 * la nomenclatura taxonómica invertida del INN (separada por comas) y
 * los actualiza en lotes.
 *
 * Uso:
 *   node fix_nombres_alimentos.js           → Muestra preview (dry-run)
 *   node fix_nombres_alimentos.js --apply   → Aplica los cambios en Supabase
 *
 * Ejemplos de transformación:
 *   'Pollo, carne de, enlatada'   → 'Carne de Pollo enlatada'
 *   'Pollo, hígado de'            → 'Hígado de Pollo'
 *   'Arroz Blanco, variedad Araure' → 'Arroz Blanco variedad Araure'
 *   'Arroz Blanco'                → 'Arroz Blanco'  (sin cambio)
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

// ── Credenciales ──────────────────────────────────────────────────────────────
// Opción A: ponerlas directamente aquí
const SUPABASE_URL_DIRECT      = ''   // ej: 'https://xxxx.supabase.co'
const SERVICE_ROLE_KEY_DIRECT  = ''   // ej: 'eyJhbGci...'

// Opción B: las lee automáticamente del .env del proyecto
const __filename = fileURLToPath(import.meta.url)
const __dirname  = dirname(__filename)

function parseEnvFile(filePath) {
  const vars = {}
  if (!existsSync(filePath)) return vars
  const content = readFileSync(filePath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    vars[trimmed.substring(0, eqIndex).trim()] = trimmed.substring(eqIndex + 1).trim()
  }
  return vars
}

const envVars = parseEnvFile(resolve(__dirname, '../web/.env'))
const SUPABASE_URL  = SUPABASE_URL_DIRECT  || process.env.VITE_SUPABASE_URL         || envVars['VITE_SUPABASE_URL']
const SERVICE_KEY   = SERVICE_ROLE_KEY_DIRECT || process.env.SUPABASE_SERVICE_ROLE_KEY || envVars['SUPABASE_SERVICE_ROLE_KEY']

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Faltan credenciales. Pon SUPABASE_URL y SERVICE_ROLE_KEY en el archivo o en web/.env')
  process.exit(1)
}

// ── Modo de ejecución ─────────────────────────────────────────────────────────
const DRY_RUN = !process.argv.includes('--apply')

// ── Lógica de transformación de nombres ──────────────────────────────────────

/**
 * Capitaliza solo la primera letra de un string, respetando el resto.
 * 'hígado de Pollo' → 'Hígado de Pollo'
 */
function capitalize(str) {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Detecta si un segmento termina con la preposición "de" o "del".
 * Esto es la señal de que el nombre está en formato taxonómico invertido.
 * Ejemplos que retornan TRUE: 'carne de', 'hígado de', 'alas de', 'bologna de'
 * Ejemplos que retornan FALSE: 'variedad Araure', 'enlatada', 'cocida'
 */
function terminaConDe(segmento) {
  return /\bde[l]?\s*$/i.test(segmento.trim())
}

/**
 * Reformatea un nombre usando la lógica del INN.
 *
 * Formato entrada:  [Principal], [corte/parte] de[, preparación adicional...]
 * Formato salida:   [Corte/parte] de [Principal] [preparación...]
 *
 * Si el segundo segmento NO termina en "de/del", solo se eliminan las comas
 * y se concatena limpiamente (ej. 'Arroz Blanco, variedad Araure' → 'Arroz Blanco variedad Araure').
 */
function reformatNombre(nombre) {
  if (!nombre) return nombre

  // Sin comas → sin cambio
  if (!nombre.includes(',')) return nombre

  const parts = nombre
    .split(',')
    .map(p => p.trim())
    .filter(Boolean)

  // Solo una parte tras el split → no debería pasar, pero por seguridad
  if (parts.length < 2) return nombre

  const [principal, corte, ...extras] = parts

  if (terminaConDe(corte)) {
    // ── Formato INVERTIDO (taxonómico) ───────────────────────────────────────
    // 'Pollo', 'carne de', 'enlatada' → 'Carne de Pollo enlatada'
    // 'Pollo', 'hígado de'            → 'Hígado de Pollo'
    const resultado = [corte, principal, ...extras]
      .join(' ')
      .replace(/\s{2,}/g, ' ')  // eliminar espacios dobles
      .trim()
    return capitalize(resultado)
  } else {
    // ── Formato DESCRIPTIVO (no invertido) ───────────────────────────────────
    // 'Arroz Blanco', 'variedad Araure' → 'Arroz Blanco variedad Araure'
    // 'Pollo', 'sin piel', 'crudo'      → 'Pollo sin piel crudo'
    const resultado = [principal, corte, ...extras]
      .join(' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
    return capitalize(resultado)
  }
}

// ── Tests de la lógica (se muestran antes de correr) ─────────────────────────
function runTests() {
  const casos = [
    // [entrada, salida esperada]
    ['Pollo, carne de, enlatada',            'Carne de Pollo enlatada'],
    ['Pollo, alas de, con piel',             'Alas de Pollo con piel'],
    ['Pollo, hígado de',                     'Hígado de Pollo'],
    ['Pollo, pechuga de, cocida',            'Pechuga de Pollo cocida'],
    ['Pollo, bologna de',                    'Bologna de Pollo'],
    ['Arroz Blanco, variedad Araure',        'Arroz Blanco variedad Araure'],
    ['Arroz Blanco, variedad Cimarrón',      'Arroz Blanco variedad Cimarrón'],
    ['Arroz Blanco',                         'Arroz Blanco'],
    ['Leche, entera',                        'Leche entera'],
    ['Res, lomo de, crudo',                  'Lomo de Res crudo'],
    ['Cerdo, costilla de, asada',            'Costilla de Cerdo asada'],
    ['Leche, descremada, líquida',           'Leche descremada líquida'],
    ['Atún, enlatado en aceite',             'Atún enlatado en aceite'],
    ['Maíz, harina de, precocida',           'Harina de Maíz precocida'],
  ]

  console.log('\n📋 TEST DE TRANSFORMACIONES:')
  console.log('─'.repeat(70))
  let passed = 0
  for (const [entrada, esperado] of casos) {
    const resultado = reformatNombre(entrada)
    const ok = resultado === esperado
    if (ok) passed++
    const icon = ok ? '✅' : '❌'
    console.log(`${icon} "${entrada}"`)
    console.log(`   → "${resultado}"${ok ? '' : ` (esperado: "${esperado}")`}`)
  }
  console.log('─'.repeat(70))
  console.log(`   ${passed}/${casos.length} tests pasados\n`)
  return passed === casos.length
}

// ── Cliente Supabase ──────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// ── Función principal ─────────────────────────────────────────────────────────
const CHUNK_SIZE = 100   // registros por batch de UPDATE
const PAGE_SIZE  = 1000  // registros por SELECT (paginado)

async function fixNombres() {
  console.log('\n══════════════════════════════════════════════════')
  console.log('  🌿 Nuvi — Fix de Nombres de Alimentos INN')
  console.log('══════════════════════════════════════════════════')
  console.log(`  Modo: ${DRY_RUN ? '🔍 DRY-RUN (solo preview, sin cambios)' : '💾 APLICANDO CAMBIOS EN SUPABASE'}`)
  if (DRY_RUN) {
    console.log('  → Para aplicar cambios, corre: node fix_nombres_alimentos.js --apply')
  }
  console.log()

  // Ejecutar tests
  const testsPasados = runTests()
  if (!testsPasados) {
    console.error('⚠️  Algunos tests fallaron. Revisa la lógica antes de aplicar.\n')
    if (!DRY_RUN) process.exit(1)
  }

  // ── Leer todos los registros paginados ──────────────────────────────────────
  console.log('📥 Leyendo registros desde Supabase...\n')
  let allRows = []
  let page = 0
  while (true) {
    const { data, error } = await supabase
      .from('alimentos')
      .select('id, nombre')
      .order('id')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (error) {
      console.error('❌ Error al leer:', error.message)
      process.exit(1)
    }
    if (!data || data.length === 0) break
    allRows = allRows.concat(data)
    if (data.length < PAGE_SIZE) break
    page++
  }

  console.log(`📊 Total de registros leídos: ${allRows.length}`)

  // ── Calcular transformaciones ───────────────────────────────────────────────
  const cambios = []
  const sinCambio = []

  for (const row of allRows) {
    const nuevoNombre = reformatNombre(row.nombre)
    if (nuevoNombre !== row.nombre) {
      cambios.push({ id: row.id, nombre_original: row.nombre, nombre_nuevo: nuevoNombre })
    } else {
      sinCambio.push(row)
    }
  }

  console.log(`✏️  Registros a modificar: ${cambios.length}`)
  console.log(`✔️  Registros sin cambio:  ${sinCambio.length}\n`)

  if (cambios.length === 0) {
    console.log('🎉 Todos los nombres ya están en el formato correcto. Nada que hacer.')
    return
  }

  // ── Mostrar preview de los primeros 30 cambios ──────────────────────────────
  const preview = cambios.slice(0, 30)
  console.log(`📝 PREVIEW (primeros ${preview.length} de ${cambios.length} cambios):`)
  console.log('─'.repeat(80))
  for (const c of preview) {
    console.log(`  ID ${String(c.id).padEnd(8)} "${c.nombre_original}"`)
    console.log(`           → "${c.nombre_nuevo}"`)
  }
  if (cambios.length > 30) {
    console.log(`  ... y ${cambios.length - 30} cambios más.`)
  }
  console.log('─'.repeat(80))

  if (DRY_RUN) {
    console.log('\n🔍 Modo dry-run: no se aplicaron cambios.')
    console.log('   Para aplicar, corre: node fix_nombres_alimentos.js --apply\n')
    return
  }

  // ── Aplicar cambios en lotes ────────────────────────────────────────────────
  console.log(`\n🚀 Aplicando ${cambios.length} cambios en lotes de ${CHUNK_SIZE}...\n`)

  let totalOk     = 0
  let totalFail   = 0
  const chunks    = []
  for (let i = 0; i < cambios.length; i += CHUNK_SIZE) {
    chunks.push(cambios.slice(i, i + CHUNK_SIZE))
  }

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const from  = i * CHUNK_SIZE + 1
    const to    = from + chunk.length - 1
    process.stdout.write(`  📦 Lote ${i + 1}/${chunks.length} (${from}–${to})... `)

    // Ejecutar updates en grupos pequeños de 5 (evita timeouts por sobrecarga)
    const CONCURRENT = 5
    let chunkErrors = 0
    for (let j = 0; j < chunk.length; j += CONCURRENT) {
      const group = chunk.slice(j, j + CONCURRENT)
      const results = await Promise.all(
        group.map(c =>
          supabase.from('alimentos').update({ nombre: c.nombre_nuevo }).eq('id', c.id)
        )
      )
      for (const r of results) {
        if (r.error) {
          chunkErrors++
          totalFail++
        } else {
          totalOk++
        }
      }
    }

    if (chunkErrors > 0) {
      console.log(`⚠️  ${chunkErrors} errores`)
    } else {
      console.log('✅')
    }
  }

  // ── Resumen final ───────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════')
  if (totalFail === 0) {
    console.log(`🎉 ¡Completado! ${totalOk} nombres actualizados exitosamente.`)
  } else {
    console.log(`⚠️  Completado con errores.`)
    console.log(`   ✅ Actualizados: ${totalOk}`)
    console.log(`   ❌ Fallidos:     ${totalFail}`)
  }
  console.log('══════════════════════════════════════════════════\n')
}

fixNombres().catch(err => {
  console.error('\n💥 Error inesperado:', err)
  process.exit(1)
})
