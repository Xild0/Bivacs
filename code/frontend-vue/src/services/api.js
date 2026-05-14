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
    throw new Error(data.errore || 'Errore durante il login')
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

  return {
    coords,
    distance: summary.distance,     // metri
    duration: summary.duration,     // secondi
    ascent:   feature.properties.ascent  || 0,
    descent:  feature.properties.descent || 0,
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

export async function getPercorsiByBivacco(bivaccoId) {
  const response = await fetch(`${API_URL}/bivacchi/${bivaccoId}/percorsi`)

  if (!response.ok) {
    throw new Error('Errore caricamento percorsi del bivacco')
  }

  return await response.json()
}