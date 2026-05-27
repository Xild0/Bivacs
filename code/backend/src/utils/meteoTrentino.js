/**
 * @file meteoTrentino.js
 * @description Integrazione con le API open data di MeteoTrentino.
 * Trova la stazione meteo più vicina a un bivacco e ne legge le ultime osservazioni.
 *
 * I punti marcati [VERIFICA] vanno confrontati con una risposta reale dell'API
 * (vedi i comandi curl nella chat) prima di considerare l'integrazione definitiva.
 */

const { XMLParser } = require('fast-xml-parser')

const BASE = 'http://dati.meteotrentino.it/service.asmx'
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' })

let stazioniCache = null
let stazioniCacheTs = 0
const CACHE_TTL = 1000 * 60 * 60 * 24 // 24h

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const toRad = deg => deg * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Scarica (con cache 24h) l'anagrafica delle stazioni meteo.
 * @returns {Promise<Array<{codice, nome, lat, lon}>>}
 */
async function getStazioni() {
  const now = Date.now()
  if (stazioniCache && (now - stazioniCacheTs) < CACHE_TTL) {
    return stazioniCache
  }

  const res = await fetch(`${BASE}/listaStazioni`)
  if (!res.ok) throw new Error(`listaStazioni HTTP ${res.status}`)

  const xml = await res.text()
  const data = parser.parse(xml)

  // [VERIFICA 1] percorso verso l'array stazioni e nomi dei campi
  // (atteso: anagrafica > statale[] con codice/nome/latitudine/longitudine)
  let stazioni = data?.anagrafica?.statale || []
  if (!Array.isArray(stazioni)) stazioni = [stazioni]

  stazioniCache = stazioni
    .map(s => ({
      codice: s.codice,
      nome: s.nome,
      lat: Number(s.latitudine),
      lon: Number(s.longitudine)
    }))
    .filter(s => s.codice && Number.isFinite(s.lat) && Number.isFinite(s.lon))

  stazioniCacheTs = now
  return stazioniCache
}

function findNearestStazione(stazioni, lat, lon) {
  let nearest = null
  let nearestDist = Infinity
  for (const s of stazioni) {
    const d = haversine(lat, lon, s.lat, s.lon)
    if (d < nearestDist) { nearestDist = d; nearest = s }
  }
  return nearest ? { ...nearest, distanza: Math.round(nearestDist) } : null
}

/**
 * Estrae l'ultimo campione di una serie temporale dalla risposta XML.
 */
function ultimoCampione(serie, campo) {
  if (!serie) return null
  let arr = serie
  if (!Array.isArray(arr)) arr = [arr]
  const last = arr[arr.length - 1]
  if (!last) return null
  const v = Number(last[campo])
  return Number.isFinite(v) ? v : null
}

/**
 * Recupera le ultime osservazioni di una stazione.
 * @returns {Promise<{temperatura: number, vento: number, precipitazioni: number}>}
 */
async function getUltimiDati(codice) {
  const res = await fetch(`${BASE}/ultimiDatiStazione?codice=${encodeURIComponent(codice)}`)
  if (!res.ok) throw new Error(`ultimiDatiStazione HTTP ${res.status}`)

  const xml = await res.text()
  const data = parser.parse(xml)
  const root = data?.ultimiDati || {}

  // [VERIFICA 2] nomi dei blocchi di serie e dei campi numerici
  const temperatura = ultimoCampione(root.temperatura_aria, 'temperatura')

  // [VERIFICA 3] MeteoTrentino dà spesso il vento in m/s: converto in km/h (×3.6).
  // Se la risposta è già in km/h, togli il *3.6.
  const ventoRaw = ultimoCampione(root.vento, 'velocita')
  const vento = ventoRaw != null ? ventoRaw * 3.6 : null

  const precipitazioni = ultimoCampione(root.precipitazione, 'pioggia')

  return {
    temperatura: temperatura ?? 0,
    vento: vento != null ? Math.round(vento * 10) / 10 : 0,
    precipitazioni: precipitazioni ?? 0
  }
}

/**
 * Osservazioni meteo dalla stazione più vicina a una coordinata.
 * @returns {Promise<{temperatura, vento, precipitazioni, stazione}>}
 */
async function getOsservazioniVicine(lat, lon) {
  const stazioni = await getStazioni()
  const stazione = findNearestStazione(stazioni, lat, lon)
  if (!stazione) throw new Error('Nessuna stazione MeteoTrentino disponibile')

  const dati = await getUltimiDati(stazione.codice)

  // Se la stazione non ha restituito nulla di utile, consideriamo fallita la chiamata
  if (dati.temperatura === 0 && dati.vento === 0 && dati.precipitazioni === 0) {
    throw new Error('Stazione senza dati validi')
  }

  return {
    ...dati,
    stazione: {
      codice: stazione.codice,
      nome: stazione.nome,
      distanza: stazione.distanza
    }
  }
}

module.exports = { getStazioni, findNearestStazione, getOsservazioniVicine }