<script setup>
import { onMounted, watch, ref } from 'vue'
import L from 'leaflet'

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

// Custom marker icon — alpine peak in glacier blue, matches our logo
function makeIcon(emergency = false) {
  const color = emergency ? '#F87171' : '#4FC3F7'
  const glow  = emergency ? 'rgba(248,113,113,0.55)' : 'rgba(79,195,247,0.55)'

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48">
      <defs>
        <filter id="g" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <path d="M20 4 L36 36 L4 36 Z" fill="${color}" stroke="${color}" stroke-width="1.5" filter="url(#g)" opacity="0.95"/>
      <path d="M20 4 L36 36 L4 36 Z" fill="#0F1117" transform="translate(0,0) scale(0.7) translate(8.5,5.5)"/>
      <path d="M14 30 L20 18 L26 30 Z M20 18 L20 30" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <circle cx="20" cy="42" r="3" fill="${color}" filter="url(#g)"/>
    </svg>`

  return L.divIcon({
    html: svg,
    className: 'bivacs-marker',
    iconSize:   [40, 48],
    iconAnchor: [20, 44],
    popupAnchor: [0, -38]
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

    if (gpxLayer) gpxLayer.remove()

    // Glow effect via two stacked polylines
    const glow = L.polyline(coordinates, {
      color: '#4FC3F7',
      weight: 12,
      opacity: 0.18,
      lineCap: 'round'
    })

    const line = L.polyline(coordinates, {
      color: '#7DD8FF',
      weight: 4,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round'
    })

    gpxLayer = L.layerGroup([glow, line]).addTo(map)

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
      <strong>${bivacco.nome}</strong>
      ${bivacco.zona} · ${bivacco.altitudine} m
    `)

    marker.on('popupopen',  () => emit('open',  bivacco))
    marker.on('popupclose', () => emit('close'))

    markersLayer.addLayer(marker)
  })
}

onMounted(() => {
  map = L.map(mapElement.value, {
    zoomControl: true,
    attributionControl: true
  }).setView([46.07, 11.12], 8)

  // CartoDB Dark Matter — beautiful dark tiles
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> · &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map)

  markersLayer = L.layerGroup().addTo(map)

  renderMarkers()
})

watch(
  () => props.bivacchi,
  () => renderMarkers(),
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
  border-radius: var(--r-xl);
  border: 1px solid var(--border-subtle);
  overflow: hidden;
  position: relative;
  box-shadow: var(--shadow);
}

/* Marker drop animation when added */
.map :deep(.bivacs-marker) {
  background: transparent !important;
  border: none !important;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.5));
  transition: transform 0.2s var(--ease-out);
}

.map :deep(.bivacs-marker:hover) {
  transform: translateY(-2px) scale(1.08);
}
</style>
