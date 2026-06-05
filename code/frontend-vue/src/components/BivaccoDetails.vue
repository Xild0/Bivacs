<!--
  @file BivaccoDetails.vue
  @description Scheda dettagliata del bivacco.
  Mostra dati tecnici, risorse, meteo, pianificazione tragitto,
  contatti di emergenza, legenda CAI, segnalazioni e recensioni.
-->

<script setup>
import { reactive, ref, watch, computed } from 'vue'

import {
  creaRecensione,
  getRecensioni,
  getToken
} from '../services/api'

import TripPlanner from './TripPlanner.vue'
import MeteoPanel from './MeteoPanel.vue'

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

const recensioneForm = reactive({
  stelle: 5,
  testo: '',
  anonima: false
})

const mostrandoFormSegnalazione = ref(false)
const segnalazioneDescrizione = ref('')
const segnalazioneFoto = ref(null)
const segnalazioneLoading = ref(false)
const segnalazioneErrore = ref('')
const segnalazioneSuccesso = ref('')

const mostrandoStoricoStaff = ref(false)
const storicoSegnalazioni = ref([])
const storicoLoading = ref(false)

/**
 * Restituisce il nome da mostrare come autore della recensione.
 *
 * @returns {string} Nome utente oppure fallback generico.
 */
const nomeUtente = computed(() => {
  if (!props.currentUser) return 'Escursionista'

  return `${props.currentUser.nome || ''} ${props.currentUser.cognome || ''}`.trim() || 'Escursionista'
})

/**
 * Verifica se l'utente corrente appartiene allo staff.
 *
 * @returns {boolean} True per SuperUser o SupportoTecnico.
 */
const isStaff = computed(() => {
  if (!props.isLogged || !props.currentUser) return false

  const role = props.currentUser.discriminator
  return role === 'SuperUser' || role === 'SupportoTecnico'
})

/**
 * Recupera le recensioni associate al bivacco corrente.
 *
 * @returns {Promise<void>}
 */
async function loadRecensioni() {
  try {
    recensioni.value = await getRecensioni(props.bivacco._id)
  } catch (error) {
    console.error('Errore caricamento recensioni:', error)
  }
}

/**
 * Invia una nuova recensione al backend.
 *
 * @returns {Promise<void>}
 */
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

/**
 * Salva localmente il file immagine selezionato per la segnalazione.
 *
 * @param {Event} event - Evento change dell'input file.
 * @returns {void}
 */
function handleSegnalazioneFileChange(event) {
  const file = event.target.files?.[0]

  if (file) {
    segnalazioneFoto.value = file
  }
}

/**
 * Invia una segnalazione multipart/form-data al backend.
 *
 * @returns {Promise<void>}
 */
async function inviaSegnalazione() {
  segnalazioneErrore.value = ''
  segnalazioneSuccesso.value = ''

  if (segnalazioneDescrizione.value.trim().length < 20) {
    segnalazioneErrore.value = 'La descrizione deve avere almeno 20 caratteri per essere specifica.'
    return
  }

  if (!segnalazioneFoto.value) {
    segnalazioneErrore.value = 'La foto della segnalazione è obbligatoria.'
    return
  }

  segnalazioneLoading.value = true

  try {
    const token = getToken()

    if (!token) {
      throw new Error('Devi effettuare il login per inviare una segnalazione.')
    }

    const formData = new FormData()
    formData.append('bivaccoId', props.bivacco._id)
    formData.append('descrizione', segnalazioneDescrizione.value)
    formData.append('foto', segnalazioneFoto.value)

    const response = await fetch('http://localhost:5000/api/v1/segnalazioni', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    })

    const text = await response.text()
    const data = text ? JSON.parse(text) : {}

    if (!response.ok) {
      throw new Error(data.errore || data.message || 'Impossibile inviare la segnalazione.')
    }

    segnalazioneSuccesso.value = 'Segnalazione inviata con successo al team di supporto!'
    segnalazioneDescrizione.value = ''
    segnalazioneFoto.value = null

    const fileInput = document.getElementById('segnalazione-file-input')
    if (fileInput) fileInput.value = ''

    emit('bivacco-updated')
  } catch (error) {
    segnalazioneErrore.value = error.message
  } finally {
    segnalazioneLoading.value = false
  }
}

/**
 * Recupera le segnalazioni relative al bivacco corrente.
 * La sezione è riservata a SuperUser e SupportoTecnico.
 *
 * @returns {Promise<void>}
 */
async function loadStoricoSegnalazioni() {
  if (!isStaff.value) return

  storicoLoading.value = true

  try {
    const token = getToken()

    const response = await fetch(
      `http://localhost:5000/api/v1/segnalazioni/bivacco/${props.bivacco._id}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    )

    if (!response.ok) {
      storicoSegnalazioni.value = []
      return
    }

    storicoSegnalazioni.value = await response.json()
  } catch (error) {
    console.error('Errore caricamento storico segnalazioni:', error)
    storicoSegnalazioni.value = []
  } finally {
    storicoLoading.value = false
  }
}

/**
 * Formatta lo stato di una segnalazione in forma leggibile.
 *
 * @param {string} stato - Stato tecnico della segnalazione.
 * @returns {string} Stato formattato.
 */
function formattaStato(stato) {
  if (!stato) return 'INVIATA'

  return stato.replace(/_/g, ' ').toUpperCase()
}

/**
 * Propaga il percorso calcolato al componente padre.
 *
 * @param {Object} routeResult - Risultato del calcolo percorso.
 * @returns {void}
 */
function onRouteCalculated(routeResult) {
  emit('route-calculated', routeResult)
}

/**
 * Propaga la richiesta di cancellazione percorso al componente padre.
 *
 * @returns {void}
 */
function onClearRoute() {
  emit('clear-route')
}

watch(
  () => props.bivacco._id,
  () => {
    loadRecensioni()

    if (isStaff.value) {
      loadStoricoSegnalazioni()
    }

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

    <p v-if="message" class="toast">
      {{ message }}
    </p>

    <div v-if="bivacco.ticketAperti" class="ticket-banner">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>

      <div class="ticket-banner-text">
        <strong>
          {{ bivacco.numeroTicketAperti || 0 }}
          ticket {{ (bivacco.numeroTicketAperti || 0) === 1 ? 'aperto' : 'aperti' }}
        </strong>
        <small>Sono stati segnalati problemi su questo bivacco da altri escursionisti</small>
      </div>
    </div>

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

      <div class="fact">
        <span class="fact-label">Tipo</span>
        <strong>
          <span class="status-pill status-ok">
            {{ bivacco.tipoStruttura || 'fisso' }}
          </span>
        </strong>
      </div>
    </div>

    <section class="section">
      <MeteoPanel :bivacco="bivacco" />
    </section>

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

    <section class="section">
      <TripPlanner
        :bivacco="bivacco"
        @route-calculated="onRouteCalculated"
        @clear-route="onClearRoute"
      />
    </section>

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

    <section class="section">
      <h3 class="section-title">Legenda CAI</h3>

      <div class="cai-grid">
        <div class="cai-row"><span class="cai-code">T</span><span>Turistico</span></div>
        <div class="cai-row"><span class="cai-code">E</span><span>Escursionistico</span></div>
        <div class="cai-row"><span class="cai-code">EE</span><span>Escursionisti esperti</span></div>
        <div class="cai-row"><span class="cai-code">EEA</span><span>Attrezzatura richiesta</span></div>
      </div>
    </section>

    <section v-if="isStaff" class="section">
      <h3 class="section-title">Storico segnalazioni staff</h3>

      <button
        type="button"
        class="btn btn-ghost btn-block"
        @click="mostrandoStoricoStaff = !mostrandoStoricoStaff"
      >
        {{ mostrandoStoricoStaff ? 'Nascondi storico' : 'Mostra storico segnalazioni' }}
      </button>

      <div v-if="mostrandoStoricoStaff" class="staff-history">
        <p v-if="storicoLoading" class="empty">
          Caricamento segnalazioni…
        </p>

        <div
          v-for="segnalazione in storicoSegnalazioni"
          v-else
          :key="segnalazione._id"
          class="staff-report"
        >
          <strong>{{ formattaStato(segnalazione.statoSegnalazione) }}</strong>
          <p>{{ segnalazione.descrizione }}</p>
          <small>{{ segnalazione.utenteId?.email || 'Utente non disponibile' }}</small>
        </div>

        <p v-if="!storicoLoading && storicoSegnalazioni.length === 0" class="empty">
          Nessuna segnalazione per questo bivacco.
        </p>
      </div>
    </section>

    <section class="section">
      <h3 class="section-title">Segnala un problema o un guasto</h3>

      <div v-if="!isLogged" class="login-hint">
        Accedi per poter inviare una segnalazione sullo stato di questo bivacco.
      </div>

      <div v-else>
        <button
          type="button"
          class="btn btn-ghost btn-block report-toggle"
          @click="mostrandoFormSegnalazione = !mostrandoFormSegnalazione"
        >
          <span>
            {{ mostrandoFormSegnalazione ? 'Chiudi modulo' : 'Invia una segnalazione per questo bivacco' }}
          </span>
          <span>{{ mostrandoFormSegnalazione ? '▲' : '▼' }}</span>
        </button>

        <div v-if="mostrandoFormSegnalazione" class="report-form-wrap">
          <p v-if="segnalazioneErrore" class="toast toast-error">
            {{ segnalazioneErrore }}
          </p>

          <p v-if="segnalazioneSuccesso" class="toast toast-success">
            {{ segnalazioneSuccesso }}
          </p>

          <form class="review-form" @submit.prevent="inviaSegnalazione">
            <div>
              <textarea
                v-model="segnalazioneDescrizione"
                class="textarea"
                placeholder="Descrivi dettagliatamente il problema. Minimo 20 caratteri."
                required
              />

              <div class="counter">
                Caratteri: {{ segnalazioneDescrizione.trim().length }}/20
              </div>
            </div>

            <div class="file-box">
              <span>Foto prova del danno obbligatoria *</span>

              <input
                id="segnalazione-file-input"
                type="file"
                accept="image/*"
                required
                @change="handleSegnalazioneFileChange"
              />
            </div>

            <button
              type="submit"
              :disabled="segnalazioneLoading"
              class="btn btn-primary btn-block"
            >
              {{ segnalazioneLoading ? 'Invio in corso...' : 'Invia segnalazione' }}
            </button>
          </form>
        </div>
      </div>
    </section>

    <section class="section">
      <h3 class="section-title">
        Recensioni <span class="mono">({{ recensioni.length }})</span>
      </h3>
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
              <span
                v-for="n in 5"
                :key="n"
                :class="{ filled: n <= recensione.stelle }"
              >
                ★
              </span>
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

.toast-error {
  background: var(--danger-bg);
  border-color: var(--danger-border);
  color: var(--danger);
}

.toast-success {
  background: var(--success-bg);
  border-color: rgba(52, 211, 153, 0.28);
  color: var(--success);
}

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

.status-ok {
  background: var(--success-bg);
  color: var(--success);
}

.status-danger {
  background: var(--danger-bg);
  color: var(--danger);
  animation: pulseGlow 2s infinite;
}

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

.res-ok {
  color: var(--success);
  font-weight: 600;
}

.res-ko {
  color: var(--text-tertiary);
}

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

.stars .filled {
  color: #FBBF24;
}

.empty {
  text-align: center;
  color: var(--text-tertiary);
  font-size: 13px;
  padding: 20px;
  background: var(--bg-surface-2);
  border-radius: var(--r-md);
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

.ticket-banner {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  background: var(--warning-bg);
  border: 1px solid rgba(251, 191, 36, 0.28);
  border-radius: var(--r);
  margin-bottom: 18px;
  color: var(--warning);
}

.ticket-banner-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ticket-banner strong {
  color: var(--warning);
  font-size: 13px;
  font-weight: 700;
}

.ticket-banner small {
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.4;
}

.report-toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.report-form-wrap {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.counter {
  font-size: 11px;
  text-align: right;
  color: var(--text-tertiary);
  margin-top: 4px;
}

.file-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--bg-surface-2);
  padding: 12px;
  border-radius: var(--r);
  border: 1px solid var(--border-subtle);
}

.file-box span {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.file-box input {
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
}

.staff-history {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.staff-report {
  padding: 12px;
  background: var(--bg-surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r);
}

.staff-report strong {
  color: var(--warning);
  font-size: 12px;
}

.staff-report p {
  font-size: 13px;
  margin: 4px 0;
}

.staff-report small {
  color: var(--text-tertiary);
}

@media (max-width: 480px) {
  .facts,
  .cai-grid,
  .emergency-grid {
    grid-template-columns: 1fr;
  }

  .emergency-wide {
    grid-column: auto;
  }
}
</style>