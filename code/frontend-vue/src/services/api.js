const API_URL = 'http://localhost:5000/api/v1'

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