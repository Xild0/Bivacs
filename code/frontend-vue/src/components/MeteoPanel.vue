<script setup>
import { ref, watch, computed } from 'vue'
import { getMeteoBivacco, getPrevisioniBivacco } from '../services/api'

const props = defineProps({
  bivacco: {
    type: Object,
    required: true
  }
})

const meteo = ref(null)
const previsioni = ref([])
const loading = ref(false)
const error = ref('')

const icona = computed(() => {
  if (!meteo.value) return '⛰️'
  if (meteo.value.precipitazioni >= 10) return '🌧️'
  if (meteo.value.vento >= 50) return '💨'
  if (meteo.value.temperatura <= 0) return '❄️'
  return '☀️'
})

async function loadMeteo() {
  if (!props.bivacco?._id) return

  loading.value = true
  error.value = ''

  try {
    const meteoData = await getMeteoBivacco(props.bivacco._id)
    meteo.value = meteoData.meteo

    const previsioniData = await getPrevisioniBivacco(props.bivacco._id)
    previsioni.value = previsioniData.previsioni || []
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

watch(
  () => props.bivacco._id,
  () => loadMeteo(),
  { immediate: true }
)
</script>

<template>
  <section class="meteo-panel">
    <div class="meteo-head">
      <div>
        <p class="label">Meteo</p>
        <h3>Condizioni in quota</h3>
      </div>
      <span class="meteo-icon">{{ icona }}</span>
    </div>

    <p v-if="loading" class="meteo-loading">
      Caricamento meteo…
    </p>

    <p v-else-if="error" class="meteo-error">
      {{ error }}
    </p>

    <div v-else-if="meteo">
      <div v-if="meteo.allertaPAT" class="meteo-alert">
        ⚠️ Condizioni meteo potenzialmente avverse
      </div>

      <div class="meteo-grid">
        <div class="meteo-box">
          <span>Temperatura</span>
          <strong class="mono">{{ meteo.temperatura }}°C</strong>
        </div>

        <div class="meteo-box">
          <span>Vento</span>
          <strong class="mono">{{ meteo.vento }} km/h</strong>
        </div>

        <div class="meteo-box">
          <span>Precipitazioni</span>
          <strong class="mono">{{ meteo.precipitazioni }} mm</strong>
        </div>

        <div class="meteo-box">
          <span>Rischio</span>
          <strong class="risk" :class="`risk-${meteo.livelloRischio}`">
            {{ meteo.livelloRischio }}
          </strong>
        </div>
      </div>

      <div class="forecast">
        <h4>Previsioni 3 giorni</h4>

        <div class="forecast-list">
          <div
            v-for="giorno in previsioni"
            :key="giorno.giorno"
            class="forecast-row"
            :class="{ danger: giorno.allerta }"
          >
            <span class="mono">{{ giorno.giorno }}</span>
            <span>{{ giorno.temperaturaMin }}° / {{ giorno.temperaturaMax }}°</span>
            <span>{{ giorno.ventoMax }} km/h</span>
            <span>{{ giorno.precipitazioni }} mm</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.meteo-panel {
  background: var(--bg-surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-lg);
  padding: 16px;
}

.meteo-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;
}

.meteo-head h3 {
  font-size: 1.05rem;
  margin-top: 4px;
}

.meteo-icon {
  font-size: 2rem;
}

.meteo-loading,
.meteo-error {
  font-size: 13px;
  color: var(--text-tertiary);
}

.meteo-error {
  color: var(--danger);
}

.meteo-alert {
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  color: var(--danger);
  padding: 10px 12px;
  border-radius: var(--r);
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 12px;
}

.meteo-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.meteo-box {
  background: var(--bg-surface-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meteo-box span {
  font-size: 11px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.meteo-box strong {
  font-size: 1.05rem;
  color: var(--text-primary);
}

.risk {
  font-size: 0.8rem !important;
  width: fit-content;
  padding: 4px 8px;
  border-radius: var(--r-full);
  text-transform: capitalize;
}

.risk-basso {
  background: var(--success-bg);
  color: var(--success) !important;
}

.risk-moderato {
  background: var(--warning-bg);
  color: var(--warning) !important;
}

.risk-marcato,
.risk-forte,
.risk-molto_forte {
  background: var(--danger-bg);
  color: var(--danger) !important;
}

.forecast {
  margin-top: 16px;
}

.forecast h4 {
  font-size: 0.95rem;
  margin-bottom: 8px;
}

.forecast-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.forecast-row {
  display: grid;
  grid-template-columns: 1.1fr 1fr 1fr 0.8fr;
  gap: 8px;
  align-items: center;
  background: var(--bg-surface-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r);
  padding: 9px 10px;
  font-size: 12px;
  color: var(--text-secondary);
}

.forecast-row.danger {
  border-color: var(--danger-border);
  background: var(--danger-bg);
  color: var(--danger);
}

@media (max-width: 480px) {
  .meteo-grid,
  .forecast-row {
    grid-template-columns: 1fr;
  }
}
</style>