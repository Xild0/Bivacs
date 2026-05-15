<script setup>
import { computed, onMounted, ref } from 'vue'
import { getPercorsiByBivacco, calcolaTragitto } from '../services/api'
import Modal from './Modal.vue'
import RouteMap from './RouteMap.vue'
import ElevationProfile from './ElevationProfile.vue'

const props = defineProps({
  result: {
    type: Object,
    required: true
  },
  bivacco: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close'])

const gpxCoords = ref([])
const gpxProfile = ref([])
const loadingGpx = ref(false)
const gpxError = ref('')

const navigationActive = ref(false)
const approachResult = ref(null)
const percorsi = ref([])

const percorso = computed(() => {
  return percorsi.value[0] || props.bivacco.percorsi?.[0] || null
})

const routeCoords = computed(() => {
  if (approachResult.value?.coords?.length && gpxCoords.value.length) {
    return [
      ...approachResult.value.coords,
      ...gpxCoords.value
    ]
  }

  if (gpxCoords.value.length > 0) {
    return gpxCoords.value
  }

  return props.result.coords
})

const profile = computed(() => {
  return gpxProfile.value.length > 0 ? gpxProfile.value : props.result.profile
})

const startCoord = computed(() => {
  return routeCoords.value?.[0] || props.result.coords?.[0]
})

const endCoord = computed(() => {
  const coords = routeCoords.value
  if (coords?.length > 0) return coords[coords.length - 1]

  return [
    Number(props.bivacco.latitudine),
    Number(props.bivacco.longitudine)
  ]
})

const gpxUrl = computed(() => {
  if (!percorso.value?.gpxFile) return ''
  return `/gpx/${percorso.value.gpxFile}`
})

function formatKmFromDb(value) {
  if (!value) return '—'
  return `${Number(value).toFixed(2)} km`
}

function formatKmFromMeters(metri) {
  if (!metri && metri !== 0) return '—'
  return `${(Number(metri) / 1000).toFixed(2)} km`
}

function formatDurationFromSeconds(secondi) {
  if (!secondi && secondi !== 0) return '—'

  const totalMinutes = Math.round(Number(secondi) / 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60

  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

const totalDistanceKm = computed(() => {
  const approachKm = approachResult.value?.distance
    ? approachResult.value.distance / 1000
    : 0

  const satKm = percorso.value?.lunghezza
    ? Number(percorso.value.lunghezza)
    : 0

  return approachKm + satKm
})

function formatDurationFromMinutes(minutes) {
  if (!minutes && minutes !== 0) return '—'

  const h = Math.floor(Number(minutes) / 60)
  const m = Number(minutes) % 60

  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

const totalDurationMinutes = computed(() => {
  const approachMinutes = approachResult.value?.duration
    ? Math.round(approachResult.value.duration / 60)
    : 0

  const satMinutes = percorso.value?.durataStimata
    ? Number(percorso.value.durataStimata)
    : 0

  return approachMinutes + satMinutes
})

function formatDurationFromDb(value) {
  if (!value) return '—'

  const minutes = Number(value)

  if (minutes < 60) return `${minutes} min`

  const h = Math.floor(minutes / 60)
  const m = minutes % 60

  return m === 0 ? `${h} h` : `${h} h ${m} min`
}
function parseGpx(xmlText) {
  const parser = new DOMParser()
  const xml = parser.parseFromString(xmlText, 'application/xml')

  const allNodes = Array.from(xml.getElementsByTagName('*'))

  let points = allNodes.filter(node =>
    node.localName === 'trkpt' ||
    node.localName === 'rtept' ||
    node.localName === 'wpt'
  )

  let cumulativeDistance = 0
  let previous = null

  const coords = []
  const profile = []

  points.forEach((point) => {
    const lat = Number(point.getAttribute('lat'))
    const lng = Number(point.getAttribute('lon'))

    const eleNode = Array.from(point.children).find(child => child.localName === 'ele')
    const ele = eleNode ? Number(eleNode.textContent) : null

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

    coords.push([lat, lng])

    if (previous) {
      cumulativeDistance += haversine(
        previous.lat,
        previous.lng,
        lat,
        lng
      )
    }

    if (Number.isFinite(ele)) {
      profile.push({
        distance: cumulativeDistance,
        elevation: ele
      })
    }

    previous = { lat, lng }
  })

  return { coords, profile }
}

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

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

async function loadApproachToGpxStart() {
  if (!gpxCoords.value.length) return
  if (!props.result.coords?.length) return

  const userStart = props.result.coords[0]
  const gpxStart = gpxCoords.value[0]

  try {
    approachResult.value = await calcolaTragitto(userStart, gpxStart)
  } catch (error) {
    console.warn('Avvicinamento al sentiero non calcolabile:', error.message)
    approachResult.value = null
  }
}

async function loadGpx() {
    if (percorsi.value.length === 0) {
        percorsi.value = await getPercorsiByBivacco(props.bivacco._id)
    }
  if (!gpxUrl.value) {
    gpxError.value = 'Nessun file GPX associato a questo bivacco.'
    return
  }

  loadingGpx.value = true
  gpxError.value = ''

  try {
    const response = await fetch(gpxUrl.value)

    if (!response.ok) {
      throw new Error('File GPX non trovato nella cartella public/gpx.')
    }

    const xmlText = await response.text()
    const parsed = parseGpx(xmlText)

    if (parsed.coords.length === 0) {
      throw new Error('Il file GPX non contiene punti validi.')
    }

    gpxCoords.value = parsed.coords
    gpxProfile.value = parsed.profile
    
    await loadApproachToGpxStart()
  } catch (error) {
    gpxError.value = error.message
  } finally {
    loadingGpx.value = false
  }
}

onMounted(() => {
  loadGpx()
})
</script>

<template>
  <Modal
    label="Navigazione"
    :title="`Tracciato per ${bivacco.nome}`"
    max-width="1200px"
    @close="emit('close')"
  >
    <p v-if="loadingGpx" class="info-box">
      Caricamento tracciato GPX ufficiale…
    </p>

    <p v-if="gpxError" class="error-box">
      {{ gpxError }} Verrà mostrato il percorso calcolato.
    </p>

    <p v-if="navigationActive" class="navigation-banner">
      Navigazione attiva verso {{ bivacco.nome }}
    </p>

    <div class="route-layout">
      <div class="map-wrap">
        <RouteMap
          :route-coords="routeCoords"
          :start-coord="startCoord"
          :end-coord="endCoord"
          start-name="Partenza tracciato"
          :end-name="bivacco.nome"
        />
      </div>

      <aside class="sidebar">
        <div class="summary-box">
  <p class="summary-label">Totale stimato</p>

        <div class="stats-grid">
          <div class="stat-box">
            <span class="label-small">Distanza</span>
            <strong>{{ totalDistanceKm.toFixed(2) }} km</strong>
          </div>

          <div class="stat-box">
            <span class="label-small">Durata</span>
            <strong>{{ formatDurationFromMinutes(totalDurationMinutes) }}</strong>
          </div>
        </div>
      </div>

      <div v-if="approachResult" class="segment-box">
        <div class="segment-head">
          <span class="segment-dot approach"></span>
          <div>
            <p class="segment-title">Avvicinamento</p>
            <p class="segment-sub">Dalla partenza scelta all'inizio del sentiero SAT</p>
          </div>
        </div>

        <div class="segment-stats">
          <span>{{ formatKmFromMeters(approachResult.distance) }}</span>
          <span>{{ formatDurationFromSeconds(approachResult.duration) }}</span>
          <span>+{{ Math.round(approachResult.ascent || 0) }} m</span>
        </div>
      </div>

      <div class="segment-box">
        <div class="segment-head">
          <span class="segment-dot sat"></span>
          <div>
            <p class="segment-title">Sentiero SAT ufficiale</p>
            <p class="segment-sub">
              {{ percorso?.gpxFile || 'Tracciato GPX' }}
            </p>
          </div>
        </div>

        <div class="segment-stats">
          <span>{{ formatKmFromDb(percorso?.lunghezza) }}</span>
          <span>{{ formatDurationFromDb(percorso?.durataStimata) }}</span>
          <span>+{{ percorso?.dislivello || '—' }} m</span>
          <span>{{ percorso?.difficolta || '—' }}</span>
        </div>
      </div>

        <div class="profile-section">
          <p class="profile-title">Profilo altimetrico</p>
          <ElevationProfile
            v-if="profile?.length"
            :profile="profile"
          />
          <p v-else class="dim-text">
            Profilo altimetrico non disponibile per questo tracciato.
          </p>
        </div>

        <div class="actions">
          <a
            v-if="gpxUrl"
            class="btn btn-ghost btn-block"
            :href="gpxUrl"
            download
          >
            Scarica GPX
          </a>

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

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.stat-box {
  background: var(--bg-surface-2);
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
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--text-primary);
}

.up {
  color: var(--success);
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

.dim-text {
  font-size: 13px;
  color: var(--text-tertiary);
  background: var(--bg-surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r);
  padding: 12px;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.info-box {
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  color: var(--accent-hi);
  padding: 12px 14px;
  border-radius: var(--r);
  margin-bottom: 16px;
  font-size: 13px;
}

.error-box {
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  color: var(--danger);
  padding: 12px 14px;
  border-radius: var(--r);
  margin-bottom: 16px;
  font-size: 13px;
}

.navigation-banner {
  background: var(--success-bg);
  border: 1px solid rgba(52, 211, 153, 0.28);
  color: var(--success);
  padding: 12px 14px;
  border-radius: var(--r);
  margin-bottom: 16px;
  font-size: 13px;
  font-weight: 600;
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

.segment-head {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin-bottom: 12px;
}

.segment-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-top: 5px;
  flex-shrink: 0;
}

.segment-dot.approach {
  background: var(--warning);
}

.segment-dot.sat {
  background: var(--accent);
}

.segment-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.segment-sub {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.segment-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.segment-stats span {
  background: var(--bg-surface-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r);
  padding: 9px 10px;
  font-size: 13px;
  color: var(--text-secondary);
  font-family: var(--font-mono);
}

@media (max-width: 980px) {
  .route-layout {
    grid-template-columns: 1fr;
  }
}
</style>