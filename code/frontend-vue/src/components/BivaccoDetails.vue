<script setup>
import { reactive, ref, watch } from 'vue'

import {
  creaRecensione,
  getRecensioni
} from '../services/api'

const props = defineProps({
  bivacco: {
    type: Object,
    required: true
  }
})

// FIX: defineEmits mancava nel file originale, "show-route" non veniva mai emesso
const emit = defineEmits(['show-route'])

const recensioni = ref([])
const message = ref('')

const recensioneForm = reactive({
  utente: '',
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
  try {
    await creaRecensione({
      bivaccoId: props.bivacco._id,
      utente: recensioneForm.utente,
      stelle: Number(recensioneForm.stelle),
      testo: recensioneForm.testo,
      anonima: recensioneForm.anonima
    })

    message.value = 'Recensione inviata correttamente'

    recensioneForm.utente = ''
    recensioneForm.stelle = 5
    recensioneForm.testo = ''
    recensioneForm.anonima = false

    await loadRecensioni()
  } catch (error) {
    message.value = error.message
  }
}

watch(
  () => props.bivacco,
  () => {
    loadRecensioni()
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

    <!-- Profilo altimetrico -->
    <section class="section">
      <h3 class="section-title">Profilo altimetrico</h3>

      <div class="elevation">
        <svg viewBox="0 0 400 120" class="elevation-svg" preserveAspectRatio="none">
          <defs>
            <linearGradient id="elevFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="#4FC3F7" stop-opacity="0.55" />
              <stop offset="100%" stop-color="#4FC3F7" stop-opacity="0" />
            </linearGradient>
            <linearGradient id="elevLine" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stop-color="#7DD8FF" />
              <stop offset="100%" stop-color="#4FC3F7" />
            </linearGradient>
          </defs>

          <!-- Grid lines -->
          <line x1="0" y1="30"  x2="400" y2="30"  stroke="#1A1E27" stroke-width="1" stroke-dasharray="2 4" />
          <line x1="0" y1="60"  x2="400" y2="60"  stroke="#1A1E27" stroke-width="1" stroke-dasharray="2 4" />
          <line x1="0" y1="90"  x2="400" y2="90"  stroke="#1A1E27" stroke-width="1" stroke-dasharray="2 4" />

          <path
            d="M0,110 C40,90 70,70 100,80 C130,90 160,40 200,45 C240,50 280,10 320,20 C350,25 380,5 400,15 L400,120 L0,120 Z"
            fill="url(#elevFill)"
          />
          <path
            d="M0,110 C40,90 70,70 100,80 C130,90 160,40 200,45 C240,50 280,10 320,20 C350,25 380,5 400,15"
            fill="none"
            stroke="url(#elevLine)"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>

        <div class="elev-axis mono">
          <span>1500 m</span>
          <span>2365 m</span>
        </div>

        <div class="elev-stats">
          <div>
            <strong class="mono">3.6<small> km</small></strong>
            <span>Lunghezza</span>
          </div>
          <div>
            <strong class="mono">+865<small> m</small></strong>
            <span>Dislivello</span>
          </div>
          <div>
            <strong>E</strong>
            <span>Difficoltà</span>
          </div>
        </div>
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

    <!-- Tracciato GPX -->
    <section class="section">
      <h3 class="section-title">Tracciato GPX</h3>
      <p class="dim">Scarica il tracciato per la navigazione offline o visualizzalo sulla mappa.</p>

      <div class="gpx-actions">
        <a href="/gpx/demo.gpx" download class="btn btn-primary btn-block">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Scarica GPX
        </a>

        <button class="btn btn-ghost btn-block" @click="emit('show-route', bivacco)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6" />
            <line x1="9" y1="3" x2="9" y2="18" />
            <line x1="15" y1="6" x2="15" y2="21" />
          </svg>
          Mostra sulla mappa
        </button>
      </div>
    </section>

    <!-- Recensioni -->
    <section class="section">
      <h3 class="section-title">Recensioni</h3>

      <form class="review-form" @submit.prevent="submitRecensione">
        <input
          v-model="recensioneForm.utente"
          class="input"
          placeholder="Nome utente"
        />

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

.section .dim {
  font-size: 13px;
  margin-bottom: 12px;
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

/* —— Elevation —— */
.elevation-svg {
  width: 100%;
  height: 140px;
  display: block;
  background: var(--bg-surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-md);
}

.elev-axis {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 6px;
}

.elev-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 14px;
}

.elev-stats div {
  background: var(--bg-surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-md);
  padding: 12px;
  text-align: center;
}

.elev-stats strong {
  display: block;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.02em;
  margin-bottom: 2px;
}
.elev-stats small {
  color: var(--text-tertiary);
  font-size: 0.75em;
  font-weight: 400;
}
.elev-stats span {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

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

/* —— GPX actions —— */
.gpx-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
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
</style>
