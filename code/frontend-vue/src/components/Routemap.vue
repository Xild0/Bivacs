<script setup>
import { onMounted, onBeforeUnmount, ref, nextTick } from 'vue'
import L from 'leaflet'

const props = defineProps({
  routeCoords: { type: Array, required: true },   // [[lat,lng], …]
  startCoord:  { type: Array, required: true },   // [lat, lng]
  endCoord:    { type: Array, required: true },   // [lat, lng]
  startName:   { type: String, default: 'Partenza' },
  endName:     { type: String, default: 'Arrivo'   }
})

const mapEl = ref(null)
let map = null

function makeStartIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <defs>
        <filter id="ss1" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.4"/>
        </filter>
      </defs>
      <circle cx="16" cy="16" r="12" fill="#22C55E" stroke="white" stroke-width="3" filter="url(#ss1)"/>
      <circle cx="16" cy="16" r="4" fill="white"/>
    </svg>`
  return L.divIcon({
    html: svg,
    className: 'route-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -14]
  })
}

function makeEndIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 40 50">
      <defs>
        <filter id="se1" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.35"/>
        </filter>
      </defs>
      <path d="M20 3 L37 39 L3 39 Z" fill="#FFFFFF" stroke="#1E88E5" stroke-width="2.5" stroke-linejoin="round" filter="url(#se1)"/>
      <path d="M13 33 L20 19 L27 33 Z M20 19 L20 33" stroke="#0E6FA8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <circle cx="20" cy="44" r="3" fill="#1E88E5"/>
    </svg>`
  return L.divIcon({
    html: svg,
    className: 'route-marker',
    iconSize: [40, 50],
    iconAnchor: [20, 46],
    popupAnchor: [0, -40]
  })
}

onMounted(async () => {
  await nextTick()

  map = L.map(mapEl.value, {
    zoomControl: true,
    attributionControl: true
  })

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(map)

  // Linea del tragitto — alone bianco + linea blu
  const halo = L.polyline(props.routeCoords, {
    color: '#FFFFFF', weight: 8, opacity: 0.95, lineCap: 'round'
  }).addTo(map)

  L.polyline(props.routeCoords, {
    color: '#1E88E5', weight: 4, opacity: 1, lineCap: 'round', lineJoin: 'round'
  }).addTo(map)

  // Markers partenza + arrivo
  L.marker(props.startCoord, { icon: makeStartIcon() })
    .bindPopup(`<strong>Partenza</strong>${props.startName}`)
    .addTo(map)

  L.marker(props.endCoord, { icon: makeEndIcon() })
    .bindPopup(`<strong>Arrivo</strong>${props.endName}`)
    .addTo(map)

  map.fitBounds(halo.getBounds(), { padding: [40, 40] })

  // Forza il refresh delle dimensioni dopo l'animazione del modal
  setTimeout(() => map && map.invalidateSize(), 350)
})

onBeforeUnmount(() => {
  if (map) {
    map.remove()
    map = null
  }
})
</script>

<template>
  <div ref="mapEl" class="route-map"></div>
</template>

<style scoped>
.route-map {
  width: 100%;
  height: 420px;
  border-radius: var(--r-lg);
  border: 1px solid var(--border-subtle);
  overflow: hidden;
  background: #F2F0EA;
  box-shadow: var(--shadow);
}

.route-map :deep(.route-marker) {
  background: transparent !important;
  border: none !important;
}

@media (max-width: 720px) {
  .route-map { height: 320px; }
}
</style>