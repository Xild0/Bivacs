<script setup>
import { reactive, ref, watch, computed } from 'vue'

import {
  creaRecensione,
  getRecensioni
} from '../services/api'

import TripPlanner from './TripPlanner.vue'

const props = defineProps({
  bivacco: {
    type: Object,
    required: true
  },
  isLogged: {
    type: Boolean,
    default: false
  },
  currentUser: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['route-calculated', 'clear-route', 'bivacco-updated'])

const recensioni = ref([])
const message = ref('')
const nomeUtente = computed(() => {
  if (!props.currentUser) return 'Escursionista'

  return `${props.currentUser.nome || ''} ${props.currentUser.cognome || ''}`.trim() || 'Escursionista'
})

const recensioneForm = reactive({
  stelle: 5,
  testo: '',
  anonima: false
})

async function loadRecensioni() {
  try {
    recensioni.value = await getRecensioni(props.bivacco._id)
  } catch (error) {
    console.error(error)
  }
}

async function submitRecensione() {
  if (!props.isLogged) {
    message.value = 'Accedi per lasciare una recensione.'
    return
  }

  try {
    await creaRecensione({
      bivaccoId: props.bivacco._id,
      utente: nomeUtente.value,
      stelle: Number(recensioneForm.stelle),
      testo: recensioneForm.testo,
      anonima: recensioneForm.anonima
    })

    message.value = 'Recensione inviata correttamente'

    recensioneForm.stelle = 5
    recensioneForm.testo = ''
    recensioneForm.anonima = false

    await loadRecensioni()
    emit('bivacco-updated')
  } catch (error) {
    message.value = error.message
  }
}

function onRouteCalculated(res) {
  emit('route-calculated', res)
}

function onClearRoute() {
  emit('clear-route')
}

watch(
  () => props.bivacco,
  () => {
    loadRecensioni()
    // Quando cambio bivacco, pulisco un eventuale tragitto precedente
    emit('clear-route')
  },
  { immediate: true }
)
</script>

<template>
  <aside class="details card card-header-glow">
    <header class="details-head">
      <p class="label">Scheda bivacco</p>
      <h2>{{ bivacco.nome }}</h2>
      <p class="zona-tag">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        {{ bivacco.zona }}
      </p>
    </header>

    <p v-if="message" class="toast">{{ message }}</p>

    <!-- Quick facts grid -->
    <div class="facts">
      <div class="fact">
        <span class="fact-label">Quota</span>
        <strong class="mono">{{ bivacco.altitudine }} <small>m</small></strong>
      </div>
      <div class="fact">
        <span class="fact-label">Posti letto</span>
        <strong class="mono">{{ bivacco.postiLetto }}</strong>
      </div>
      <div class="fact">
        <span class="fact-label">Rating</span>
        <strong class="mono">{{ bivacco.mediaStelle || 0 }}<small>/5</small></strong>
      </div>
      <div class="fact">
        <span class="fact-label">Stato</span>
        <strong>
          <span class="status-pill" :class="bivacco.emergenza ? 'status-danger' : 'status-ok'">
            {{ bivacco.emergenza ? 'Emergenza' : 'Operativo' }}
          </span>
        </strong>
      </div>
    </div>

    <!-- Risorse -->
    <section class="section">
      <h3 class="section-title">Risorse disponibili</h3>
      <div class="resource-list">
        <div class="resource-row">
          <span>Acqua</span>
          <span :class="bivacco.acquaPresente ? 'res-ok' : 'res-ko'">
            {{ bivacco.acquaPresente ? 'Disponibile' : 'Non disponibile' }}
          </span>
        </div>
        <div class="resource-row">
          <span>Legna</span>
          <span :class="bivacco.legnaDisponibile ? 'res-ok' : 'res-ko'">
            {{ bivacco.legnaDisponibile ? 'Disponibile' : 'Non disponibile' }}
          </span>
        </div>
      </div>
    </section>

    <!-- Pianificatore tragitto: sostituisce profilo altimetrico fisso + sezione GPX -->
    <section class="section">
      <TripPlanner
        :bivacco="bivacco"
        @route-calculated="onRouteCalculated"
        @clear-route="onClearRoute"
      />
    </section>

    <!-- Contatti emergenza -->
    <section class="section">
      <h3 class="section-title">Contatti di emergenza</h3>

      <div class="emergency-grid">
        <a href="tel:112" class="emergency-card">
          <span class="emergency-number mono">112</span>
          <span>Numero unico emergenze</span>
        </a>

        <a href="tel:118" class="emergency-card">
          <span class="emergency-number mono">118</span>
          <span>Soccorso sanitario e alpino</span>
        </a>

        <a href="tel:112" class="emergency-card emergency-wide">
          <span class="emergency-number mono">SOS</span>
          <span>Soccorso Alpino: comunicare posizione, quota e condizioni meteo</span>
        </a>
      </div>
    </section>


    <!-- Legenda CAI -->
    <section class="section">
      <h3 class="section-title">Legenda CAI</h3>
      <div class="cai-grid">
        <div class="cai-row"><span class="cai-code">T</span><span>Turistico</span></div>
        <div class="cai-row"><span class="cai-code">E</span><span>Escursionistico</span></div>
        <div class="cai-row"><span class="cai-code">EE</span><span>Escursionisti esperti</span></div>
        <div class="cai-row"><span class="cai-code">EEA</span><span>Attrezzatura richiesta</span></div>
      </div>
    </section>

    <!-- Recensioni -->
    <!-- Recensioni -->
<section class="section">
  <h3 class="section-title">Recensioni</h3>

  <div v-if="!isLogged" class="login-hint">
    Accedi per lasciare una recensione.
  </div>

  <form v-else class="review-form" @submit.prevent="submitRecensione">
    <p class="review-author">
      Pubblicherai come <strong>{{ nomeUtente }}</strong>
    </p>

    <select v-model="recensioneForm.stelle" class="select">
      <option :value="1">★ 1 stella</option>
      <option :value="2">★★ 2 stelle</option>
      <option :value="3">★★★ 3 stelle</option>
      <option :value="4">★★★★ 4 stelle</option>
      <option :value="5">★★★★★ 5 stelle</option>
    </select>

    <textarea
      v-model="recensioneForm.testo"
      class="textarea"
      placeholder="Scrivi una recensione…"
      required
    />

    <label class="checkbox">
      <input v-model="recensioneForm.anonima" type="checkbox" />
      <span class="check-box"></span>
      Pubblica come anonimo
    </label>

    <button type="submit" class="btn btn-primary btn-block">
      Invia recensione
    </button>
  </form>

  <div class="reviews">
    <div
      v-for="recensione in recensioni"
      :key="recensione._id"
      class="review"
    >
      <div class="review-head">
        <strong>{{ recensione.utente }}</strong>
        <div class="stars">
          <span v-for="n in 5" :key="n" :class="{ filled: n <= recensione.stelle }">★</span>
        </div>
      </div>
      <p>{{ recensione.testo }}</p>
    </div>

    <p v-if="recensioni.length === 0" class="empty">
      Nessuna recensione. Sii il primo a recensirlo.
    </p>
  </div>
</section>
  </aside>
</template>

<style scoped>
.details {
  padding: 28px;
}

.details-head {
  margin-bottom: 18px;
}

.details-head h2 {
  margin: 8px 0 8px;
  font-size: 1.75rem;
}

.zona-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-tertiary);
  font-size: 13px;
}

.toast {
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  color: var(--accent-hi);
  padding: 12px 14px;
  border-radius: var(--r);
  font-size: 13px;
  margin-bottom: 18px;
}

/* —— Quick facts —— */
.facts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 24px;
}

.fact {
  background: var(--bg-surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-md);
  padding: 14px;
}

.fact-label {
  display: block;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  margin-bottom: 6px;
}

.fact strong {
  font-size: 1.35rem;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.fact strong small {
  color: var(--text-tertiary);
  font-size: 0.7em;
  font-weight: 400;
  margin-left: 2px;
}

.status-pill {
  display: inline-block;
  padding: 4px 10px;
  border-radius: var(--r-full);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.status-ok { background: var(--success-bg); color: var(--success); }
.status-danger {
  background: var(--danger-bg);
  color: var(--danger);
  animation: pulseGlow 2s infinite;
}

/* —— Sections —— */
.section {
  border-top: 1px solid var(--border-subtle);
  padding-top: 22px;
  margin-top: 22px;
}

.section-title {
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 600;
  margin-bottom: 14px;
  letter-spacing: -0.01em;
}

/* —— Risorse —— */
.resource-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.resource-row {
  display: flex;
  justify-content: space-between;
  padding: 12px 14px;
  background: var(--bg-surface-2);
  border-radius: var(--r);
  font-size: 14px;
}

.resource-row > span:first-child {
  color: var(--text-secondary);
}

.res-ok { color: var(--success); font-weight: 600; }
.res-ko { color: var(--text-tertiary); }

/* —— Legenda CAI —— */
.cai-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.cai-row {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--bg-surface-2);
  padding: 10px 12px;
  border-radius: var(--r);
  font-size: 13px;
  color: var(--text-secondary);
}

.cai-code {
  display: inline-grid;
  place-items: center;
  min-width: 32px;
  height: 24px;
  padding: 0 6px;
  background: var(--accent-bg);
  color: var(--accent);
  border-radius: var(--r-sm);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
}

/* —— Review form —— */
.review-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 18px;
}

.checkbox {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
}

.checkbox input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.check-box {
  width: 18px;
  height: 18px;
  border: 1px solid var(--border-strong);
  border-radius: 5px;
  background: var(--bg-surface-2);
  display: grid;
  place-items: center;
  transition: all 0.18s var(--ease);
  position: relative;
}

.checkbox input:checked + .check-box {
  background: var(--accent);
  border-color: var(--accent);
}

.checkbox input:checked + .check-box::after {
  content: '';
  width: 5px;
  height: 9px;
  border-right: 2px solid #061018;
  border-bottom: 2px solid #061018;
  transform: rotate(45deg) translate(-1px, -1px);
}

/* —— Reviews list —— */
.reviews {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.review {
  background: var(--bg-surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-md);
  padding: 14px;
}

.review-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.review-head strong {
  font-size: 13px;
  color: var(--text-primary);
}

.review p {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.55;
}

.stars {
  display: flex;
  gap: 1px;
  font-size: 13px;
  color: var(--text-dim);
}
.stars .filled { color: #FBBF24; }

.empty {
  text-align: center;
  color: var(--text-tertiary);
  font-size: 13px;
  padding: 20px;
  background: var(--bg-surface-2);
  border-radius: var(--r-md);
}

@media (max-width: 480px) {
  .facts { grid-template-columns: 1fr; }
  .cai-grid { grid-template-columns: 1fr; }
}

.emergency-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.emergency-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  border-radius: var(--r);
  color: var(--text-primary);
  text-decoration: none;
  font-size: 13px;
}

.emergency-card:hover {
  background: rgba(248, 113, 113, 0.22);
}

.emergency-number {
  color: var(--danger);
  font-weight: 700;
  font-size: 1.2rem;
}

.emergency-wide {
  grid-column: 1 / -1;
}

@media (max-width: 480px) {
  .emergency-grid {
    grid-template-columns: 1fr;
  }

  .emergency-wide {
    grid-column: auto;
  }
}

.login-hint {
  background: var(--bg-surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r);
  padding: 12px 14px;
  color: var(--text-tertiary);
  font-size: 13px;
  margin-bottom: 18px;
}

.review-author {
  font-size: 13px;
  color: var(--text-tertiary);
}

.review-author strong {
  color: var(--text-primary);
}

</style>
