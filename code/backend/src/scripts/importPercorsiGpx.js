/**
 * @file importPercorsiGpx.js
 * @description Script di importazione dei file GPX nel database.
 * Legge i tracciati GPX, calcola lunghezza e dislivello positivo,
 * associa ogni percorso al bivacco più vicino e aggiorna la collection Percorso.
 */

const dns = require('dns')
dns.setServers(['8.8.8.8', '1.1.1.1'])

const fs = require('fs')
const path = require('path')
const { XMLParser } = require('fast-xml-parser')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })

const connectDB = require('../config/db')
const Percorso = require('../models/percorso')
const Bivacco = require('../models/bivacco')

const GPX_FOLDER = path.join(__dirname, '../../uploads/gpx')
/**
 * Calcola la distanza in metri tra due coordinate geografiche usando la formula di Haversine.
 *
 * @param {number} lat1 - Latitudine del primo punto.
 * @param {number} lon1 - Longitudine del primo punto.
 * @param {number} lat2 - Latitudine del secondo punto.
 * @param {number} lon2 - Longitudine del secondo punto.
 * @returns {number} Distanza approssimata in metri.
 */

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const toRad = deg => deg * Math.PI / 180

  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Legge e analizza un file GPX.
 * Estrae i punti del tracciato, calcola la lunghezza totale,
 * il numero di punti validi, il primo e l'ultimo punto e il dislivello positivo.
 *
 * @param {string} filePath - Percorso assoluto o relativo del file GPX.
 * @returns {{
 *   lunghezzaKm: number,
 *   punti: number,
 *   firstPoint: {lat: number, lon: number} | null,
 *   lastPoint: {lat: number, lon: number} | null,
 *   validPoints: Array<{lat: number, lon: number}>,
 *   dislivello: number
 * }} Dati calcolati dal file GPX.
 */

function parseGpx(filePath) {
  const xml = fs.readFileSync(filePath, 'utf8')

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: ''
  })

  const gpx = parser.parse(xml)

  let points = gpx?.gpx?.trk?.trkseg?.trkpt || []

  if (!Array.isArray(points)) {
    points = [points]
  }

  const validPoints = points
    .map(p => ({
      lat: Number(p.lat),
      lon: Number(p.lon),
      ele: p.ele !== undefined ? Number(p.ele) : null
    }))
    .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon))

  let lunghezzaMetri = 0
  let dislivelloPos = 0

  for (let i = 1; i < validPoints.length; i++) {
    lunghezzaMetri += haversine(
      validPoints[i - 1].lat,
      validPoints[i - 1].lon,
      validPoints[i].lat,
      validPoints[i].lon
    )

    const prevEle = validPoints[i - 1].ele
    const currEle = validPoints[i].ele

    if (Number.isFinite(prevEle) && Number.isFinite(currEle)) {
      const diff = currEle - prevEle
      if (diff > 0) dislivelloPos += diff
    }
  }

  const firstPoint = validPoints[0] || null
  const lastPoint = validPoints[validPoints.length - 1] || null

  return {
    lunghezzaKm: Math.round((lunghezzaMetri / 1000) * 100) / 100,
    dislivello: Math.round(dislivelloPos),
    punti: validPoints.length,
    firstPoint,
    lastPoint,
    validPoints
  }
}

const bivaccoByFile = {
  'E412.gpx': '6a057945e53a4acc0f4bf812'
}

/**
 * Trova il bivacco più vicino a un singolo punto, entro una distanza massima.
 *
 * @param {{lat: number, lon: number} | null} point - Punto geografico di riferimento.
 * @param {number} [maxDistanceMeters=800] - Distanza massima ammessa in metri.
 * @returns {Promise<{bivacco: import('mongoose').Document, distance: number} | null>}
 */

async function findNearestBivacco(point, maxDistanceMeters = 800) {
  if (!point) return null

  const bivacchi = await Bivacco.find()

  let nearest = null
  let nearestDistance = Infinity

  for (const bivacco of bivacchi) {
    const distance = haversine(
      point.lat,
      point.lon,
      Number(bivacco.latitudine),
      Number(bivacco.longitudine)
    )

    if (distance < nearestDistance) {
      nearestDistance = distance
      nearest = bivacco
    }
  }

  if (nearest && nearestDistance <= maxDistanceMeters) {
    return {
      bivacco: nearest,
      distance: Math.round(nearestDistance)
    }
  }

  return null
}

/**
 * Trova il bivacco più vicino a uno qualsiasi dei punti del tracciato GPX.
 *
 * @param {Array<{lat: number, lon: number}>} points - Punti del tracciato.
 * @param {number} [maxDistanceMeters=1500] - Distanza massima ammessa in metri.
 * @returns {Promise<{bivacco: import('mongoose').Document, distance: number} | null>}
 */

async function findNearestBivaccoOnTrack(points, maxDistanceMeters = 1500) {
  if (!points || points.length === 0) return null

  const bivacchi = await Bivacco.find()

  let nearest = null
  let nearestDistance = Infinity

  for (const bivacco of bivacchi) {
    for (const point of points) {
      const distance = haversine(
        point.lat,
        point.lon,
        Number(bivacco.latitudine),
        Number(bivacco.longitudine)
      )

      if (distance < nearestDistance) {
        nearestDistance = distance
        nearest = bivacco
      }
    }
  }

  if (nearest && nearestDistance <= maxDistanceMeters) {
    return {
      bivacco: nearest,
      distance: Math.round(nearestDistance)
    }
  }

  return null
}

/**
 * Funzione principale dello script.
 * Connette il database, legge tutti i file GPX dalla cartella configurata,
 * calcola i dati del percorso e aggiorna/inserisce i documenti Percorso.
 *
 * @returns {Promise<void>}
 */

async function main() {
  await connectDB()

  /**
 * Recupera ricorsivamente tutti i file con estensione .gpx da una cartella.
 *
 * @param {string} folder - Cartella da esplorare.
 * @returns {string[]} Lista dei path dei file GPX trovati.
 */

  function getAllGpxFiles(folder) {
  const entries = fs.readdirSync(folder, { withFileTypes: true })

  let files = []

  for (const entry of entries) {
    const fullPath = path.join(folder, entry.name)

    if (entry.isDirectory()) {
      files = files.concat(getAllGpxFiles(fullPath))
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith('.gpx')) {
      files.push(fullPath)
    }
  }

  return files
}

const files = getAllGpxFiles(GPX_FOLDER)

  for (const filePath of files) {
  const file = path.basename(filePath)
  const dati = parseGpx(filePath)

  const nearestOnTrack = await findNearestBivaccoOnTrack(dati.validPoints, 3000)
  const nearestByEnd = await findNearestBivacco(dati.lastPoint, 3000)
  const nearestByStart = await findNearestBivacco(dati.firstPoint, 3000)

  const match = nearestOnTrack || nearestByEnd || nearestByStart

  if (file.toLowerCase().includes('412') || file.toLowerCase().includes('vigolana')) {
    console.log('DEBUG MATCH', file, {
      nearestOnTrack: nearestOnTrack
        ? { nome: nearestOnTrack.bivacco.nome, distanza: nearestOnTrack.distance }
        : null,
      nearestByEnd: nearestByEnd
        ? { nome: nearestByEnd.bivacco.nome, distanza: nearestByEnd.distance }
        : null,
      nearestByStart: nearestByStart
        ? { nome: nearestByStart.bivacco.nome, distanza: nearestByStart.distance }
        : null
    })
  }

  console.log(file, {
    lunghezzaKm: dati.lunghezzaKm,
    punti: dati.punti,
    bivaccoAssociato: match ? match.bivacco.nome : 'NESSUNO',
    distanza: match ? `${match.distance} m` : '-'
  })

  await Percorso.updateOne(
    { gpxFile: file },
    {
      $set: {
        bivacco: match ? match.bivacco._id : null,
        gpxFile: file,
        lunghezza: dati.lunghezzaKm,
        durataStimata: Math.round(dati.lunghezzaKm * 25),
        dislivello: dati.dislivello,
        difficolta: 'E',
        tipo: 'ottimale'
      }
    },
    { upsert: true }
  )
}

  console.log('Import completato')
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})