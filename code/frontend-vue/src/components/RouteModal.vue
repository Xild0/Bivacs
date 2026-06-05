<!--
  @file RouteModal.vue
  @description Modale riepilogativa del tragitto verso un bivacco.
  Mostra mappa, distanza, durata, dislivello, profilo altimetrico
  e stato della navigazione simulata.
-->

<script setup>
import { computed, ref } from 'vue'

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

const navigationActive = ref(false)

const routeCoords = computed(() => props.result?.coords || [])

const hasRoute = computed(() => routeCoords.value.length > 1)

const startCoord = computed(() => {
  return routeCoords.value?.[0] || [
    Number(props.bivacco.latitudine),
    Number(props.bivacco.longitudine)
  ]
})

const endCoord = computed(() => {
  const coords = routeCoords.value

  if (coords?.length) {
    return coords[coords.length - 1]
  }

  return [
    Number(props.bivacco.latitudine),
    Number(props.bivacco.longitudine)
  ]
})

const profile = computed(() => props.result?.profile || [])

const totalDistanceKm = computed(() => {
  return (props.result?.distance || 0) / 1000
})

const totalDurationMinutes = computed(() => {
  return Math.round((props.result?.duration || 0) / 60)
})

const totalAscent = computed(() => {
  return Math.round(props.result?.ascent || 0)
})

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
</script>

<template>
  <Modal
    label="Navigazione"
    :title="`Tragitto per ${bivacco.nome}`"
    max-width="1200px"
    @close="emit('close')"
  >
    <p v-if="hasRoute" class="info-box">
      Percorso calcolato dinamicamente con OpenRouteService usando il profilo escursionistico.
    </p>

    <p v-else class="warning-box">
      Nessun percorso dinamico disponibile per questo bivacco.
    </p>

    <p v-if="navigationActive" class="navigation-banner">
      Navigazione attiva verso {{ bivacco.nome }}
    </p>

    <div class="route-layout">
      <div class="map-wrap">
        <RouteMap
          :route-coords="routeCoords"
          :official-trail-coords="[]"
          :start-coord="startCoord"
          :end-coord="endCoord"
          start-name="Partenza"
          :end-name="bivacco.nome"
        />
      </div>

      <aside class="sidebar">
        <div class="summary-box">
          <p class="summary-label">
            Percorso dinamico consigliato
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

        <div class="actions">
          <button
            v-if="!navigationActive"
            class="btn btn-primary btn-block"
            :disabled="!hasRoute"
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

.summary-box {
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

.dim-text {
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
.warning-box,
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

.warning-box {
  background: var(--warning-bg);
  border: 1px solid rgba(251, 191, 36, 0.28);
  color: var(--warning);
}

.navigation-banner {
  background: var(--success-bg);
  border: 1px solid rgba(52, 211, 153, 0.28);
  color: var(--success);
  font-weight: 600;
}

@media (max-width: 980px) {
  .route-layout {
    grid-template-columns: 1fr;
  }
}
</style>