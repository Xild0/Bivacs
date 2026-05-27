/**
 * @file verificaPercorsi.js
 * @description Verifica le associazioni percorso GPX → bivacco.
 * Legge i file GPX da uploads/gpx, calcola la distanza minima tra il tracciato
 * e il bivacco associato, e segnala anomalie.
 *
 * Uso: node src/scripts/verificaPercorsi.js
 */

const fs = require('fs')
const path = require('path')
const { XMLParser } = require('fast-xml-parser')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })

const connectDB = require('../config/db')
const Percorso = require('../models/percorso')
const Bivacco = require('../models/bivacco')

const GPX_DIR = path.join(__dirname, '../../uploads/gpx')
const SOGLIA_SOSPETTA_METRI = 2000

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const toRad = deg => deg * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function parseGpxPoints(filePath) {
  if (!fs.existsSync(filePath)) return []
  const xml = fs.readFileSync(filePath, 'utf8')
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' })
  const gpx = parser.parse(xml)
  let points = gpx?.gpx?.trk?.trkseg?.trkpt || []
  if (!Array.isArray(points)) points = [points]
  return points
    .map(p => ({ lat: Number(p.lat), lon: Number(p.lon) }))
    .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon))
}

function minDistanceToBivacco(points, bivacco) {
  let min = Infinity
  for (const pt of points) {
    const d = haversine(
      pt.lat, pt.lon,
      Number(bivacco.latitudine), Number(bivacco.longitudine)
    )
    if (d < min) min = d
  }
  return min
}

async function main() {
  await connectDB()

  const percorsi = await Percorso.find().populate('bivacco')
  const bivacchi = await Bivacco.find()

  console.log('\n=============================================')
  console.log(`  Percorsi nel DB: ${percorsi.length}`)
  console.log(`  Bivacchi nel DB: ${bivacchi.length}`)
  console.log('=============================================\n')

  // 1) Percorsi senza bivacco
  const orfani = percorsi.filter(p => !p.bivacco)
  console.log(`--- Percorsi SENZA bivacco associato: ${orfani.length} ---`)
  orfani.forEach(p => console.log(`  [orfano] ${p.gpxFile}`))
  console.log('')

  // 2) Associazioni + distanza minima tracciato-bivacco
  console.log('--- Associazioni percorso → bivacco (distanza minima) ---')
  const sospetti = []
  for (const p of percorsi) {
    if (!p.bivacco) continue

    const filePath = path.join(GPX_DIR, p.gpxFile)
    const points = parseGpxPoints(filePath)

    if (points.length === 0) {
      console.log(`  [file mancante/vuoto] ${p.gpxFile} → ${p.bivacco.nome}`)
      continue
    }

    const dist = Math.round(minDistanceToBivacco(points, p.bivacco))
    const flag = dist > SOGLIA_SOSPETTA_METRI ? '  <-- SOSPETTO' : ''
    console.log(`  ${p.gpxFile.padEnd(26)} → ${p.bivacco.nome.padEnd(34)} ${dist} m${flag}`)

    if (dist > SOGLIA_SOSPETTA_METRI) {
      sospetti.push({ file: p.gpxFile, bivacco: p.bivacco.nome, dist })
    }
  }
  console.log('')

  // 3) Bivacchi senza percorso
  const conPercorso = new Set()
  percorsi.forEach(p => p.bivacco && conPercorso.add(String(p.bivacco._id)))
  const senzaPercorso = bivacchi.filter(b => !conPercorso.has(String(b._id)))
  console.log(`--- Bivacchi SENZA percorso: ${senzaPercorso.length} ---`)
  senzaPercorso.forEach(b => console.log(`  [no percorso] ${b.nome} (${b.zona})`))
  console.log('')

  // 4) Riepilogo sospetti
  console.log(`--- Associazioni SOSPETTE (>${SOGLIA_SOSPETTA_METRI} m): ${sospetti.length} ---`)
  sospetti.forEach(s => console.log(`  ${s.file} → ${s.bivacco} (${s.dist} m)`))

  console.log('\nVerifica completata.\n')
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})