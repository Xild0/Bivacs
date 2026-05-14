<script setup>
import { onMounted, onBeforeUnmount, watch, ref, nextTick } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const props = defineProps({
  bivacchi: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['open'])

const mapElement = ref(null)

let map = null
let markersLayer = null

function makeIcon(emergency = false) {
  const color = emergency ? '#EF4444' : '#1E88E5'
  const dark = emergency ? '#991B1B' : '#0E6FA8'

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="42" height="54" viewBox="0 0 42 54">
      <defs>
        <filter id="pinShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity="0.35"/>
        </filter>
      </defs>

      <path
        d="M21 2
           C10.5 2 3 9.8 3 20
           C3 34 21 52 21 52
           C21 52 39 34 39 20
           C39 9.8 31.5 2 21 2Z"
        fill="white"
        stroke="${color}"
        stroke-width="3"
        filter="url(#pinShadow)"
      />

      <circle cx="21" cy="20" r="11" fill="${color}" opacity="0.14"/>

      <path
        d="M14.5 28 L21 14 L27.5 28 Z M21 14 L21 28"
        stroke="${dark}"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
        fill="none"
      />

      ${emergency ? `
        <circle cx="31" cy="9" r="6" fill="#EF4444" stroke="white" stroke-width="2"/>
        <path d="M31 6.5V10" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
        <circle cx="31" cy="12.2" r="1" fill="white"/>
      ` : ''}
    </svg>
  `

  return L.divIcon({
    html: svg,
    className: 'bivacs-marker',
    iconSize: [42, 54],
    iconAnchor: [21, 52],
    popupAnchor: [0, -50]
  })
}

function renderMarkers() {
  if (!map || !markersLayer) return

  markersLayer.clearLayers()

  const validCoords = []

  props.bivacchi.forEach((bivacco) => {
    const lat = Number(bivacco.latitudine)
    const lng = Number(bivacco.longitudine)

    let markerLat = lat
let markerLng = lng

const nomeKey = bivacco.nome?.toLowerCase() || ''

const coordinateOverride = {
  'bailoni': [46.02310, 11.18125],
  'carè alto': [46.10806, 10.62583],
  'vigolana': [45.97500, 11.17500],
  'paolo e nicola': [46.25833, 11.66306],
  'costanzi': [46.27895, 10.89566],
  'argentino vanin': [46.10765, 11.54316],
  'amicizia': [45.97472, 9.35261],
  'brentei': [46.17520, 10.87611],
  'pozze': [46.41469, 10.92942],
  'coldosè': [46.2596050, 11.6246864],
  'redolf': [46.34640, 11.73386],
}

Object.entries(coordinateOverride).forEach(([key, coords]) => {
  if (nomeKey.includes(key)) {
    markerLat = coords[0]
    markerLng = coords[1]
  }
})

      if (bivacco.nome?.toLowerCase().includes('bailoni')) {
        markerLat = 46.02310
        markerLng = 11.18125
        console.log('FORZO BAILONI:', markerLat, markerLng)
      }
      
      console.log('MARKER MAPPA:', bivacco.nome, {
        id: bivacco._id,
        latitudine: lat,
        longitudine: lng,
        altitudine: bivacco.altitudine
      })

    if (lat < 45.6 || lat > 46.6 || lng < 10.4 || lng > 12.0) {
    console.warn('Coordinate sospette per bivacco:', bivacco.nome, {
      latitudine: lat,
      longitudine: lng
    })
  }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      console.warn('Coordinate non valide per bivacco:', bivacco.nome, bivacco)
      return
    }

    validCoords.push([markerLat, markerLng])

    const marker = L.marker([markerLat, markerLng],{
      icon: makeIcon(Boolean(bivacco.emergenza))
    })

    marker.bindPopup(`
      <strong>${bivacco.nome}</strong><br>
      ${bivacco.zona || 'Zona non indicata'} · ${bivacco.altitudine || '—'} m<br>
      <small>lat: ${markerLat} | lng: ${markerLng}</small>
    `)

    marker.on('click', () => {
      emit('open', bivacco)
    })

    markersLayer.addLayer(marker)
  })

  if (validCoords.length > 0) {
    const bounds = L.latLngBounds(validCoords)
    map.fitBounds(bounds, { padding: [35, 35], maxZoom: 12 })
  }
}

onMounted(async () => {
  await nextTick()

  map = L.map(mapElement.value, {
    zoomControl: true,
    attributionControl: true
  }).setView([46.07, 11.12], 10)

  L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }
  ).addTo(map)

  markersLayer = L.layerGroup().addTo(map)

  renderMarkers()

  setTimeout(() => {
    map?.invalidateSize()
  }, 150)
})

onBeforeUnmount(() => {
  if (map) {
    map.remove()
    map = null
  }
})

watch(
  () => props.bivacchi,
  () => {
    renderMarkers()
  },
  { deep: true }
)
</script>

<template>
  <div ref="mapElement" class="map"></div>
</template>

<style scoped>
.map {
  height: 620px;
  width: 100%;
  border-radius: var(--r-xl, 24px);
  border: 1px solid var(--border-subtle, #e2e8f0);
  overflow: hidden;
  position: relative;
  box-shadow: var(--shadow, 0 18px 40px rgba(30, 55, 40, 0.12));
  background: #f2f0ea;
}

.map :deep(.bivacs-marker) {
  background: transparent !important;
  border: none !important;
}

.map :deep(.bivacs-marker svg) {
  transition: transform 0.18s ease;
}

.map :deep(.bivacs-marker:hover svg) {
  transform: translateY(-3px) scale(1.05);
}
</style>