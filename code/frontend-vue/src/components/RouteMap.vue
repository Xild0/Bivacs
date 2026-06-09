<script setup>
import { onMounted, onBeforeUnmount, ref, nextTick, watch } from 'vue'
import L from 'leaflet'

const props = defineProps({
  routeCoords: { type: Array, required: true },
  officialTrailCoords: { type: Array, default: () => [] },
  startCoord: { type: Array, required: true },
  endCoord: { type: Array, required: true },
  startName: { type: String, default: 'Partenza' },
  endName: { type: String, default: 'Arrivo' }
})

const mapEl = ref(null)
let map = null
let routeLayer = null

/**
 * Verifica che una coordinata sia valida.
 *
 * @param {Array<number|string>} coord - Coordinata nel formato [latitudine, longitudine].
 * @returns {boolean} True se la coordinata contiene valori numerici validi.
 */
function isValidCoord(coord) {
  return (
    Array.isArray(coord) &&
    coord.length >= 2 &&
    Number.isFinite(Number(coord[0])) &&
    Number.isFinite(Number(coord[1]))
  )
}

/**
 * Restituisce la coordinata di partenza del percorso.
 *
 * @returns {Array<number|string>} Coordinata di partenza.
 */
function getStartCoord() {
  if (props.routeCoords?.length > 1 && isValidCoord(props.routeCoords[0])) {
    return props.routeCoords[0]
  }

  return props.startCoord
}

/**
 * Restituisce la coordinata finale del percorso.
 *
 * @returns {Array<number|string>} Coordinata di arrivo.
 */
function getEndCoord() {
  if (props.routeCoords?.length > 1) {
    const last = props.routeCoords[props.routeCoords.length - 1]
    if (isValidCoord(last)) return last
  }

  return props.endCoord
}

/**
 * Crea l'icona Leaflet per il punto di partenza.
 *
 * @returns {L.DivIcon} Icona del marker di partenza.
 */
function makeStartIcon() {
  return L.divIcon({
    html: `
      <div style="
        width:28px;height:28px;border-radius:50%;
        background:#22C55E;border:3px solid white;
        box-shadow:0 3px 10px rgba(0,0,0,.35);
      "></div>
    `,
    className: 'route-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  })
}

/**
 * Crea l'icona Leaflet per il punto di arrivo.
 *
 * @returns {L.DivIcon} Icona del marker di arrivo.
 */
function makeEndIcon() {
  return L.divIcon({
    html: `
      <div style="
        width:34px;height:34px;border-radius:50%;
        background:#1E88E5;border:3px solid white;
        box-shadow:0 3px 10px rgba(0,0,0,.35);
      "></div>
    `,
    className: 'route-marker',
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  })
}

/**
 * Disegna sulla mappa il percorso, il tracciato ufficiale e i marker di partenza/arrivo.
 *
 * @returns {void}
 */
function renderRoute() {
  if (!map) return

  if (routeLayer) {
    routeLayer.remove()
    routeLayer = null
  }

  routeLayer = L.layerGroup().addTo(map)

  const boundsCoords = []

  if (props.officialTrailCoords?.length > 1) {
    L.polyline(props.officialTrailCoords, {
      color: '#94A3B8',
      weight: 4,
      opacity: 0.55,
      dashArray: '8 8',
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(routeLayer)

    boundsCoords.push(...props.officialTrailCoords)
  }

  if (props.routeCoords?.length > 1) {
    const halo = L.polyline(props.routeCoords, {
      color: '#FFFFFF',
      weight: 8,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(routeLayer)

    L.polyline(props.routeCoords, {
      color: '#1E88E5',
      weight: 4,
      opacity: 1,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(routeLayer)

    boundsCoords.push(...props.routeCoords)

    const start = getStartCoord()
    const end = getEndCoord()

    L.marker(start, { icon: makeStartIcon() })
      .bindPopup(`<strong>Partenza</strong><br>${props.startName}`)
      .addTo(routeLayer)

    L.marker(end, { icon: makeEndIcon() })
      .bindPopup(`<strong>Arrivo</strong><br>${props.endName}`)
      .addTo(routeLayer)

    map.fitBounds(halo.getBounds(), { padding: [40, 40] })
  } else if (boundsCoords.length > 1) {
    map.fitBounds(L.latLngBounds(boundsCoords), { padding: [40, 40] })
  }
}

/**
 * Inizializza la mappa Leaflet e disegna il percorso.
 */
onMounted(async () => {
  await nextTick()

  map = L.map(mapEl.value, {
    zoomControl: true,
    attributionControl: true
  })

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map)

  renderRoute()

  setTimeout(() => map?.invalidateSize(), 300)
})

/**
 * Ridisegna il percorso quando cambiano coordinate o tracciati.
 */
watch(
  () => [props.routeCoords, props.officialTrailCoords, props.startCoord, props.endCoord],
  () => renderRoute(),
  { deep: true }
)

/**
 * Rimuove la mappa Leaflet quando il componente viene smontato.
 */
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
  background: #f2f0ea;
  box-shadow: var(--shadow);
}

.route-map :deep(.route-marker) {
  background: transparent !important;
  border: none !important;
}

@media (max-width: 720px) {
  .route-map {
    height: 320px;
  }
}
</style>