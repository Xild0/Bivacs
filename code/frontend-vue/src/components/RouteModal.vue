<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  getAutoGpxBivacco,
  getAutoDownloadGpxUrl,
  getToken,
  isLoggedIn
} from '../services/api'

import Modal from './Modal.vue'
import RouteMap from './RouteMap.vue'
import ElevationProfile from './ElevationProfile.vue'

const props = defineProps({
  result: { type: Object, required: true },
  bivacco: { type: Object, required: true }
})

const emit = defineEmits(['close'])

const percorsi = ref([])
const gpxCoords = ref([])
const gpxProfile = ref([])
const gpxError = ref('')
const loadingGpx = ref(false)
const downloadError = ref('')
const downloadInCorso = ref(false)
const navigationActive = ref(false)

const logged = ref(isLoggedIn())

/**
 * Restituisce il primo percorso disponibile associato al bivacco.
 *
 * @returns {Object|null} Percorso disponibile oppure null.
 */
const percorso = computed(() => {
  return percorsi.value[0] || props.bivacco.percorsi?.[0] || null
})

/**
 * Indica se è disponibile un percorso calcolato da OpenRouteService.
 *
 * @returns {boolean} True se il risultato contiene coordinate valide.
 */
const orsDisponibile = computed(() => {
  return props.result?.coords?.length > 1
})

/**
 * Restituisce le coordinate da mostrare sulla mappa.
 *
 * @returns {Array<Array<number>>} Coordinate del percorso ORS o GPX.
 */
const routeCoords = computed(() => {
  if (orsDisponibile.value) return props.result.coords
  return gpxCoords.value
})

/**
 * Restituisce la coordinata di partenza del percorso.
 *
 * @returns {Array<number>} Coordinata di partenza.
 */
const startCoord = computed(() => {
  return props.result.startCoord || routeCoords.value?.[0]
})

/**
 * Restituisce la coordinata finale del percorso.
 *
 * @returns {Array<number>} Coordinata finale del bivacco.
 */
const endCoord = computed(() => {
  return props.result.endCoord || [
    Number(props.bivacco.latitudine),
    Number(props.bivacco.longitudine)
  ]
})

/**
 * Restituisce il profilo altimetrico da visualizzare.
 *
 * @returns {Array<Object>} Profilo altimetrico ORS o GPX.
 */
const profile = computed(() => {
  if (orsDisponibile.value && props.result.profile?.length) {
    return props.result.profile
  }

  return gpxProfile.value
})

/**
 * Calcola la distanza totale del percorso in chilometri.
 *
 * @returns {number} Distanza totale in km.
 */
const totalDistanceKm = computed(() => {
  if (orsDisponibile.value) {
    return (props.result.distance || 0) / 1000
  }

  if (gpxProfile.value.length) {
    const last = gpxProfile.value[gpxProfile.value.length - 1]
    return (last.distance || 0) / 1000
  }

  return 0
})

/**
 * Calcola la durata stimata del percorso in minuti.
 *
 * @returns {number} Durata stimata in minuti.
 */
const totalDurationMinutes = computed(() => {
  if (orsDisponibile.value) {
    return Math.round((props.result.duration || 0) / 60)
  }

  return Math.round(totalDistanceKm.value * 25)
})

/**
 * Calcola il dislivello positivo totale del percorso.
 *
 * @returns {number} Dislivello positivo in metri.
 */
const totalAscent = computed(() => {
  if (orsDisponibile.value) {
    return Math.round(props.result.ascent || 0)
  }

  let ascent = 0

  for (let i = 1; i < gpxProfile.value.length; i++) {
    const diff = gpxProfile.value[i].elevation - gpxProfile.value[i - 1].elevation
    if (diff > 0) ascent += diff
  }

  return Math.round(ascent)
})

/**
 * Genera il nome del file GPX da scaricare.
 *
 * @returns {string} Nome del file GPX.
 */
const downloadFileName = computed(() => {
  const nome = props.bivacco.nome
    ? props.bivacco.nome.replace(/[^a-zA-Z0-9_-]/g, '_')
    : 'percorso'

  return `${nome}.gpx`
})

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
 * Converte un file GPX in coordinate e profilo altimetrico.
 *
 * @param {string} xmlText - Contenuto XML del file GPX.
 * @returns {{ coords: Array<Array<number>>, profile: Array<{ distance: number, elevation: number }> }} Dati estratti dal GPX.
 */
function parseGpx(xmlText) {
  const parser = new DOMParser()
  const xml = parser.parseFromString(xmlText, 'application/xml')

  const nodes = Array.from(xml.getElementsByTagName('*')).filter(node =>
    ['trkpt', 'rtept', 'wpt'].includes(node.localName)
  )

  const points = nodes
    .map(node => {
      const lat = Number(node.getAttribute('lat'))
      const lng = Number(node.getAttribute('lon'))
      const eleNode = Array.from(node.children).find(c => c.localName === 'ele')
      const ele = eleNode ? Number(eleNode.textContent) : null

      return {
        lat,
        lng,
        ele: Number.isFinite(ele) ? ele : null
      }
    })
    .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng))

  const coords = []
  const profileArr = []

  let distance = 0
  let prev = null

  for (const p of points) {
    if (prev) {
      distance += haversine(prev.lat, prev.lng, p.lat, p.lng)
    }

    coords.push([p.lat, p.lng])

    if (Number.isFinite(p.ele)) {
      profileArr.push({
        distance,
        elevation: p.ele
      })
    }

    prev = p
  }

  return {
    coords,
    profile: profileArr
  }
}

/**
 * Carica e interpreta il tracciato GPX SAT associato al bivacco.
 *
 * @returns {Promise<void>}
 */
async function loadGpxOverlay() {
  loadingGpx.value = true
  gpxError.value = ''

  try {
    const xmlText = await getAutoGpxBivacco(props.bivacco._id)
    const parsed = parseGpx(xmlText)

    if (parsed.coords.length < 2) {
      gpxError.value = 'Il GPX SAT automatico non contiene abbastanza punti validi.'
      return
    }

    gpxCoords.value = parsed.coords
    gpxProfile.value = parsed.profile
  } catch (error) {
    gpxError.value = error.message
  } finally {
    loadingGpx.value = false
  }
}

/**
 * Formatta una durata espressa in minuti.
 *
 * @param {number} minutes - Durata in minuti.
 * @returns {string} Durata formattata.
 */
function formatDuration(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60

  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

/**
 * Scarica il file GPX SAT del bivacco corrente.
 *
 * @returns {Promise<void>}
 */
async function avviaDownload() {
  downloadError.value = ''

  const token = getToken()

  if (!token) {
    downloadError.value = 'Accedi per scaricare il GPX.'
    return
  }

  downloadInCorso.value = true

  try {
    const response = await fetch(getAutoDownloadGpxUrl(props.bivacco._id), {
      headers: { Authorization: `Bearer ${token}` }
    })

    if (!response.ok) {
      throw new Error('Download del GPX non disponibile per questo bivacco')
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')

    a.href = url
    a.download = downloadFileName.value
    a.click()

    URL.revokeObjectURL(url)
  } catch (e) {
    downloadError.value = e.message
  } finally {
    downloadInCorso.value = false
  }
}

/**
 * Carica il tracciato GPX SAT al montaggio della modale.
 */
onMounted(() => {
  loadGpxOverlay()
})
</script>

<template>
  <Modal
    label="Navigazione"
    :title="`Tragitto per ${bivacco.nome}`"
    max-width="1200px"
    @close="emit('close')"
  >
    <p v-if="orsDisponibile" class="info-box">
      Percorso principale calcolato dinamicamente con OpenRouteService. Il tracciato SAT, se disponibile, è mostrato come riferimento tratteggiato.
    </p>

    <p v-else class="warning-box">
      OpenRouteService non ha fornito un percorso dinamico valido. Uso il tracciato GPX SAT come fallback.
    </p>

    <p v-if="loadingGpx" class="info-box">
      Caricamento tracciato SAT di riferimento…
    </p>

    <p v-if="gpxError && orsDisponibile" class="soft-box">
      {{ gpxError }}
    </p>

    <p v-else-if="gpxError" class="error-box">
      {{ gpxError }}
    </p>

    <p v-if="navigationActive" class="navigation-banner">
      Navigazione attiva verso {{ bivacco.nome }}
    </p>

    <div class="route-layout">
      <div class="map-wrap">
        <RouteMap
          :route-coords="routeCoords"
          :official-trail-coords="gpxCoords"
          :start-coord="startCoord"
          :end-coord="endCoord"
          start-name="Partenza"
          :end-name="bivacco.nome"
        />
      </div>

      <aside class="sidebar">
        <div class="summary-box">
          <p class="summary-label">
            {{ orsDisponibile ? 'Percorso dinamico consigliato' : 'Fallback GPX SAT' }}
          </p>

          <div class="stats-grid">
            <div class="stat-box">
              <span class="label-small">Distanza</span>
              <strong>{{ totalDistanceKm.toFixed(2) }} km</strong>
            </div>

            <div class="stat-box">
              <span class="label-small">Durata</span>
              <strong>{{ formatDuration(totalDurationMinutes) }}</strong>
            </div>

            <div class="stat-box">
              <span class="label-small">Dislivello +</span>
              <strong>+{{ totalAscent }} m</strong>
            </div>
          </div>
        </div>

        <div v-if="gpxCoords.length" class="segment-box">
          <div class="segment-head">
            <span class="segment-dot sat"></span>
            <div>
              <p class="segment-title">Tracciato SAT ufficiale</p>
              <p class="segment-sub">
                GPX SAT automatico più vicino
              </p>
            </div>
          </div>

          <p class="segment-note">
            Disponibile per il download. Il percorso consigliato resta quello blu calcolato dall'app.
          </p>
        </div>

        <div class="profile-section">
          <p class="profile-title">Profilo altimetrico</p>

          <ElevationProfile
            v-if="profile?.length"
            :profile="profile"
          />

          <p v-else class="dim-text">
            Profilo altimetrico non disponibile.
          </p>
        </div>

        <p v-if="downloadError" class="error-box">
          {{ downloadError }}
        </p>

        <div class="actions">
          <button
            v-if="logged && gpxCoords.length"
            class="btn btn-ghost btn-block"
            :disabled="downloadInCorso"
            @click="avviaDownload"
          >
            {{ downloadInCorso ? 'Download in corso…' : 'Scarica GPX SAT' }}
          </button>

          <p v-else-if="!logged && gpxCoords.length" class="login-hint">
            Accedi per scaricare il file GPX SAT.
          </p>

          <button
            v-if="!navigationActive"
            class="btn btn-primary btn-block"
            @click="navigationActive = true"
          >
            Naviga
          </button>

          <button
            v-else
            class="btn btn-danger btn-block"
            @click="navigationActive = false"
          >
            Termina navigazione
          </button>
        </div>
      </aside>
    </div>
  </Modal>
</template>

<style scoped>
.route-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 20px;
}

.map-wrap {
  min-width: 0;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.summary-box,
.segment-box {
  background: var(--bg-surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-md);
  padding: 14px;
}

.summary-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
  margin-bottom: 10px;
  font-weight: 600;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.stat-box {
  background: var(--bg-surface-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-md);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.label-small {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-tertiary);
}

.stat-box strong {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text-primary);
}

.profile-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.profile-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-tertiary);
}

.dim-text,
.login-hint {
  font-size: 13px;
  color: var(--text-tertiary);
  background: var(--bg-surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r);
  padding: 12px;
  text-align: center;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.info-box,
.soft-box,
.warning-box,
.error-box,
.navigation-banner {
  padding: 12px 14px;
  border-radius: var(--r);
  margin-bottom: 16px;
  font-size: 13px;
}

.info-box {
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  color: var(--accent-hi);
}

.soft-box {
  background: var(--bg-surface-2);
  border: 1px solid var(--border-subtle);
  color: var(--text-tertiary);
}

.warning-box {
  background: var(--warning-bg);
  border: 1px solid rgba(251, 191, 36, 0.28);
  color: var(--warning);
}

.error-box {
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  color: var(--danger);
}

.navigation-banner {
  background: var(--success-bg);
  border: 1px solid rgba(52, 211, 153, 0.28);
  color: var(--success);
  font-weight: 600;
}

.segment-head {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin-bottom: 10px;
}

.segment-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-top: 5px;
  flex-shrink: 0;
}

.segment-dot.sat {
  background: #94A3B8;
}

.segment-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.segment-sub,
.segment-note {
  font-size: 12px;
  color: var(--text-tertiary);
}

@media (max-width: 980px) {
  .route-layout {
    grid-template-columns: 1fr;
  }
}
</style>