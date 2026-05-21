/**
 * @file RouteModal.vue
 * @description Modale di navigazione che mostra percorso calcolato, tracciato GPX,
 * avvicinamento al sentiero, dati SAT e profilo altimetrico.
 *
 * Routing intelligente: trova il punto più vicino del sentiero ufficiale rispetto
 * al punto di partenza scelto dall'utente, anziché forzare il passaggio dal primo
 * punto del file GPX. Se il sentiero è troppo lontano, abbandona il GPX e usa
 * solo il tragitto diretto calcolato da OpenRouteService.
 */

<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  getPercorsiByBivacco,
  calcolaTragitto,
  getGpxText,
  scaricaGpxAutenticato,
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

// Soglie di routing (in metri)
const TRAIL_NEAR_THRESHOLD = 500   // se sei più vicino di così al sentiero, niente avvicinamento
const TRAIL_FAR_THRESHOLD = 5000   // se sei più lontano di così, abbandona il GPX

const gpxTrimmedCoords = ref([])
const gpxTrimmedProfile = ref([])
const loadingGpx = ref(false)
const gpxError = ref('')
const downloadError = ref('')
const downloadInCorso = ref(false)
const gpxAbandoned = ref(false)
const distanzaDalSentiero = ref(null)

const navigationActive = ref(false)
const approachResult = ref(null)
const percorsi = ref([])

const logged = ref(isLoggedIn())

const percorso = computed(() => {
  return percorsi.value[0] || props.bivacco.percorsi?.[0] || null
})

// Le coordinate effettive da disegnare sulla mappa
const routeCoords = computed(() => {
  if (approachResult.value?.coords?.length && gpxTrimmedCoords.value.length) {
    return [...approachResult.value.coords, ...gpxTrimmedCoords.value]
  }
  if (gpxTrimmedCoords.value.length > 0) {
    return gpxTrimmedCoords.value
  }
  return props.result.coords
})

// Profilo altimetrico combinato
const profile = computed(() => {
  // GPX abbandonato o nessun GPX → usa profilo ORS diretto
  if (gpxTrimmedProfile.value.length === 0) {
    return props.result.profile
  }
  // Solo GPX (utente sul sentiero) → profilo del segmento
  if (!approachResult.value?.profile?.length) {
    return gpxTrimmedProfile.value
  }
  // Avvicinamento + sentiero → concatena traslando le distanze del GPX
  const approachProfile = approachResult.value.profile
  const approachLastDist = approachProfile[approachProfile.length - 1]?.distance || 0
  const trailShifted = gpxTrimmedProfile.value.map(p => ({
    distance: p.distance + approachLastDist,
    elevation: p.elevation
  }))
  return [...approachProfile, ...trailShifted]
})

const startCoord = computed(() => {
  return routeCoords.value?.[0] || props.result.coords?.[0]
})

const endCoord = computed(() => {
  const coords = routeCoords.value
  if (coords?.length > 0) return coords[coords.length - 1]
  return [Number(props.bivacco.latitudine), Number(props.bivacco.longitudine)]
})

const downloadFileName = computed(() => {
  const nome = props.bivacco.nome
    ? props.bivacco.nome.replace(/[^a-zA-Z0-9_-]/g, '_')
    : 'percorso'
  return `${nome}.gpx`
})

// Statistiche del segmento di sentiero effettivamente percorso (dopo trim)
const trailSegmentStats = computed(() => {
  if (gpxTrimmedProfile.value.length === 0) return null

  const last = gpxTrimmedProfile.value[gpxTrimmedProfile.value.length - 1]
  const lunghezzaKm = (last?.distance || 0) / 1000

  let ascent = 0
  for (let i = 1; i < gpxTrimmedProfile.value.length; i++) {
    const diff = gpxTrimmedProfile.value[i].elevation - gpxTrimmedProfile.value[i - 1].elevation
    if (diff > 0) ascent += diff
  }

  // Formula coerente con lo script di import: 25 min/km
  const durataStimata = Math.round(lunghezzaKm * 25)

  return {
    lunghezzaKm,
    durataStimata,
    ascent: Math.round(ascent)
  }
})

const totalDistanceKm = computed(() => {
  // Se abbiamo abbandonato il GPX, usa la distanza ORS diretta
  if (gpxAbandoned.value || gpxTrimmedCoords.value.length === 0) {
    return (props.result.distance || 0) / 1000
  }
  const approachKm = approachResult.value?.distance ? approachResult.value.distance / 1000 : 0
  const trailKm = trailSegmentStats.value?.lunghezzaKm || 0
  return approachKm + trailKm
})

const totalDurationMinutes = computed(() => {
  if (gpxAbandoned.value || gpxTrimmedCoords.value.length === 0) {
    return Math.round((props.result.duration || 0) / 60)
  }
  const approachMin = approachResult.value?.duration ? Math.round(approachResult.value.duration / 60) : 0
  const trailMin = trailSegmentStats.value?.durataStimata || 0
  return approachMin + trailMin
})

const totalAscent = computed(() => {
  if (gpxAbandoned.value || gpxTrimmedCoords.value.length === 0) {
    return Math.round(props.result.ascent || 0)
  }
  const approachAscent = approachResult.value?.ascent || 0
  const trailAscent = trailSegmentStats.value?.ascent || 0
  return Math.round(approachAscent + trailAscent)
})

// ─────────── Helpers ───────────

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const toRad = (deg) => deg * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Estrae i punti del GPX come array di { lat, lng, ele }.
 */
function parseGpxToRichPoints(xmlText) {
  const parser = new DOMParser()
  const xml = parser.parseFromString(xmlText, 'application/xml')

  const allNodes = Array.from(xml.getElementsByTagName('*'))
  const pointNodes = allNodes.filter(node =>
    node.localName === 'trkpt' ||
    node.localName === 'rtept' ||
    node.localName === 'wpt'
  )

  const richPoints = []
  pointNodes.forEach((node) => {
    const lat = Number(node.getAttribute('lat'))
    const lng = Number(node.getAttribute('lon'))
    const eleNode = Array.from(node.children).find(c => c.localName === 'ele')
    const eleText = eleNode?.textContent?.trim() || ''
    const ele = eleText ? Number(eleText) : null

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

    richPoints.push({
      lat, lng,
      ele: Number.isFinite(ele) ? ele : null
    })
  })

  return richPoints
}

/**
 * Trova l'indice del punto del GPX più vicino a una posizione utente.
 */
function findClosestPointIndex(userPoint, richPoints) {
  let nearestIdx = 0
  let nearestDist = Infinity
  for (let i = 0; i < richPoints.length; i++) {
    const d = haversine(userPoint[0], userPoint[1], richPoints[i].lat, richPoints[i].lng)
    if (d < nearestDist) {
      nearestDist = d
      nearestIdx = i
    }
  }
  return { index: nearestIdx, distance: nearestDist }
}

/**
 * Determina se il GPX scorre valle→bivacco ('forward') o bivacco→valle ('reverse'),
 * confrontando quale estremo del file è geograficamente più vicino al bivacco.
 */
function determineDirection(richPoints, bivaccoLat, bivaccoLng) {
  if (richPoints.length < 2) return 'forward'
  const first = richPoints[0]
  const last = richPoints[richPoints.length - 1]
  const dStart = haversine(first.lat, first.lng, bivaccoLat, bivaccoLng)
  const dEnd = haversine(last.lat, last.lng, bivaccoLat, bivaccoLng)
  return dEnd <= dStart ? 'forward' : 'reverse'
}

/**
 * A partire da un punto di ingresso sul GPX, restituisce la sequenza dei punti
 * che porta al bivacco, rispettando la direzione del file.
 */
function getTrailToBivacco(richPoints, entryIndex, direction) {
  if (direction === 'forward') {
    return richPoints.slice(entryIndex)
  }
  return richPoints.slice(0, entryIndex + 1).reverse()
}

/**
 * Trasforma una sequenza di rich points in coords [[lat, lng], …] e profilo
 * altimetrico con distanze cumulate.
 */
function buildCoordsAndProfile(orientedPoints) {
  const coords = []
  const profileArr = []
  let cumDist = 0
  let prev = null

  orientedPoints.forEach((p) => {
    if (prev) {
      cumDist += haversine(prev.lat, prev.lng, p.lat, p.lng)
    }
    coords.push([p.lat, p.lng])
    if (Number.isFinite(p.ele)) {
      profileArr.push({ distance: cumDist, elevation: p.ele })
    }
    prev = p
  })

  return { coords, profile: profileArr }
}

// ─────────── Formatters ───────────

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

function formatDurationFromMinutes(minutes) {
  if (!minutes && minutes !== 0) return '—'
  const h = Math.floor(Number(minutes) / 60)
  const m = Number(minutes) % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

function formatKmFromDb(value) {
  if (!value) return '—'
  return `${Number(value).toFixed(2)} km`
}

// ─────────── Main load ───────────

async function loadGpx() {
  if (percorsi.value.length === 0) {
    percorsi.value = await getPercorsiByBivacco(props.bivacco._id)
  }

  if (!percorso.value?._id) {
    gpxError.value = 'Nessun percorso GPX associato a questo bivacco. Mostro il tragitto diretto calcolato.'
    return
  }

  loadingGpx.value = true
  gpxError.value = ''

  try {
    const xmlText = await getGpxText(percorso.value._id)
    const allPoints = parseGpxToRichPoints(xmlText)

    if (allPoints.length === 0) {
      throw new Error('Il file GPX non contiene punti validi.')
    }

    const bivaccoLat = Number(props.bivacco.latitudine)
    const bivaccoLng = Number(props.bivacco.longitudine)
    const direction = determineDirection(allPoints, bivaccoLat, bivaccoLng)

    const userStart = props.result.coords?.[0]

    // Se non ho un punto di partenza, mostro tutto il GPX orientato verso il bivacco
    if (!userStart) {
      const oriented = direction === 'forward' ? allPoints : [...allPoints].reverse()
      const built = buildCoordsAndProfile(oriented)
      gpxTrimmedCoords.value = built.coords
      gpxTrimmedProfile.value = built.profile
      return
    }

    const { index: nearestIdx, distance: distToTrail } = findClosestPointIndex(userStart, allPoints)
    distanzaDalSentiero.value = Math.round(distToTrail)

    // Caso 3: utente troppo lontano dal sentiero → abbandono GPX, uso solo ORS diretto
    if (distToTrail > TRAIL_FAR_THRESHOLD) {
      gpxAbandoned.value = true
      gpxTrimmedCoords.value = []
      gpxTrimmedProfile.value = []
      approachResult.value = null
      return
    }

    // Trimming del GPX dal punto di ingresso fino al bivacco
    const trailSegment = getTrailToBivacco(allPoints, nearestIdx, direction)
    const { coords: trailCoords, profile: trailProfile } = buildCoordsAndProfile(trailSegment)
    gpxTrimmedCoords.value = trailCoords
    gpxTrimmedProfile.value = trailProfile

    // Caso 1: utente sostanzialmente sul sentiero → no avvicinamento
    if (distToTrail <= TRAIL_NEAR_THRESHOLD) {
      approachResult.value = null
      return
    }

    // Caso 2: avvicinamento dall'utente al punto più vicino del sentiero
    const entryPoint = [allPoints[nearestIdx].lat, allPoints[nearestIdx].lng]
    try {
      approachResult.value = await calcolaTragitto(userStart, entryPoint)
    } catch (error) {
      console.warn('Avvicinamento non calcolabile:', error.message)
      approachResult.value = null
    }
  } catch (error) {
    gpxError.value = error.message
  } finally {
    loadingGpx.value = false
  }
}

async function avviaDownload() {
  downloadError.value = ''
  if (!percorso.value?._id) {
    downloadError.value = 'Nessun file GPX disponibile per il download.'
    return
  }
  downloadInCorso.value = true
  try {
    await scaricaGpxAutenticato(percorso.value._id, downloadFileName.value)
  } catch (error) {
    downloadError.value = error.message
  } finally {
    downloadInCorso.value = false
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
      {{ gpxError }}
    </p>

    <p v-if="gpxAbandoned" class="info-box">
      Il sentiero SAT ufficiale passa a {{ (distanzaDalSentiero / 1000).toFixed(1) }} km dal tuo punto di partenza:
      è più conveniente raggiungere il bivacco con un tragitto diretto, mostrato qui sotto.
      Puoi comunque scaricare il GPX ufficiale come riferimento.
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
          start-name="Partenza"
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
            <div class="stat-box">
              <span class="label-small">Dislivello +</span>
              <strong>+{{ totalAscent }} m</strong>
            </div>
          </div>
        </div>

        <div v-if="approachResult" class="segment-box">
          <div class="segment-head">
            <span class="segment-dot approach"></span>
            <div>
              <p class="segment-title">Avvicinamento</p>
              <p class="segment-sub">Dal tuo punto di partenza al sentiero ufficiale</p>
            </div>
          </div>

          <div class="segment-stats">
            <span>{{ formatKmFromMeters(approachResult.distance) }}</span>
            <span>{{ formatDurationFromSeconds(approachResult.duration) }}</span>
            <span>+{{ Math.round(approachResult.ascent || 0) }} m</span>
          </div>
        </div>

        <div v-if="trailSegmentStats" class="segment-box">
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
            <span>{{ formatKmFromDb(trailSegmentStats.lunghezzaKm) }}</span>
            <span>{{ formatDurationFromMinutes(trailSegmentStats.durataStimata) }}</span>
            <span>+{{ trailSegmentStats.ascent }} m</span>
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

        <p v-if="downloadError" class="error-box">
          {{ downloadError }}
        </p>

        <div class="actions">
          <button
            v-if="logged && percorso?._id"
            class="btn btn-ghost btn-block"
            :disabled="downloadInCorso"
            @click="avviaDownload"
          >
            {{ downloadInCorso ? 'Download in corso…' : 'Scarica GPX ufficiale' }}
          </button>

          <p v-else-if="!logged && percorso?._id" class="login-hint">
            Accedi per scaricare il file GPX e poterlo usare offline.
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
.route-layout { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 20px; }
.map-wrap { min-width: 0; }
.sidebar { display: flex; flex-direction: column; gap: 18px; }
.stats-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
.stat-box { background: var(--bg-surface-2); border: 1px solid var(--border-subtle); border-radius: var(--r-md); padding: 14px; display: flex; flex-direction: column; gap: 4px; }
.label-small { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-tertiary); }
.stat-box strong { font-size: 1.05rem; font-weight: 600; color: var(--text-primary); }
.profile-section { display: flex; flex-direction: column; gap: 8px; }
.profile-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-tertiary); }
.dim-text { font-size: 13px; color: var(--text-tertiary); background: var(--bg-surface-2); border: 1px solid var(--border-subtle); border-radius: var(--r); padding: 12px; }
.actions { display: flex; flex-direction: column; gap: 10px; }
.info-box { background: var(--accent-bg); border: 1px solid var(--accent-border); color: var(--accent-hi); padding: 12px 14px; border-radius: var(--r); margin-bottom: 16px; font-size: 13px; }
.error-box { background: var(--danger-bg); border: 1px solid var(--danger-border); color: var(--danger); padding: 12px 14px; border-radius: var(--r); margin-bottom: 16px; font-size: 13px; }
.navigation-banner { background: var(--success-bg); border: 1px solid rgba(52, 211, 153, 0.28); color: var(--success); padding: 12px 14px; border-radius: var(--r); margin-bottom: 16px; font-size: 13px; font-weight: 600; }
.summary-box, .segment-box { background: var(--bg-surface-2); border: 1px solid var(--border-subtle); border-radius: var(--r-md); padding: 14px; }
.summary-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent); margin-bottom: 10px; font-weight: 600; }
.segment-head { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 12px; }
.segment-dot { width: 12px; height: 12px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
.segment-dot.approach { background: var(--warning); }
.segment-dot.sat { background: var(--accent); }
.segment-title { font-size: 14px; font-weight: 700; color: var(--text-primary); }
.segment-sub { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; }
.segment-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.segment-stats span { background: var(--bg-surface-3); border: 1px solid var(--border-subtle); border-radius: var(--r); padding: 9px 10px; font-size: 13px; color: var(--text-secondary); font-family: var(--font-mono); }
.login-hint { background: var(--bg-surface-2); border: 1px solid var(--border-subtle); border-radius: var(--r); padding: 12px 14px; color: var(--text-tertiary); font-size: 13px; text-align: center; }
@media (max-width: 980px) { .route-layout { grid-template-columns: 1fr; } .stats-grid { grid-template-columns: 1fr; } }
</style>