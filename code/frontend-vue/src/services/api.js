/**
 * @file api.js
 * @description Servizi frontend per comunicare con il backend Bivacs e con API esterne.
 * Include autenticazione, profilo, bivacchi, recensioni, preferiti, meteo,
 * supporto tecnico, segnalazioni, GPX e calcolo tragitti outdoor.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'
const ORS_API_KEY = import.meta.env.VITE_ORS_API_KEY

/**
 * Costruisce una query string a partire da un oggetto di filtri.
 *
 * @param {Object} [filters={}] - Filtri da trasformare in parametri URL.
 * @returns {string} Query string comprensiva di `?`, oppure stringa vuota.
 */
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

/**
 * Recupera il token JWT salvato nel browser.
 *
 * @returns {string|null} Token JWT oppure null.
 */
export function getToken() {
  return localStorage.getItem('bivacs_token')
}

/**
 * Verifica se esiste un token JWT salvato localmente.
 *
 * @returns {boolean} True se l'utente risulta loggato.
 */
export function isLoggedIn() {
  return getToken() !== null
}

/**
 * Rimuove il token JWT dal browser.
 *
 * @returns {void}
 */
export function logoutUser() {
  localStorage.removeItem('bivacs_token')
}

/**
 * Esegue una fetch autenticata aggiungendo automaticamente l'header Authorization.
 * Se il backend risponde 401, rimuove il token locale ed emette un evento globale
 * per notificare la scadenza della sessione ai componenti Vue.
 *
 * @param {string} url - URL della richiesta.
 * @param {RequestInit} [options={}] - Opzioni standard della fetch.
 * @returns {Promise<Response>} Risposta originale della fetch.
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
 * Calcola la distanza in metri tra due coordinate geografiche.
 *
 * @param {number} lat1 - Latitudine primo punto.
 * @param {number} lon1 - Longitudine primo punto.
 * @param {number} lat2 - Latitudine secondo punto.
 * @param {number} lon2 - Longitudine secondo punto.
 * @returns {number} Distanza in metri.
 */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const toRad = (deg) => deg * Math.PI / 180

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
 * Recupera l'elenco dei bivacchi dal backend con filtri opzionali.
 *
 * @param {Object} [filters={}] - Filtri di ricerca.
 * @returns {Promise<Array>} Lista dei bivacchi.
 */
export async function getBivacchi(filters = {}) {
  const response = await fetch(`${API_URL}/bivacchi${buildQuery(filters)}`)

  if (!response.ok) {
    throw new Error('Errore caricamento bivacchi')
  }

  return await response.json()
}

/**
 * Recupera la scheda dettagliata di un bivacco.
 *
 * @param {string} id - ObjectId MongoDB del bivacco.
 * @returns {Promise<Object>} Dati completi del bivacco.
 */
export async function getBivaccoById(id) {
  const response = await fetch(`${API_URL}/bivacchi/${id}`)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || 'Errore caricamento scheda bivacco')
  }

  if (data.bivacco) {
    return {
      ...data.bivacco,
      ticketManutenzione: data.ticketManutenzione || [],
      risorseDettaglio: data.risorse || null
    }
  }

  return data
}

/**
 * Crea una recensione per un bivacco.
 *
 * @param {Object} data - Dati della recensione.
 * @returns {Promise<Object>} Recensione creata.
 */
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

/**
 * Recupera le recensioni associate a un bivacco.
 *
 * @param {string} bivaccoId - ObjectId MongoDB del bivacco.
 * @returns {Promise<Array>} Lista recensioni.
 */
export async function getRecensioni(bivaccoId) {
  const response = await fetch(`${API_URL}/recensioni/${bivaccoId}`)

  if (!response.ok) {
    throw new Error('Errore caricamento recensioni')
  }

  return await response.json()
}

/**
 * Registra un nuovo utente.
 *
 * @param {Object} userData - Dati di registrazione.
 * @returns {Promise<Object>} Risposta del backend.
 */
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

/**
 * Effettua il login e salva il token JWT in localStorage.
 *
 * @param {{email: string, password: string}} credentials - Credenziali utente.
 * @returns {Promise<Object>} Risposta del backend.
 */
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
    const error = new Error(data.errore || 'Errore durante il login')
    error.status = response.status
    error.codiceErrore = data.codiceErrore
    throw error
  }

  localStorage.setItem('bivacs_token', data.token)

  return data
}

/**
 * Recupera il profilo dell'utente autenticato.
 *
 * @returns {Promise<Object>} Profilo utente.
 */
export async function getProfile() {
  const response = await fetchAuth(`${API_URL}/profilo`)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.errore || 'Errore caricamento profilo')
  }

  return data
}

/**
 * Aggiorna i dati del profilo utente.
 *
 * @param {Object} profileData - Campi profilo da aggiornare.
 * @returns {Promise<Object>} Profilo aggiornato.
 */
export async function updateProfile(profileData) {
  const response = await fetchAuth(`${API_URL}/profilo`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(profileData)
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.errore || 'Errore aggiornamento profilo')
  }

  return data
}

/**
 * Elimina l'account dell'utente autenticato.
 *
 * @returns {Promise<Object>} Conferma eliminazione.
 */
export async function deleteProfile() {
  const response = await fetchAuth(`${API_URL}/profilo`, {
    method: 'DELETE'
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.errore || 'Errore eliminazione account')
  }

  logoutUser()

  return data
}

/**
 * Avvia la procedura di recupero password.
 *
 * @param {string} email - Email dell'account.
 * @returns {Promise<Object>} Conferma invio email.
 */
export async function richiediRecuperoPassword(email) {
  const response = await fetch(`${API_URL}/auth/recupero_password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email })
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.errore || 'Errore durante la richiesta di recupero')
  }

  return data
}

/**
 * Completa la procedura di reset password.
 *
 * @param {string} token - Token ricevuto via email.
 * @param {string} nuovaPassword - Nuova password scelta dall'utente.
 * @returns {Promise<Object>} Conferma aggiornamento password.
 */
export async function resetPassword(token, nuovaPassword) {
  const response = await fetch(`${API_URL}/auth/reset-password/${token}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ nuovaPassword })
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.errore || 'Errore durante il reset della password')
  }

  return data
}

/**
 * Reinvia la mail di verifica a un account non ancora confermato.
 *
 * @param {string} email - Email dell'utente.
 * @returns {Promise<Object>} Conferma invio.
 */
export async function resendVerificationEmail(email) {
  const response = await fetch(`${API_URL}/auth/resend-verification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email })
  })

  const text = await response.text()
  const data = text ? JSON.parse(text) : {}

  if (!response.ok) {
    throw new Error(data.errore || 'Errore invio email di verifica')
  }

  return data
}

/**
 * Aggiunge un bivacco ai preferiti dell'utente autenticato.
 *
 * @param {string} bivaccoId - ObjectId MongoDB del bivacco.
 * @returns {Promise<Object>} Lista preferiti aggiornata.
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
 * Rimuove un bivacco dai preferiti dell'utente autenticato.
 *
 * @param {string} bivaccoId - ObjectId MongoDB del bivacco.
 * @returns {Promise<Object>} Lista preferiti aggiornata.
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

/**
 * Recupera i bivacchi preferiti dell'utente autenticato.
 *
 * @returns {Promise<Array>} Lista preferiti.
 */
export async function getPreferiti() {
  const response = await fetchAuth(`${API_URL}/profilo`)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.errore || 'Errore caricamento preferiti')
  }

  return data.preferiti || []
}

/**
 * Recupera il meteo realtime associato a un bivacco.
 *
 * @param {string} bivaccoId - ObjectId MongoDB del bivacco.
 * @returns {Promise<Object>} Dati meteo.
 */
export async function getMeteoBivacco(bivaccoId) {
  const response = await fetch(`${API_URL}/meteo/${bivaccoId}`)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || 'Errore caricamento meteo')
  }

  return data
}

/**
 * Recupera le previsioni meteo a 3 giorni per un bivacco.
 *
 * @param {string} bivaccoId - ObjectId MongoDB del bivacco.
 * @returns {Promise<Object>} Previsioni meteo.
 */
export async function getPrevisioniBivacco(bivaccoId) {
  const response = await fetch(`${API_URL}/meteo/${bivaccoId}/previsioni`)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || 'Errore caricamento previsioni')
  }

  return data
}

/**
 * Recupera meteo sintetico per più bivacchi.
 *
 * @param {Array<string>} bivacchiIds - Lista ObjectId dei bivacchi.
 * @returns {Promise<Object>} Mappa/lista di meteo sintetico.
 */
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

/**
 * Recupera le allerte meteo sui bivacchi preferiti.
 *
 * @returns {Promise<Object>} Lista allerte preferiti.
 */
export async function getAllertePreferiti() {
  const response = await fetchAuth(`${API_URL}/meteo/preferiti/allerte`)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || 'Errore caricamento allerte preferiti')
  }

  return data
}

/**
 * Esegue geocoding testuale tramite Nominatim.
 *
 * @param {string} query - Luogo cercato.
 * @returns {Promise<Array<{nome: string, lat: number, lng: number}>>} Suggerimenti geografici.
 */
export async function geocode(query) {
  if (!query || query.length < 3) {
    return []
  }

  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(query)}` +
    `&format=json&limit=5&countrycodes=it&addressdetails=1`

  const response = await fetch(url, {
    headers: {
      'Accept-Language': 'it'
    }
  })

  if (!response.ok) {
    throw new Error('Errore ricerca geografica')
  }

  const data = await response.json()

  return data.map((result) => ({
    nome: result.display_name,
    lat: Number(result.lat),
    lng: Number(result.lon)
  }))
}

/**
 * Calcola distanza totale da una geometria ORS 3D.
 *
 * @param {Array<[number, number, number]>} raw3d - Coordinate [lon, lat, quota].
 * @returns {number} Distanza totale in metri.
 */
function calcolaDistanzaProfilo(raw3d) {
  let totale = 0

  for (let i = 1; i < raw3d.length; i++) {
    const [lon1, lat1] = raw3d[i - 1]
    const [lon2, lat2] = raw3d[i]

    totale += haversine(lat1, lon1, lat2, lon2)
  }

  return totale
}

/**
 * Calcola dislivello positivo e negativo ignorando piccoli salti altimetrici.
 *
 * @param {Array<[number, number, number]>} raw3d - Coordinate [lon, lat, quota].
 * @returns {{ascent: number, descent: number}} Dislivelli arrotondati.
 */
function calcolaDislivelliPuliti(raw3d) {
  let ascent = 0
  let descent = 0

  const SOGLIA_RUMORE = 3

  for (let i = 1; i < raw3d.length; i++) {
    const elePrev = Number(raw3d[i - 1][2])
    const eleNow = Number(raw3d[i][2])

    if (!Number.isFinite(elePrev) || !Number.isFinite(eleNow)) {
      continue
    }

    const diff = eleNow - elePrev

    if (diff > SOGLIA_RUMORE) {
      ascent += diff
    }

    if (diff < -SOGLIA_RUMORE) {
      descent += Math.abs(diff)
    }
  }

  return {
    ascent: Math.round(ascent),
    descent: Math.round(descent)
  }
}

/**
 * Stima la durata escursionistica in secondi.
 *
 * @param {number} distanzaMetri - Distanza del percorso.
 * @param {number} dislivelloPositivo - Dislivello positivo.
 * @param {number} [dislivelloNegativo=0] - Dislivello negativo.
 * @returns {number} Durata stimata in secondi.
 */
function stimaDurataEscursionistica(distanzaMetri, dislivelloPositivo, dislivelloNegativo = 0) {
  const km = distanzaMetri / 1000

  const ore =
    km / 4 +
    dislivelloPositivo / 600 +
    dislivelloNegativo / 1200

  return Math.round(ore * 3600)
}

/**
 * Calcola un tragitto escursionistico usando OpenRouteService.
 *
 * @param {[number, number]} start - Coordinate partenza [lat, lng].
 * @param {[number, number]} end - Coordinate arrivo [lat, lng].
 * @returns {Promise<{coords: Array, distance: number, duration: number, ascent: number, descent: number, profile: Array}>}
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
        Authorization: ORS_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/geo+json'
      },
      body: JSON.stringify({
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

  if (!feature) {
    throw new Error('Nessun tragitto trovato')
  }

  const raw3d = feature.geometry.coordinates
  const coords = raw3d.map((coord) => [coord[1], coord[0]])

  const profile = []
  let cumDist = 0

  for (let i = 0; i < raw3d.length; i++) {
    const [lon, lat, ele] = raw3d[i]

    if (i > 0) {
      const [pLon, pLat] = raw3d[i - 1]
      cumDist += haversine(pLat, pLon, lat, lon)
    }

    profile.push({
      distance: cumDist,
      elevation: ele
    })
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

/**
 * Recupera i percorsi associati a un bivacco.
 *
 * @param {string} bivaccoId - ObjectId MongoDB del bivacco.
 * @returns {Promise<Array>} Percorsi associati.
 */
export async function getPercorsiByBivacco(bivaccoId) {
  const response = await fetch(`${API_URL}/bivacchi/${bivaccoId}/percorsi`)

  if (!response.ok) {
    throw new Error('Errore caricamento percorsi del bivacco')
  }

  return await response.json()
}

/**
 * Costruisce l'URL pubblico per visualizzare un GPX associato a un percorso.
 *
 * @param {string} percorsoId - ObjectId MongoDB del percorso.
 * @returns {string} URL del GPX.
 */
export function getGpxViewUrl(percorsoId) {
  return `${API_URL}/percorsi/${percorsoId}/gpx`
}

/**
 * Recupera il contenuto XML di un file GPX associato a un percorso.
 *
 * @param {string} percorsoId - ObjectId MongoDB del percorso.
 * @returns {Promise<string>} Contenuto XML GPX.
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
 * Scarica un GPX autenticato associato a un percorso.
 *
 * @param {string} percorsoId - ObjectId MongoDB del percorso.
 * @param {string} [suggestedName='percorso.gpx'] - Nome suggerito del file.
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

  await scaricaBlobDaResponse(response, suggestedName)
}

/**
 * Recupera il contenuto XML del GPX SAT automatico più vicino al bivacco.
 *
 * @param {string} bivaccoId - ObjectId MongoDB del bivacco.
 * @returns {Promise<string>} Contenuto XML GPX.
 */
export async function getAutoGpxText(bivaccoId) {
  const response = await fetch(`${API_URL}/percorsi/bivacco/${bivaccoId}/auto-gpx`)

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.message || 'Nessun GPX SAT automatico trovato')
  }

  return await response.text()
}

/**
 * Scarica il GPX SAT automatico più vicino al bivacco.
 *
 * @param {string} bivaccoId - ObjectId MongoDB del bivacco.
 * @param {string} [suggestedName='percorso_sat.gpx'] - Nome suggerito del file.
 * @returns {Promise<void>}
 */
export async function scaricaAutoGpxBivacco(bivaccoId, suggestedName = 'percorso_sat.gpx') {
  const response = await fetchAuth(`${API_URL}/percorsi/bivacco/${bivaccoId}/auto-download`)

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Devi accedere per scaricare il file GPX')
    }

    const data = await response.json().catch(() => ({}))
    throw new Error(data.message || 'Errore download GPX SAT')
  }

  await scaricaBlobDaResponse(response, suggestedName)
}

/**
 * Scarica nel browser il contenuto binario ricevuto da una response.
 *
 * @param {Response} response - Response contenente un blob.
 * @param {string} suggestedName - Nome suggerito per il download.
 * @returns {Promise<void>}
 */
async function scaricaBlobDaResponse(response, suggestedName) {
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = suggestedName

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Recupera i log delle chiamate verso API esterne.
 *
 * @returns {Promise<Array>} Lista log API.
 */
export async function getLogApi() {
  const response = await fetchAuth(`${API_URL}/supporto/log-api`)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.errore || data.message || 'Errore caricamento log API')
  }

  return data
}

/**
 * Recupera le configurazioni dei provider API esterni.
 *
 * @returns {Promise<Array>} Lista configurazioni.
 */
export async function getConfigApi() {
  const response = await fetchAuth(`${API_URL}/supporto/config-api`)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.errore || data.message || 'Errore caricamento configurazioni API')
  }

  return data
}

/**
 * Crea una nuova configurazione API.
 *
 * @param {Object} config - Configurazione provider.
 * @returns {Promise<Object>} Configurazione creata.
 */
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

/**
 * Modifica una configurazione API esistente.
 *
 * @param {string} configId - ObjectId MongoDB della configurazione.
 * @param {Object} aggiornamenti - Campi da aggiornare.
 * @returns {Promise<Object>} Configurazione aggiornata.
 */
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

/**
 * Modifica i dati tecnici di un bivacco.
 *
 * @param {string} bivaccoId - ObjectId MongoDB del bivacco.
 * @param {Object} aggiornamenti - Campi tecnici da aggiornare.
 * @returns {Promise<Object>} Bivacco aggiornato.
 */
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

/**
 * Crea un nuovo bivacco dal pannello tecnico.
 *
 * @param {Object} bivacco - Dati del nuovo bivacco.
 * @returns {Promise<Object>} Bivacco creato.
 */
export async function creaBivaccoTecnico(bivacco) {
  const response = await fetchAuth(`${API_URL}/supporto/bivacchi`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(bivacco)
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.errore || data.message || 'Errore creazione bivacco')
  }

  return data
}

/**
 * Invia la richiesta di promozione a Supporto Tecnico.
 *
 * @param {{motivo: string, matricola: string}} data - Dati richiesta.
 * @returns {Promise<Object>} Conferma invio richiesta.
 */
export async function richiediSupportoTecnico(data) {
  const response = await fetchAuth(`${API_URL}/profilo/richiesta-supporto-tecnico`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.errore || result.message || 'Errore invio richiesta')
  }

  return result
}

/**
 * Recupera le richieste di promozione a Supporto Tecnico in attesa.
 *
 * @returns {Promise<Array>} Lista richieste.
 */
export async function getRichiesteSupporto() {
  const response = await fetchAuth(`${API_URL}/supporto/richieste-supporto`)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.errore || data.message || 'Errore caricamento richieste')
  }

  return data
}

/**
 * Approva una richiesta di promozione a Supporto Tecnico.
 *
 * @param {string} utenteId - ObjectId MongoDB dell'utente richiedente.
 * @returns {Promise<Object>} Conferma approvazione.
 */
export async function approvaRichiestaSupporto(utenteId) {
  const response = await fetchAuth(`${API_URL}/supporto/richieste-supporto/${utenteId}/approva`, {
    method: 'PATCH'
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.errore || data.message || 'Errore approvazione richiesta')
  }

  return data
}

/**
 * Recupera le segnalazioni inviate dall'utente autenticato.
 *
 * @returns {Promise<Array>} Lista segnalazioni personali.
 */
export async function getMieSegnalazioni() {
  const response = await fetchAuth(`${API_URL}/segnalazioni/mie`)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.errore || data.message || 'Errore caricamento segnalazioni')
  }

  return data
}

/**
 * Recupera lo storico segnalazioni visibile allo staff.
 *
 * @returns {Promise<Array>} Lista completa segnalazioni.
 */
export async function getStoricoSegnalazioniStaff() {
  const response = await fetchAuth(`${API_URL}/segnalazioni/storico`)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.errore || data.message || 'Errore caricamento storico segnalazioni')
  }

  return data
}