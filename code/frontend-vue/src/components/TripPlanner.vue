/**
 * @file TripPlanner.vue
 * @description Componente per pianificare il tragitto verso un bivacco.
 * Gestisce ricerca luogo di partenza, geolocalizzazione, calcolo percorso e riepilogo altimetrico.
 */

<script setup>
import { ref, watch } from 'vue'
import { geocode, calcolaTragitto } from '../services/api'
import ElevationProfile from './ElevationProfile.vue'

const props = defineProps({
  bivacco: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['route-calculated', 'clear-route'])

const startQuery   = ref('')
const suggestions  = ref([])
const start        = ref(null)         // { nome, lat, lng }
const showSuggest  = ref(false)
const searching    = ref(false)

const loading = ref(false)
const error   = ref('')
const result  = ref(null)

let searchTimeout = null

/**
 * Gestisce la digitazione del punto di partenza e carica suggerimenti geocodificati.
 *
 * @returns {void}
 */

function onInput() {
  start.value = null
  clearTimeout(searchTimeout)

  if (startQuery.value.length < 3) {
    suggestions.value = []
    showSuggest.value = false
    return
  }

  searching.value = true
  searchTimeout = setTimeout(async () => {
    try {
      suggestions.value = await geocode(startQuery.value)
      showSuggest.value = true
    } catch (e) {
      console.error(e)
      suggestions.value = []
    } finally {
      searching.value = false
    }
  }, 400)
}

/**
 * Seleziona un punto di partenza dai suggerimenti.
 *
 * @param {{nome: string, lat: number, lng: number}} s - Suggerimento selezionato.
 * @returns {void}
 */

function pickStart(s) {
  start.value = s
  startQuery.value = s.nome.split(',').slice(0, 2).join(',')
  suggestions.value = []
  showSuggest.value = false
}

/**
 * Usa la geolocalizzazione del browser come punto di partenza.
 *
 * @returns {void}
 */

async function useMyLocation() {
  if (!navigator.geolocation) {
    error.value = 'Geolocalizzazione non supportata dal browser'
    return
  }

  error.value = ''
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      start.value = {
        nome: 'La mia posizione',
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      }
      startQuery.value = 'La mia posizione'
      suggestions.value = []
      showSuggest.value = false
    },
    (err) => {
      if (err.code === 1) {
        error.value = 'Permesso negato. Clicca sul lucchetto nella barra degli indirizzi e abilita la posizione, oppure scrivi il punto di partenza manualmente.'
      } else if (err.code === 2) {
        error.value = 'Posizione non disponibile. Su PC senza GPS può capitare: scrivi il punto di partenza manualmente.'
      } else if (err.code === 3) {
        error.value = 'Timeout: posizione non trovata in tempo. Riprova o scrivi manualmente il punto di partenza.'
      } else {
        error.value = 'Errore di geolocalizzazione. Scrivi il punto di partenza manualmente.'
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    }
  )
}

/**
 * Calcola il tragitto dalla partenza selezionata al bivacco.
 *
 * @returns {Promise<void>}
 */

async function calcola() {
  if (!start.value) {
    error.value = 'Seleziona prima un punto di partenza'
    return
  }

  if (!props.bivacco.latitudine || !props.bivacco.longitudine) {
    error.value = 'Il bivacco non ha coordinate valide'
    return
  }

  error.value = ''
  loading.value = true
  result.value = null
  emit('clear-route')

  try {
    const res = await calcolaTragitto(
      [start.value.lat, start.value.lng],
      [props.bivacco.latitudine, props.bivacco.longitudine]
    )
    result.value = res
    emit('route-calculated', res)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

/**
 * Annulla il tragitto calcolato e ripristina il form.
 *
 * @returns {void}
 */

function reset() {
  result.value = null
  start.value = null
  startQuery.value = ''
  suggestions.value = []
  error.value = ''
  emit('clear-route')
}

/**
 * Formatta una distanza in metri o chilometri.
 *
 * @param {number} metri - Distanza in metri.
 * @returns {string} Distanza formattata.
 */

function formatKm(metri) {
  if (metri < 1000) return `${Math.round(metri)} m`
  return `${(metri / 1000).toFixed(1)} km`
}

/**
 * Formatta una durata in secondi.
 *
 * @param {number} secondi - Durata in secondi.
 * @returns {string} Durata formattata.
 */

function formatDuration(secondi) {
  const h = Math.floor(secondi / 3600)
  const m = Math.round((secondi % 3600) / 60)
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

watch(
  () => props.bivacco._id,
  () => {
    reset()
  }
)

</script>

<template>
  <section class="trip-planner">
    <header class="tp-head">
      <p class="label">Pianifica tragitto</p>
      <h3>Calcola percorso al bivacco</h3>
    </header>

    <!-- Destinazione (fissa sul bivacco) -->
    <div class="endpoint endpoint-end">
      <span class="endpoint-dot end"></span>
      <div class="endpoint-info">
        <span class="endpoint-tag">Arrivo</span>
        <strong>{{ bivacco.nome }}</strong>
        <span class="dim mono">{{ bivacco.altitudine }} m · {{ bivacco.zona }}</span>
      </div>
    </div>

    <!-- Partenza -->
    <div class="endpoint endpoint-start">
      <span class="endpoint-dot start"></span>
      <div class="endpoint-info field-wrapper">
        <span class="endpoint-tag">Partenza</span>

        <div class="search-field">
          <input
            v-model="startQuery"
            class="input"
            placeholder="Es. Madonna di Campiglio, parcheggio…"
            @input="onInput"
            @focus="showSuggest = suggestions.length > 0"
            @blur="setTimeout(() => showSuggest = false, 200)"
          />

          <button
            type="button"
            class="gps-btn"
            title="Usa la mia posizione"
            @click="useMyLocation"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="4" />
              <line x1="12" y1="2" x2="12" y2="4" />
              <line x1="12" y1="20" x2="12" y2="22" />
              <line x1="2" y1="12" x2="4" y2="12" />
              <line x1="20" y1="12" x2="22" y2="12" />
            </svg>
          </button>
        </div>

        <!-- Suggerimenti -->
        <div v-if="showSuggest && suggestions.length > 0" class="suggestions">
          <button
            v-for="(s, i) in suggestions"
            :key="i"
            type="button"
            class="suggestion"
            @click="pickStart(s)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span>{{ s.nome }}</span>
          </button>
        </div>

        <p v-if="searching" class="dim search-hint">Sto cercando…</p>
      </div>
    </div>

    <p v-if="error" class="error-msg">{{ error }}</p>

    <div class="tp-actions">
      <button
        v-if="!result"
        type="button"
        class="btn btn-primary btn-block"
        :disabled="!start || loading"
        @click="calcola"
      >
        <span v-if="loading" class="spinner-mini"></span>
        {{ loading ? 'Calcolo del tragitto…' : 'Calcola tragitto' }}
      </button>

      <button
        v-else
        type="button"
        class="btn btn-ghost btn-block"
        @click="reset"
      >
        Annulla tragitto
      </button>
    </div>

    <!-- Risultato -->
    <div v-if="result" class="result fade-up">
      <div class="stats-grid">
        <div class="stat-box">
          <span class="dim">Distanza</span>
          <strong class="mono">{{ formatKm(result.distance) }}</strong>
        </div>
        <div class="stat-box">
          <span class="dim">Durata</span>
          <strong class="mono">{{ formatDuration(result.duration) }}</strong>
        </div>
        <div class="stat-box">
          <span class="dim">Dislivello +</span>
          <strong class="mono up">+{{ Math.round(result.ascent) }} m</strong>
        </div>
        <div class="stat-box">
          <span class="dim">Dislivello −</span>
          <strong class="mono down">−{{ Math.round(result.descent) }} m</strong>
        </div>
      </div>

      <div class="profile-wrap">
        <p class="dim profile-label">Profilo altimetrico</p>
        <ElevationProfile :profile="result.profile" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.trip-planner {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.tp-head h3 {
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 600;
  margin-top: 4px;
  letter-spacing: -0.01em;
}

/* —— Endpoint rows —— */
.endpoint {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  position: relative;
}

.endpoint-start::before {
  content: '';
  position: absolute;
  left: 7px;
  top: -10px;
  width: 2px;
  height: 12px;
  background: linear-gradient(to bottom, transparent, var(--accent-border));
}

.endpoint-dot {
  flex-shrink: 0;
  margin-top: 6px;
  width: 16px;
  height: 16px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  position: relative;
  z-index: 1;
}

.endpoint-dot.end {
  background: var(--accent-bg-strong);
  border: 2px solid var(--accent);
}

.endpoint-dot.end::after {
  content: '';
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent);
}

.endpoint-dot.start {
  background: var(--bg-surface-3);
  border: 2px solid var(--border-strong);
}

.endpoint-dot.start::after {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-secondary);
}

.endpoint-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.endpoint-tag {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.endpoint-info strong {
  font-size: 15px;
  color: var(--text-primary);
  font-weight: 600;
  word-break: break-word;
}

.endpoint-info .dim {
  font-size: 12px;
}

/* —— Search field —— */
.field-wrapper { gap: 6px; }

.search-field {
  position: relative;
  display: flex;
  gap: 6px;
  margin-top: 4px;
}

.search-field .input {
  padding-right: 12px;
  flex: 1;
}

.gps-btn {
  flex-shrink: 0;
  width: 42px;
  display: grid;
  place-items: center;
  background: var(--bg-surface-2);
  border: 1px solid var(--border);
  border-radius: var(--r);
  color: var(--text-tertiary);
  transition: all 0.18s var(--ease);
}

.gps-btn:hover {
  color: var(--accent);
  border-color: var(--accent-border);
  background: var(--accent-bg);
}

/* —— Suggestions dropdown —— */
.suggestions {
  margin-top: 6px;
  background: var(--bg-surface-2);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 240px;
  overflow-y: auto;
}

.suggestion {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  text-align: left;
  padding: 10px 12px;
  font-size: 13px;
  color: var(--text-secondary);
  background: transparent;
  border-bottom: 1px solid var(--border-subtle);
  transition: background 0.15s var(--ease);
}

.suggestion:last-child { border-bottom: none; }

.suggestion:hover {
  background: var(--bg-surface-3);
  color: var(--text-primary);
}

.suggestion svg {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--text-tertiary);
}

.search-hint {
  font-size: 12px;
  margin-top: 4px;
}

/* —— Error —— */
.error-msg {
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  color: var(--danger);
  padding: 10px 12px;
  border-radius: var(--r);
  font-size: 13px;
}

/* —— Actions —— */
.tp-actions { margin-top: 4px; }

.spinner-mini {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(6, 16, 24, 0.3);
  border-top-color: #061018;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  margin-right: 4px;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* —— Result —— */
.result {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--border-subtle);
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.stat-box {
  background: var(--bg-surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-md);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-box .dim {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.stat-box strong {
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

.up   { color: var(--success); }
.down { color: var(--warning); }

.profile-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.profile-label {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
</style>