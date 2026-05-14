<script setup>
import { onMounted, watch, ref } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const props = defineProps({
  bivacchi: {
    type: Array,
    required: true
  },
  selectedBivacco: {
    type: Object,
    default: null
  },
  showRoute: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['open', 'close'])

const mapElement = ref(null)

let map = null
let markersLayer = null
let gpxLayer = null

function makeIcon(emergency = false) {
  const stroke = emergency ? '#DC2626' : '#1E88E5'
  const accent = emergency ? '#991B1B' : '#0E6FA8'

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 40 50">
      <defs>
        <filter id="s" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.35"/>
        </filter>
      </defs>
      <path d="M20 3 L37 39 L3 39 Z"
            fill="#FFFFFF"
            stroke="${stroke}"
            stroke-width="2.5"
            stroke-linejoin="round"
            filter="url(#s)"/>
      <path d="M13 33 L20 19 L27 33 Z M20 19 L20 33"
            stroke="${accent}"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            fill="none"/>
      <circle cx="20" cy="44" r="3" fill="${stroke}"/>
    </svg>`

  return L.divIcon({
    html: svg,
    className: 'bivacs-marker',
    iconSize: [40, 50],
    iconAnchor: [20, 46],
    popupAnchor: [0, -40]
  })
}

function parseGpx(xmlText) {
  const parser = new DOMParser()
  const xml = parser.parseFromString(xmlText, 'application/xml')
  const points = [...xml.querySelectorAll('trkpt')]

  return points.map((point) => {
    const lat = Number(point.getAttribute('lat'))
    const lon = Number(point.getAttribute('lon'))
    return [lat, lon]
  })
}

async function loadGpxTrack() {
  try {
    const response = await fetch('/gpx/demo.gpx')

    if (!response.ok) {
      throw new Error('File GPX non trovato')
    }

    const xmlText = await response.text()
    const coordinates = parseGpx(xmlText)

    if (coordinates.length === 0) {
      console.warn('Il file GPX non contiene punti validi')
      return
    }

    removeGpxTrack()

    const halo = L.polyline(coordinates, {
      color: '#FFFFFF',
      weight: 7,
      opacity: 0.9,
      lineCap: 'round'
    })

    const line = L.polyline(coordinates, {
      color: '#1E88E5',
      weight: 4,
      opacity: 1,
      lineCap: 'round',
      lineJoin: 'round'
    })

    gpxLayer = L.layerGroup([halo, line]).addTo(map)

    map.fitBounds(line.getBounds(), { padding: [40, 40] })
  } catch (error) {
    console.error('Errore caricamento GPX:', error)
  }
}

function removeGpxTrack() {
  if (gpxLayer) {
    gpxLayer.remove()
    gpxLayer = null
  }
}

function renderMarkers() {
  if (!map || !markersLayer) return

  markersLayer.clearLayers()

  props.bivacchi.forEach((bivacco) => {
    if (!bivacco.latitudine || !bivacco.longitudine) return

    const marker = L.marker(
      [bivacco.latitudine, bivacco.longitudine],
      { icon: makeIcon(bivacco.emergenza) }
    )

    marker.bindPopup(`
      <strong>${bivacco.nome}</strong><br>
      ${bivacco.zona} · ${bivacco.altitudine} m
    `)

    marker.on('popupopen', () => emit('open', bivacco))
    marker.on('popupclose', () => emit('close'))

    markersLayer.addLayer(marker)
  })
}

onMounted(() => {
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
    map.invalidateSize()
  }, 100)
})

watch(
  () => props.bivacchi,
  () => {
    renderMarkers()
  },
  { deep: true }
)

watch(
  () => props.showRoute,
  async (newValue) => {
    if (newValue && props.selectedBivacco) {
      await loadGpxTrack()
    } else {
      removeGpxTrack()
    }
  }
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
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
  transition: transform 0.2s ease;
}

.map :deep(.bivacs-marker:hover) {
  transform: translateY(-2px) scale(1.08);
}
</style>