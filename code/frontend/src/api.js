const API_BASE_URL = 'http://localhost:5000/api/v1';

export async function getBivacchi(filters = {}) {
  const params = new URLSearchParams();

  if (filters.nome) params.append('nome', filters.nome);
  if (filters.zona) params.append('zona', filters.zona);
  if (filters.altitudineMin) params.append('altitudineMin', filters.altitudineMin);
  if (filters.altitudineMax) params.append('altitudineMax', filters.altitudineMax);
  if (filters.postiLetto) params.append('postiLetto', filters.postiLetto);

  const response = await fetch(`${API_BASE_URL}/bivacchi?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Errore nel caricamento dei bivacchi');
  }

  return response.json();
}

export async function getBivaccoById(id) {
  const response = await fetch(`${API_BASE_URL}/bivacchi/${id}`);

  if (!response.ok) {
    throw new Error('Errore nel caricamento della scheda bivacco');
  }

  return response.json();
}

export async function creaRecensione(data) {
  const response = await fetch(`${API_BASE_URL}/recensioni`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error('Errore nella creazione della recensione');
  }

  return response.json();
}