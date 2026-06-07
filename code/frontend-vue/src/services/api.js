/**
 * @file api.js
 * @description Servizi frontend per comunicare con le API backend di Bivacs.
 * Gestisce autenticazione, profilo, bivacchi, preferiti, recensioni,
 * segnalazioni, meteo, percorsi e funzioni del Supporto Tecnico.
 */

const API_URL = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api/v1'
const ORS_API_KEY = import.meta.env.VITE_ORS_API_KEY || ''

/**
 * Restituisce il token JWT salvato nel browser.
 *
 * @returns {string|null}
 */
export function getToken() {
  return localStorage.getItem('token')
}

/**
 * Verifica se l'utente risulta autenticato lato frontend.
 *
 * @returns {boolean}
 */
export function isLoggedIn() {
  return Boolean(getToken())
}

/**
 * Rimuove il token salvato localmente.
 *
 * @returns {void}
 */
export function logoutUser() {
  localStorage.removeItem('token')
}

/**
 * Esegue una fetch autenticata aggiungendo il token JWT.
 * In caso di sessione scaduta rimuove il token e notifica l'app.
 *
 * @param {string} url - URL della risorsa.
 * @param {Object} [options={}] - Opzioni fetch.
 * @returns {Promise<Response>}
 */
async function fetchAuth(url, options = {}) {
  const token = getToken()

  const headers = {
    ...(options.headers || {})
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(url, {
    ...options,
    headers
  })

  if (response.status === 401) {
    logoutUser()
    window.dispatchEvent(new Event('bivacs:auth-expired'))
  }

  return response
}

/**
 * Converte una risposta HTTP in JSON e gestisce gli errori backend.
 *
 * @param {Response} response - Risposta fetch.
 * @returns {Promise<any>}
 */
async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')

  const data = isJson ? await response.json() : await response.text()

  if (!response.ok) {
    const message =
      data?.errore ||
      data?.message ||
      data?.error ||
      data ||
      'Errore durante la richiesta'

    const error = new Error(message)
    error.status = response.status
    error.codiceErrore = data?.codiceErrore
    throw error
  }

  return data
}

/**
 * Registra un nuovo utente.
 *
 * @param {Object} payload - Dati registrazione.
 * @returns {Promise<Object>}
 */
export async function registerUser(payload) {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  return parseResponse(response)
}

/**
 * Effettua il login e salva il token JWT.
 *
 * @param {Object} payload - Credenziali utente.
 * @returns {Promise<Object>}
 */
export async function loginUser(payload) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  const data = await parseResponse(response)

  if (data.token) {
    localStorage.setItem('token', data.token)
  }

  return data
}

/**
 * Richiede una mail di recupero password.
 *
 * @param {string} email - Email dell'utente.
 * @returns {Promise<Object>}
 */
export async function richiediRecuperoPassword(email) {
  const response = await fetch(`${API_URL}/auth/recupero_password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email })
  })

  return parseResponse(response)
}

/**
 * Imposta una nuova password usando il token ricevuto via email.
 *
 * @param {string} token - Token di reset password.
 * @param {string} nuovaPassword - Nuova password.
 * @returns {Promise<Object>}
 */
export async function resetPassword(token, nuovaPassword) {
  const response = await fetch(`${API_URL}/auth/reset-password/${token}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ nuovaPassword })
  })

  return parseResponse(response)
}

/**
 * Richiede un nuovo invio della mail di verifica account.
 *
 * @param {string} email - Email dell'utente.
 * @returns {Promise<Object>}
 */
export async function resendVerificationEmail(email) {
  const response = await fetch(`${API_URL}/auth/resend-verification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email })
  })

  return parseResponse(response)
}

/**
 * Recupera tutti i bivacchi applicando eventuali filtri.
 *
 * @param {Object} [filters={}] - Filtri di ricerca.
 * @returns {Promise<Array>}
 */
export async function getBivacchi(filters = {}) {
  const params = new URLSearchParams()

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, value)
    }
  })

  const query = params.toString()
  const response = await fetch(`${API_URL}/bivacchi${query ? `?${query}` : ''}`)

  return parseResponse(response)
}

/**
 * Recupera la scheda dettagliata di un bivacco.
 *
 * @param {string} id - ObjectId del bivacco.
 * @returns {Promise<Object>}
 */
export async function getBivaccoById(id) {
  const response = await fetch(`${API_URL}/bivacchi/${id}`)
  const data = await parseResponse(response)

  if (data.bivacco) {
    return {
      ...data.bivacco,
      ticketManutenzione: data.ticketManutenzione || [],
      risorse: data.risorse || null
    }
  }

  return data
}

/**
 * Recupera il profilo dell'utente autenticato.
 *
 * @returns {Promise<Object>}
 */
export async function getProfile() {
  const response = await fetchAuth(`${API_URL}/profilo`)
  return parseResponse(response)
}

/**
 * Aggiorna il profilo dell'utente autenticato.
 *
 * @param {Object} payload - Campi da aggiornare.
 * @returns {Promise<Object>}
 */
export async function updateProfile(payload) {
  const response = await fetchAuth(`${API_URL}/profilo`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  return parseResponse(response)
}

/**
 * Elimina definitivamente l'account autenticato.
 *
 * @returns {Promise<Object>}
 */
export async function deleteProfile() {
  const response = await fetchAuth(`${API_URL}/profilo`, {
    method: 'DELETE'
  })

  return parseResponse(response)
}

/**
 * Aggiunge un bivacco ai preferiti.
 *
 * @param {string} bivaccoId - ObjectId del bivacco.
 * @returns {Promise<Object>}
 */
export async function addPreferito(bivaccoId) {
  const response = await fetchAuth(`${API_URL}/profilo/preferiti/${bivaccoId}`, {
    method: 'POST'
  })

  return parseResponse(response)
}

/**
 * Rimuove un bivacco dai preferiti.
 *
 * @param {string} bivaccoId - ObjectId del bivacco.
 * @returns {Promise<Object>}
 */
export async function removePreferito(bivaccoId) {
  const response = await fetchAuth(`${API_URL}/profilo/preferiti/${bivaccoId}`, {
    method: 'DELETE'
  })

  return parseResponse(response)
}

/**
 * Invia una richiesta per diventare Supporto Tecnico.
 *
 * @param {Object} payload - Motivo e matricola richiesta.
 * @returns {Promise<Object>}
 */
export async function richiediSupportoTecnico(payload) {
  const response = await fetchAuth(`${API_URL}/profilo/richiesta-supporto-tecnico`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  return parseResponse(response)
}

/**
 * Recupera le recensioni di un bivacco.
 *
 * @param {string} bivaccoId - ObjectId del bivacco.
 * @returns {Promise<Array>}
 */
export async function getRecensioni(bivaccoId) {
  const response = await fetch(`${API_URL}/recensioni/${bivaccoId}`)
  return parseResponse(response)
}

/**
 * Crea una nuova recensione.
 *
 * @param {Object} payload - Dati recensione.
 * @returns {Promise<Object>}
 */
export async function createRecensione(payload) {
  const response = await fetch(`${API_URL}/recensioni`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  return parseResponse(response)
}

/**
 * Crea una nuova segnalazione con foto.
 *
 * @param {FormData} formData - FormData con bivaccoId, descrizione e foto.
 * @returns {Promise<Object>}
 */
export async function creaSegnalazione(formData) {
  const response = await fetchAuth(`${API_URL}/segnalazioni`, {
    method: 'POST',
    body: formData
  })

  return parseResponse(response)
}

/**
 * Recupera le segnalazioni associate a un bivacco.
 *
 * @param {string} bivaccoId - ObjectId del bivacco.
 * @returns {Promise<Array>}
 */
export async function getSegnalazioniBivacco(bivaccoId) {
  const response = await fetchAuth(`${API_URL}/segnalazioni/bivacco/${bivaccoId}`)
  return parseResponse(response)
}

/**
 * Recupera le segnalazioni inviate dall'utente autenticato.
 *
 * @returns {Promise<Array>}
 */
export async function getMieSegnalazioni() {
  const response = await fetchAuth(`${API_URL}/segnalazioni/mie`)
  return parseResponse(response)
}

/**
 * Recupera lo storico completo delle segnalazioni.
 *
 * @returns {Promise<Array>}
 */
export async function getStoricoSegnalazioni() {
  const response = await fetchAuth(`${API_URL}/segnalazioni/storico`)
  return parseResponse(response)
}

/**
 * Aggiorna lo stato di una segnalazione.
 *
 * @param {string} segnalazioneId - ObjectId della segnalazione.
 * @param {string} nuovoStato - Nuovo stato.
 * @returns {Promise<Object>}
 */
export async function aggiornaStatoSegnalazione(segnalazioneId, nuovoStato) {
  const response = await fetchAuth(`${API_URL}/segnalazioni/${segnalazioneId}/stato`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ nuovoStato })
  })

  return parseResponse(response)
}

/**
 * Recupera il meteo realtime di un bivacco.
 *
 * @param {string} bivaccoId - ObjectId del bivacco.
 * @returns {Promise<Object>}
 */
export async function getMeteoBivacco(bivaccoId) {
  const response = await fetch(`${API_URL}/meteo/${bivaccoId}`)
  return parseResponse(response)
}

/**
 * Recupera le previsioni a tre giorni di un bivacco.
 *
 * @param {string} bivaccoId - ObjectId del bivacco.
 * @returns {Promise<Object>}
 */
export async function getPrevisioniBivacco(bivaccoId) {
  const response = await fetch(`${API_URL}/meteo/${bivaccoId}/previsioni`)
  return parseResponse(response)
}

/**
 * Recupera meteo sintetico per una lista di bivacchi.
 *
 * @param {Array<string>} bivacchiIds - Lista ObjectId bivacchi.
 * @returns {Promise<Object>}
 */
export async function getMeteoSintetico(bivacchiIds) {
  const response = await fetch(`${API_URL}/meteo/sintetico`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ bivacchiIds })
  })

  return parseResponse(response)
}

/**
 * Recupera allerte meteo sui bivacchi preferiti.
 *
 * @returns {Promise<Object>}
 */
export async function getAllertePreferiti() {
  const response = await fetchAuth(`${API_URL}/meteo/preferiti/allerte`)
  return parseResponse(response)
}

/**
 * Aggiorna lo stato di acqua e legna di un bivacco.
 *
 * @param {string} bivaccoId - ObjectId del bivacco.
 * @param {Object} payload - Stato acqua e legna.
 * @returns {Promise<Object>}
 */
export async function aggiornaRisorseBivacco(bivaccoId, payload) {
  const response = await fetchAuth(`${API_URL}/bivacchi/${bivaccoId}/risorse`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  return parseResponse(response)
}

/**
 * Recupera tutti i percorsi.
 *
 * @returns {Promise<Array>}
 */
export async function getPercorsi() {
  const response = await fetch(`${API_URL}/percorsi`)
  return parseResponse(response)
}

/**
 * Recupera i percorsi associati a un bivacco.
 *
 * @param {string} bivaccoId - ObjectId del bivacco.
 * @returns {Promise<Array>}
 */
export async function getPercorsiBivacco(bivaccoId) {
  const response = await fetch(`${API_URL}/bivacchi/${bivaccoId}/percorsi`)
  return parseResponse(response)
}

/**
 * Recupera automaticamente il GPX SAT più vicino al bivacco.
 *
 * @param {string} bivaccoId - ObjectId del bivacco.
 * @returns {Promise<string>} Contenuto GPX in formato testo.
 */
export async function getAutoGpxBivacco(bivaccoId) {
  const response = await fetch(`${API_URL}/percorsi/bivacco/${bivaccoId}/auto-gpx`)

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.message || 'GPX non disponibile')
  }

  return response.text()
}

/**
 * Restituisce l'URL per scaricare automaticamente il GPX SAT più vicino.
 *
 * @param {string} bivaccoId - ObjectId del bivacco.
 * @returns {string}
 */
export function getAutoDownloadGpxUrl(bivaccoId) {
  return `${API_URL}/percorsi/bivacco/${bivaccoId}/auto-download`
}

/**
 * Restituisce l'URL per scaricare il GPX di un percorso specifico.
 *
 * @param {string} percorsoId - ObjectId del percorso.
 * @returns {string}
 */
export function getDownloadGpxUrl(percorsoId) {
  return `${API_URL}/percorsi/${percorsoId}/download`
}

/**
 * Recupera i log delle API esterne per il Supporto Tecnico.
 *
 * @returns {Promise<Array>}
 */
export async function getLogApi() {
  const response = await fetchAuth(`${API_URL}/supporto/log-api`)
  return parseResponse(response)
}

/**
 * Recupera le configurazioni dei provider API.
 *
 * @returns {Promise<Array>}
 */
export async function getConfigApi() {
  const response = await fetchAuth(`${API_URL}/supporto/config-api`)
  return parseResponse(response)
}

/**
 * Crea una nuova configurazione API.
 *
 * @param {Object} payload - Dati configurazione.
 * @returns {Promise<Object>}
 */
export async function creaConfigApi(payload) {
  const response = await fetchAuth(`${API_URL}/supporto/config-api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  return parseResponse(response)
}

/**
 * Aggiorna una configurazione API.
 *
 * @param {string} configId - ObjectId configurazione.
 * @param {Object} payload - Campi aggiornati.
 * @returns {Promise<Object>}
 */
export async function aggiornaConfigApi(configId, payload) {
  const response = await fetchAuth(`${API_URL}/supporto/config-api/${configId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  return parseResponse(response)
}

/**
 * Aggiorna dati tecnici di un bivacco dal pannello Supporto Tecnico.
 *
 * @param {string} bivaccoId - ObjectId bivacco.
 * @param {Object} payload - Campi tecnici aggiornati.
 * @returns {Promise<Object>}
 */
export async function aggiornaBivaccoTecnico(bivaccoId, payload) {
  const response = await fetchAuth(`${API_URL}/supporto/bivacchi/${bivaccoId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  return parseResponse(response)
}

/**
 * Crea un bivacco dal pannello Supporto Tecnico.
 *
 * @param {Object} payload - Dati nuovo bivacco.
 * @returns {Promise<Object>}
 */
export async function creaBivaccoTecnico(payload) {
  const response = await fetchAuth(`${API_URL}/supporto/bivacchi`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  return parseResponse(response)
}

/**
 * Recupera richieste pendenti di promozione a Supporto Tecnico.
 *
 * @returns {Promise<Array>}
 */
export async function getRichiesteSupportoTecnico() {
  const response = await fetchAuth(`${API_URL}/supporto/richieste-supporto`)
  return parseResponse(response)
}

/**
 * Approva una richiesta di promozione a Supporto Tecnico.
 *
 * @param {string} utenteId - ObjectId utente.
 * @returns {Promise<Object>}
 */
export async function approvaRichiestaSupportoTecnico(utenteId) {
  const response = await fetchAuth(`${API_URL}/supporto/richieste-supporto/${utenteId}/approva`, {
    method: 'PATCH'
  })

  return parseResponse(response)
}

/**
 * Rifiuta una richiesta di promozione a Supporto Tecnico.
 *
 * @param {string} utenteId - ObjectId utente.
 * @param {string} motivoRifiuto - Motivo opzionale.
 * @returns {Promise<Object>}
 */
export async function rifiutaRichiestaSupportoTecnico(utenteId, motivoRifiuto = '') {
  const response = await fetchAuth(`${API_URL}/supporto/richieste-supporto/${utenteId}/rifiuta`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ motivoRifiuto })
  })

  return parseResponse(response)
}

/**
 * Geocodifica un indirizzo tramite OpenRouteService.
 * Per il prototipo universitario la chiamata resta nel frontend;
 * in produzione andrebbe spostata sul backend per non esporre la API key.
 *
 * @param {string} text - Indirizzo o luogo cercato.
 * @returns {Promise<Array>}
 */
export async function geocode(text) {
  if (!ORS_API_KEY) {
    throw new Error('Chiave OpenRouteService non configurata')
  }

  const params = new URLSearchParams({
    api_key: ORS_API_KEY,
    text,
    size: '5',
    'boundary.country': 'IT'
  })

  const response = await fetch(`https://api.openrouteservice.org/geocode/search?${params}`)
  const data = await parseResponse(response)

  return data.features || []
}

/**
 * Calcola la distanza in metri tra due coordinate.
 *
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number}
 */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const toRad = deg => (deg * Math.PI) / 180

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
 * Calcola il profilo distanze/elevazioni partendo dalle coordinate ORS.
 *
 * @param {Array<Array<number>>} coordsLonLatEle - Coordinate [lon, lat, ele].
 * @returns {Array<{distance:number, elevation:number}>}
 */
function calcolaDistanzaProfilo(coordsLonLatEle) {
  let totale = 0

  return coordsLonLatEle.map((coord, index) => {
    const [lon, lat, ele = 0] = coord

    if (index > 0) {
      const [prevLon, prevLat] = coordsLonLatEle[index - 1]
      totale += haversine(prevLat, prevLon, lat, lon)
    }

    return {
      distance: totale,
      elevation: Number(ele) || 0
    }
  })
}

/**
 * Calcola dislivello positivo e negativo filtrando piccoli rumori altimetrici.
 *
 * @param {Array<{distance:number, elevation:number}>} profile - Profilo altimetrico.
 * @returns {{ascent:number, descent:number}}
 */
function calcolaDislivelliPuliti(profile) {
  let ascent = 0
  let descent = 0

  for (let i = 1; i < profile.length; i++) {
    const diff = profile[i].elevation - profile[i - 1].elevation

    if (Math.abs(diff) < 2) continue

    if (diff > 0) {
      ascent += diff
    } else {
      descent += Math.abs(diff)
    }
  }

  return {
    ascent,
    descent
  }
}

/**
 * Stima la durata escursionistica usando distanza e dislivello positivo.
 *
 * @param {number} distanceMeters - Distanza in metri.
 * @param {number} ascentMeters - Dislivello positivo in metri.
 * @returns {number} Durata stimata in secondi.
 */
function stimaDurataEscursionistica(distanceMeters, ascentMeters) {
  const oreDistanza = distanceMeters / 4000
  const oreSalita = ascentMeters / 400
  return Math.round((oreDistanza + oreSalita) * 3600)
}

/**
 * Calcola un tragitto escursionistico con OpenRouteService.
 *
 * @param {Array<number>} startCoord - Coordinate partenza [lat, lng].
 * @param {Array<number>} endCoord - Coordinate arrivo [lat, lng].
 * @returns {Promise<Object>}
 */
export async function calcolaTragitto(startCoord, endCoord) {
  if (!ORS_API_KEY) {
    throw new Error('Chiave OpenRouteService non configurata')
  }

  const body = {
    coordinates: [
      [startCoord[1], startCoord[0]],
      [endCoord[1], endCoord[0]]
    ],
    elevation: true,
    instructions: true,
    preference: 'recommended'
  }

  const response = await fetch('https://api.openrouteservice.org/v2/directions/foot-hiking/geojson', {
    method: 'POST',
    headers: {
      Authorization: ORS_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  const data = await parseResponse(response)
  const feature = data.features?.[0]

  if (!feature) {
    throw new Error('Percorso non trovato')
  }

  const rawCoords = feature.geometry.coordinates || []
  const coords = rawCoords.map(([lon, lat]) => [lat, lon])
  const profile = calcolaDistanzaProfilo(rawCoords)
  const dislivelli = calcolaDislivelliPuliti(profile)

  const distance = feature.properties?.summary?.distance || profile.at(-1)?.distance || 0
  const duration =
    feature.properties?.summary?.duration ||
    stimaDurataEscursionistica(distance, dislivelli.ascent)

  return {
    coords,
    profile,
    distance,
    duration,
    ascent: dislivelli.ascent,
    descent: dislivelli.descent,
    instructions: feature.properties?.segments?.[0]?.steps || []
  }
}

export async function getTicket() {
  const resp = await fetchAuth('${API_URL}/ticket')
  return parseResponse(resp)
}

export async function apriTicket(segnalazioneId) {
  const resp = await fetchAuth(`${API_URL}/ticket`,{
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({segnalazioneId})
  })
  return parseResponse(resp)
}

export async function aggiornaStatoTicket(ticketId, nuovoStato) {
  const resp = await fetchAuth(`${API_URL}/ticket/${ticketId}/stato`,{
    method: 'PATCH',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({nuovoStato})
  })
  return parseResponse(resp)
}

export async function chiudiTicket(ticketId, note) {
  const resp = await fetchAuth(`${API_URL}/ticket/${ticketId}/chiudi`,{
    method: 'PATCH',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({note})
  })
  return parseResponse(resp)
}

export async function archiviaTicket(ticketId) {
  const resp = await fetchAuth(`${API_URL}/ticket/${ticketId}/archivia`,{
    method: 'PATCH'
  })
  return parseResponse(resp)
}

