/**
 * @file meteoTrentino.js
 * @description Utility per l'integrazione con le API open data di MeteoTrentino.
 *
 * Include:
 * - lettura della configurazione del provider;
 * - recupero delle stazioni meteo disponibili;
 * - ricerca della stazione più vicina;
 * - recupero degli ultimi dati osservati;
 * - cache temporanea delle stazioni.
 */

const { XMLParser } = require('fast-xml-parser')
const ConfigAPI = require('../models/configAPI')

const DEFAULT_BASE = 'http://dati.meteotrentino.it/service.asmx'
const PROVIDER_NAME = 'MeteoTrentino'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: ''
})

let stazioniCache = null
let stazioniCacheTs = 0
let stazioniCacheBaseUrl = null

const CACHE_TTL = 1000 * 60 * 60 * 24 // 24h

/**
 * Recupera l'URL base configurato per MeteoTrentino.
 *
 * Se non esiste una configurazione salvata, restituisce
 * l'URL predefinito. Se il provider è disabilitato,
 * genera un errore.
 *
 * @returns {Promise<string>} URL base del provider MeteoTrentino.
 */

async function getBaseUrl() {
  const config = await ConfigAPI.findOne({
    provider: PROVIDER_NAME
  })

  if (!config) {
    return DEFAULT_BASE
  }

  if (!config.enabled) {
    throw new Error('Provider MeteoTrentino disabilitato da configurazione')
  }

  return config.baseUrl || DEFAULT_BASE
}

/**
 * Normalizza l'URL base rimuovendo eventuali slash finali.
 *
 * @param {string} baseUrl - URL da normalizzare.
 * @returns {string} URL normalizzato.
 */

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || DEFAULT_BASE).replace(/\/+$/, '')
}

/**
 * Calcola la distanza in metri tra due coordinate geografiche.
 *
 * @param {number} lat1 - Latitudine del primo punto.
 * @param {number} lon1 - Longitudine del primo punto.
 * @param {number} lat2 - Latitudine del secondo punto.
 * @param {number} lon2 - Longitudine del secondo punto.
 * @returns {number} Distanza in metri.
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
 * Recupera la lista delle stazioni MeteoTrentino.
 *
 * Usa una cache temporanea per evitare chiamate ripetute
 * allo stesso provider.
 *
 * @returns {Promise<Array>} Lista delle stazioni disponibili.
 */

async function getStazioni() {
  const baseUrl = normalizeBaseUrl(await getBaseUrl())
  const now = Date.now()

  if (
    stazioniCache &&
    stazioniCacheBaseUrl === baseUrl &&
    now - stazioniCacheTs < CACHE_TTL
  ) {
    return stazioniCache
  }

  const res = await fetch(`${baseUrl}/listaStazioni`)

  if (!res.ok) {
    throw new Error(`listaStazioni HTTP ${res.status}`)
  }

  const xml = await res.text()
  const data = parser.parse(xml)

  let stazioni = data?.anagrafica?.statale || []

  if (!Array.isArray(stazioni)) {
    stazioni = [stazioni]
  }

  stazioniCache = stazioni
    .map(s => ({
      codice: s.codice,
      nome: s.nome,
      lat: Number(s.latitudine),
      lon: Number(s.longitudine)
    }))
    .filter(s => s.codice && Number.isFinite(s.lat) && Number.isFinite(s.lon))

  stazioniCacheTs = now
  stazioniCacheBaseUrl = baseUrl

  return stazioniCache
}

/**
 * Individua la stazione meteo più vicina alle coordinate indicate.
 *
 * @param {Array} stazioni - Lista delle stazioni disponibili.
 * @param {number} lat - Latitudine di riferimento.
 * @param {number} lon - Longitudine di riferimento.
 * @returns {Object|null} Stazione più vicina oppure null.
 */

function findNearestStazione(stazioni, lat, lon) {
  let nearest = null
  let nearestDist = Infinity

  for (const s of stazioni) {
    const d = haversine(lat, lon, s.lat, s.lon)

    if (d < nearestDist) {
      nearestDist = d
      nearest = s
    }
  }

  return nearest
    ? {
        ...nearest,
        distanza: Math.round(nearestDist)
      }
    : null
}

/**
 * Estrae l'ultimo valore numerico valido da una serie MeteoTrentino.
 *
 * @param {Object|Array} serie - Serie di dati restituita dal provider.
 * @param {string} campo - Nome del campo da leggere.
 * @returns {number|null} Ultimo valore numerico valido oppure null.
 */

function ultimoCampione(serie, campo) {
  if (!serie) return null

  let arr = serie

  if (!Array.isArray(arr)) {
    arr = [arr]
  }

  const last = arr[arr.length - 1]

  if (!last) return null

  const v = Number(last[campo])

  return Number.isFinite(v) ? v : null
}

/**
 * Recupera gli ultimi dati osservati per una stazione MeteoTrentino.
 *
 * L'operazione:
 * - interroga il provider usando il codice stazione;
 * - estrae temperatura, vento e precipitazioni;
 * - converte la velocità del vento in km/h.
 *
 * @param {string} codice - Codice della stazione MeteoTrentino.
 * @returns {Promise<{temperatura: number, vento: number, precipitazioni: number}>}
 * Dati meteorologici osservati.
 */

async function getUltimiDati(codice) {
  const baseUrl = normalizeBaseUrl(await getBaseUrl())

  const res = await fetch(
    `${baseUrl}/ultimiDatiStazione?codice=${encodeURIComponent(codice)}`
  )

  if (!res.ok) {
    throw new Error(`ultimiDatiStazione HTTP ${res.status}`)
  }

  const xml = await res.text()
  const data = parser.parse(xml)
  const root = data?.ultimiDati || {}

  const temperatura = ultimoCampione(root.temperatura_aria, 'temperatura')
  const ventoRaw = ultimoCampione(root.venti?.vento, 'velocita')
  const vento = ventoRaw != null ? ventoRaw * 3.6 : null

  const precipitazioni = ultimoCampione(root.precipitazioni?.precipitazione, 'pioggia')

  return {
    temperatura: temperatura ?? 0,
    vento: vento != null ? Math.round(vento * 10) / 10 : 0,
    precipitazioni: precipitazioni ?? 0
  }
}

/**
 * Recupera le osservazioni meteo dalla stazione più vicina.
 *
 * L'operazione:
 * - recupera le stazioni disponibili;
 * - individua quella più vicina alle coordinate del bivacco;
 * - legge gli ultimi dati osservati;
 * - restituisce temperatura, vento, precipitazioni e stazione.
 *
 * @param {number} lat - Latitudine del bivacco.
 * @param {number} lon - Longitudine del bivacco.
 * @returns {Promise<Object>} Dati meteo osservati e stazione associata.
 */

async function getOsservazioniVicine(lat, lon) {
  const stazioni = await getStazioni()
  const stazione = findNearestStazione(stazioni, lat, lon)

  if (!stazione) {
    throw new Error('Nessuna stazione MeteoTrentino disponibile')
  }

  const dati = await getUltimiDati(stazione.codice)

  if (
    dati.temperatura === 0 &&
    dati.vento === 0 &&
    dati.precipitazioni === 0
  ) {
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

module.exports = {
  getStazioni,
  findNearestStazione,
  getOsservazioniVicine
}