const API_URL = 'http://localhost:5000/api/v1'
const ORS_API_KEY = import.meta.env.VITE_ORS_API_KEY

function buildQuery(filters = {}) {
  const params = new URLSearchParams()

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, value)
    }
  })

  const query = params.toString()
  return query ? `?${query}` : ''
}

export async function getBivacchi(filters = {}) {
  const response = await fetch(`${API_URL}/bivacchi${buildQuery(filters)}`)

  if (!response.ok) {
    throw new Error('Errore caricamento bivacchi')
  }

  return await response.json()
}

export async function getBivaccoById(id) {
  const response = await fetch(`${API_URL}/bivacchi/${id}`)

  if (!response.ok) {
    throw new Error('Errore caricamento scheda bivacco')
  }

  return await response.json()
}

export async function creaRecensione(data) {
  const response = await fetch(`${API_URL}/recensioni`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error('Errore creazione recensione')
  }

  return await response.json()
}

export async function getRecensioni(bivaccoId) {
  const response = await fetch(`${API_URL}/recensioni/${bivaccoId}`)

  if (!response.ok) {
    throw new Error('Errore caricamento recensioni')
  }

  return await response.json()
}

export async function registerUser(userData) {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(userData)
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.errore || 'Errore durante la registrazione')
  }

  return data
}

export async function loginUser(credentials) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(credentials)
  })

  const data = await response.json()

  if (!response.ok) {
    const error = new Error(data.errore || 'Errore durante il login');
    error.status = response.status;
    error.codiceErrore = data.codiceErrore;
    throw error;
  }

  localStorage.setItem('bivacs_token', data.token)

  return data
}

export function logoutUser() {
  localStorage.removeItem('bivacs_token')
}

export function getToken() {
  return localStorage.getItem('bivacs_token')
}

export function isLoggedIn() {
  return getToken() !== null
}

export async function getProfile() {
  const token = getToken()

  const response = await fetch(`${API_URL}/profilo`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.errore || 'Errore caricamento profilo')
  }

  return data
}

export async function updateProfile(profileData) {
  const token = getToken()

  const response = await fetch(`${API_URL}/profilo`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(profileData)
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.errore || 'Errore aggiornamento profilo')
  }

  return data
}

export async function deleteProfile() {
  const token = getToken()

  const response = await fetch(`${API_URL}/profilo`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.errore || 'Errore eliminazione account')
  }

  logoutUser()

  return data
}

// ============================================================
// Geocoding + routing per il pianificatore tragitto
// ------------------------------------------------------------
// NOTA: per produzione queste chiamate andrebbero proxate dal
// Logic Server (la API key ORS non dovrebbe stare nel frontend).
// Per D3 le tengo qui per velocità di sviluppo.
// ============================================================

/**
 * Geocoding via Nominatim (OpenStreetMap).
 * Cerca un luogo per nome e ritorna max 5 risultati con coordinate.
 *
 * @param {string} query - testo libero (es. "Madonna di Campiglio")
 * @returns {Promise<Array<{nome, lat, lng}>>}
 */
export async function geocode(query) {
  if (!query || query.length < 3) return []

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=it&addressdetails=1`

  const response = await fetch(url, {
    headers: { 'Accept-Language': 'it' }
  })

  if (!response.ok) {
    throw new Error('Errore ricerca geografica')
  }

  const data = await response.json()
  return data.map(r => ({
    nome: r.display_name,
    lat: Number(r.lat),
    lng: Number(r.lon)
  }))
}

/**
 * Calcola un tragitto pedonale da uno start a un end usando
 * OpenRouteService (profilo foot-hiking) e restituisce geometria,
 * distanza, durata, dislivelli e profilo altimetrico.
 *
 * @param {[number, number]} start - [lat, lng]
 * @param {[number, number]} end - [lat, lng]
 * @returns {Promise<{coords, distance, duration, ascent, descent, profile}>}
 */

export async function calcolaTragitto(start, end) {
  if (!ORS_API_KEY) {
    throw new Error('API key OpenRouteService non configurata. Aggiungi VITE_ORS_API_KEY al file .env')
  }

  const response = await fetch(
    'https://api.openrouteservice.org/v2/directions/foot-hiking/geojson',
    {
      method: 'POST',
      headers: {
        'Authorization': ORS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/geo+json'
      },
      body: JSON.stringify({
        // ORS vuole [lon, lat], invertito rispetto a Leaflet
        coordinates: [
          [start[1], start[0]],
          [end[1], end[0]]
        ],
        elevation: true,
        units: 'm'
      })
    }
  )

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error?.message || 'Tragitto non calcolabile per questi punti')
  }

  const data = await response.json()
  const feature = data.features?.[0]
  if (!feature) throw new Error('Nessun tragitto trovato')

  const summary = feature.properties.summary
  const raw3d = feature.geometry.coordinates // [lon, lat, ele]

  // Coordinate in formato [lat, lng] per Leaflet
  const coords = raw3d.map(c => [c[1], c[0]])

  // Profilo altimetrico: distanza cumulativa + quota
  const profile = []
  let cumDist = 0
  for (let i = 0; i < raw3d.length; i++) {
    const [lon, lat, ele] = raw3d[i]
    if (i > 0) {
      const [pLon, pLat] = raw3d[i - 1]
      cumDist += haversine(pLat, pLon, lat, lon)
    }
    profile.push({ distance: cumDist, elevation: ele })
  }

  const distanzaCalcolata = calcolaDistanzaProfilo(raw3d)
  const dislivelli = calcolaDislivelliPuliti(raw3d)
  const durataStimata = stimaDurataEscursionistica(
  distanzaCalcolata,
  dislivelli.ascent,
  dislivelli.descent
)

return {
  coords,
  distance: distanzaCalcolata,
  duration: durataStimata,
  ascent: dislivelli.ascent,
  descent: dislivelli.descent,
  profile
}
}

// Distanza in metri tra due punti lat/lng (formula di Haversine)
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const toRad = (deg) => deg * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function calcolaDistanzaProfilo(raw3d) {
  let totale = 0

  for (let i = 1; i < raw3d.length; i++) {
    const [lon1, lat1] = raw3d[i - 1]
    const [lon2, lat2] = raw3d[i]

    totale += haversine(lat1, lon1, lat2, lon2)
  }

  return totale
}

function calcolaDislivelliPuliti(raw3d) {
  let ascent = 0
  let descent = 0

  const SOGLIA_RUMORE = 3

  for (let i = 1; i < raw3d.length; i++) {
    const elePrev = Number(raw3d[i - 1][2])
    const eleNow = Number(raw3d[i][2])

    if (!Number.isFinite(elePrev) || !Number.isFinite(eleNow)) continue

    const diff = eleNow - elePrev

    if (diff > SOGLIA_RUMORE) ascent += diff
    if (diff < -SOGLIA_RUMORE) descent += Math.abs(diff)
  }

  return {
    ascent: Math.round(ascent),
    descent: Math.round(descent)
  }
}

function stimaDurataEscursionistica(distanzaMetri, dislivelloPositivo, dislivelloNegativo = 0) {
  const km = distanzaMetri / 1000

  // Stima escursionistica prudente:
  // 4 km/h in piano + 1h ogni 600m salita + piccolo peso sulla discesa
  const ore =
    km / 4 +
    dislivelloPositivo / 600 +
    dislivelloNegativo / 1200

  return Math.round(ore * 3600)
}

export async function getPercorsiByBivacco(bivaccoId) {
  const response = await fetch(`${API_URL}/bivacchi/${bivaccoId}/percorsi`)

  if (!response.ok) {
    throw new Error('Errore caricamento percorsi del bivacco')
  }

  return await response.json()
}

/**
 * Inietta in maniera automatica l'header Authorization con il JWT salvato e, 
 * se il backend risponde 401 (token scaduto o non valido),effettua il logout locale 
 * ed emette un evento custom 'bivacs:auth-expired' che i componenti possono ascoltare 
 * per aggiornare lo stato e mostrare un avviso.
 *
 * @param {string} url
 * @param {RequestInit} [options={}] - opzioni standard fetch
 * @returns {Promise<Response>} response originale, da consumare con .json() nel chiamante
 */
async function fetchAuth(url, options = {}) {
  const token = getToken()

  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    }
  })

  if (response.status === 401) {
    logoutUser()
    window.dispatchEvent(new CustomEvent('bivacs:auth-expired'))
  }

  return response
}

/**
 * Avvia la procedura di recupero password: invia l'email al backend, 
 * che genera un token di reset valido un'ora e 
 * invia all'utente un link via posta elettronica.
 *
 * @param {string} email - email dell'account per cui recuperare la password
 * @returns {Promise<{messaggio: string}>} conferma di invio della mail di recupero
 * @throws {Error} se l'email non esiste a sistema o se c'è un errore di rete
 */
export async function richiediRecuperoPassword(email) {
  const response = await fetch(`${API_URL}/auth/recupero_password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.errore || 'Errore durante la richiesta di recupero')
  }

  return data
}

/**
 * Completa la procedura di recupero password settando una nuova password.
 * Il token monouso arriva all'utente via mail e viene passato come parametro di URL così
 * il backend lo valida e aggiorna l'hash.
 *
 * @param {string} token token di reset via email
 * @param {string} nuovaPassword nuova password in chiaro (verrà hashata lato server)
 * @returns {Promise<{messaggio: string}>} conferma di avvenuta modifica
 * @throws {Error}
 */
export async function resetPassword(token, nuovaPassword) {
  const response = await fetch(`${API_URL}/auth/reset-password/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nuovaPassword })
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.errore || 'Errore durante il reset della password')
  }

  return data
}

/**
 * Aggiunge un bivacco alla lista dei preferiti dell'utente loggato.
 *
 * @param {string} bivaccoId id del bivacco da aggiungere
 * @returns {Promise<{messaggio: string, preferiti: string[]}>} lista aggiornata di ObjectId
 * @throws {Error}
 */
export async function aggiungiPreferito(bivaccoId) {
  const response = await fetchAuth(`${API_URL}/profilo/preferiti/${bivaccoId}`, {
    method: 'POST'
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.errore || 'Errore aggiunta ai preferiti')
  }

  return data
}

/**
 * Rimuove un bivacco dalla lista dei preferiti dell'utente loggato.
 *
 * @param {string} bivaccoId 
 * @returns {Promise<{messaggio: string, preferiti: string[]}>} 
 * @throws {Error} 
 */
export async function rimuoviPreferito(bivaccoId) {
  const response = await fetchAuth(`${API_URL}/profilo/preferiti/${bivaccoId}`, {
    method: 'DELETE'
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.errore || 'Errore rimozione dai preferiti')
  }

  return data
}

export async function getPreferiti() {
  const token = getToken()

  const response = await fetch(`${API_URL}/profilo`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.errore || 'Errore caricamento preferiti')
  }

  return data.preferiti || []
}

// ============================================================
// Meteo - US17, US18, US19, US20
// ============================================================

export async function getMeteoBivacco(bivaccoId) {
  const response = await fetch(`${API_URL}/meteo/${bivaccoId}`)

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || 'Errore caricamento meteo')
  }

  return data
}

export async function getPrevisioniBivacco(bivaccoId) {
  const response = await fetch(`${API_URL}/meteo/${bivaccoId}/previsioni`)

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || 'Errore caricamento previsioni')
  }

  return data
}

export async function getMeteoSintetico(bivacchiIds) {
  const response = await fetch(`${API_URL}/meteo/sintetico`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ bivacchiIds })
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || 'Errore caricamento meteo sintetico')
  }

  return data
}

export async function getAllertePreferiti() {
  const response = await fetchAuth(`${API_URL}/meteo/preferiti/allerte`)

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || 'Errore caricamento allerte preferiti')
  }

  return data
}

// ============================================================
// Supporto Tecnico - US38, US39, US40
// ============================================================

export async function getLogApi() {
  const response = await fetchAuth(`${API_URL}/supporto/log-api`)

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.errore || data.message || 'Errore caricamento log API')
  }

  return data
}

export async function getConfigApi() {
  const response = await fetchAuth(`${API_URL}/supporto/config-api`)

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.errore || data.message || 'Errore caricamento configurazioni API')
  }

  return data
}

export async function creaConfigApi(config) {
  const response = await fetchAuth(`${API_URL}/supporto/config-api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(config)
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.errore || data.message || 'Errore creazione configurazione API')
  }

  return data
}

export async function modificaConfigApi(configId, aggiornamenti) {
  const response = await fetchAuth(`${API_URL}/supporto/config-api/${configId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(aggiornamenti)
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.errore || data.message || 'Errore modifica configurazione API')
  }

  return data
}

export async function modificaBivaccoTecnico(bivaccoId, aggiornamenti) {
  const response = await fetchAuth(`${API_URL}/supporto/bivacchi/${bivaccoId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(aggiornamenti)
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.errore || data.message || 'Errore modifica bivacco')
  }

  return data
}

// ============================================================
// Percorsi GPX - US14 (visualizzazione) e US16 (download)
// ============================================================

const API_BASE = API_URL  // alias per chiarezza

/**
 * Restituisce l'URL pubblico per visualizzare il file GPX di un percorso
 * (usato dal componente RouteModal per disegnare la polyline sulla mappa).
 *
 * @param {string} percorsoId
 * @returns {string}
 */
export function getGpxViewUrl(percorsoId) {
  return `${API_URL}/percorsi/${percorsoId}/gpx`
}

/**
 * Recupera il contenuto testuale del file GPX di un percorso (XML).
 * Endpoint pubblico, no autenticazione.
 *
 * @param {string} percorsoId
 * @returns {Promise<string>} contenuto XML del file GPX
 */
export async function getGpxText(percorsoId) {
  const response = await fetch(getGpxViewUrl(percorsoId))

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.message || 'Errore caricamento file GPX')
  }

  return await response.text()
}

/**
 * Scarica il file GPX di un percorso tramite API backend autenticata (US16).
 * Innesca il download del file nel browser.
 *
 * @param {string} percorsoId
 * @param {string} [suggestedName='percorso.gpx'] - nome file da suggerire al browser
 * @returns {Promise<void>}
 */
export async function scaricaGpxAutenticato(percorsoId, suggestedName = 'percorso.gpx') {
  const response = await fetchAuth(`${API_URL}/percorsi/${percorsoId}/download`)

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Devi accedere per scaricare il file GPX')
    }
    const data = await response.json().catch(() => ({}))
    throw new Error(data.message || 'Errore download GPX')
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = suggestedName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)

  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function creaBivaccoTecnico(bivacco) {
  const response = await fetchAuth(`${API_URL}/supporto/bivacchi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bivacco)
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.errore || data.message || 'Errore creazione bivacco')
  }

  return data
}

export async function richiediSupportoTecnico(data) {
  const response = await fetchAuth(`${API_URL}/profilo/richiesta-supporto-tecnico`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })

  const res = await response.json()
  if (!response.ok) throw new Error(res.errore || res.message || 'Errore invio richiesta')
  return res
}

export async function getRichiesteSupporto() {
  const response = await fetchAuth(`${API_URL}/supporto/richieste-supporto`)
  const data = await response.json()

  if (!response.ok) throw new Error(data.errore || data.message || 'Errore caricamento richieste')
  return data
}

export async function approvaRichiestaSupporto(utenteId) {
  const response = await fetchAuth(`${API_URL}/supporto/richieste-supporto/${utenteId}/approva`, {
    method: 'PATCH'
  })

  const data = await response.json()
  if (!response.ok) throw new Error(data.errore || data.message || 'Errore approvazione richiesta')
  return data
}

export async function getAutoGpxText(bivaccoId) {
  const response = await fetch(`${API_URL}/percorsi/bivacco/${bivaccoId}/auto-gpx`)

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.message || 'Nessun GPX SAT automatico trovato')
  }

  return await response.text()
}

export async function scaricaAutoGpxBivacco(bivaccoId, suggestedName = 'percorso_sat.gpx') {
  const response = await fetchAuth(`${API_URL}/percorsi/bivacco/${bivaccoId}/auto-download`)

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Devi accedere per scaricare il file GPX')
    }

    const data = await response.json().catch(() => ({}))
    throw new Error(data.message || 'Errore download GPX SAT')
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = suggestedName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)

  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
