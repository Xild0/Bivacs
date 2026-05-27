/**
 * @file BivaccoDetails.vue
 * @description Visualizza informazioni dettagliate di un bivacco,
 * recensioni, risorse disponibili e pianificazione tragitto.
 */

<script setup>
import { reactive, ref, watch, computed } from 'vue'

import {
  creaRecensione,
  getRecensioni
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
const nomeUtente = computed(() => {
  if (!props.currentUser) return 'Escursionista'

  return `${props.currentUser.nome || ''} ${props.currentUser.cognome || ''}`.trim() || 'Escursionista'
})

const recensioneForm = reactive({
  stelle: 5,
  testo: '',
  anonima: false
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
    console.error(error)
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

// —— STATO PER LA GESTIONE DELLA SEGNALAZIONE ——
const mostrandoFormSegnalazione = ref(false)
const segnalazioneDescrizione = ref('')
const segnalazioneFoto = ref(null)
const segnalazioneLoading = ref(false)
const segnalazioneErrore = ref('')
const segnalazioneSuccesso = ref('')

/**
 * Gestisce la selezione del file immagine per la segnalazione
 */
const handleSegnalazioneFileChange = (e) => {
  const file = e.target.files[0]
  if (file) {
    segnalazioneFoto.value = file
  }
}

/**
 * Esegue la chiamata multipart/form-data al backend
 */
const inviaSegnalazione = async () => {
  segnalazioneErrore.value = ''
  segnalazioneSuccesso.value = ''

  // Validazione locale (coerente con i vincoli del modello Mongoose)
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
    // Recupera il token JWT salvato durante l'autenticazione
    const token = localStorage.getItem('token')
    if (!token) {
      throw new Error('Devi effettuare il login per inviare una segnalazione.')
    }

    const formData = new FormData()
    formData.append('bivaccoId', props.bivacco._id) // Utilizza la prop esistente del bivacco
    formData.append('descrizione', segnalazioneDescrizione.value)
    formData.append('foto', segnalazioneFoto.value)

    const response = await fetch('/api/v1/segnalazioni', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
        // Nota: Nessun Content-Type manuale, ci pensa il browser con FormData
      },
      body: formData
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.errore || "Impossibile inviare la segnalazione.")
    }

    // Successo: reset dei campi del modulo
    segnalazioneSuccesso.value = 'Segnalazione inviata con successo al team di supporto!'
    segnalazioneDescrizione.value = ''
    segnalazioneFoto.value = null
    
    // Svuota l'input file nel DOM
    const fileInput = document.getElementById('segnalazione-file-input')
    if (fileInput) fileInput.value = ''

    // Sfrutta l'emit già dichiarato nel tuo file per notificare che il bivacco ha subito modifiche/aggiornamenti
    emit('bivacco-updated')

  } catch (err) {
    segnalazioneErrore.value = err.message
    } finally {
    segnalazioneLoading.value = false
    }
}

/**
 * Storico Segnalazioni per SuperUser e Supporto Tecnico
 */

const mostrandoStoricoStaff = ref(false)
const storicoSegnalazioni = ref([])
const storicoLoading = ref(false)

/**
 * Computed property per verificare se l'utente corrente fa parte dello staff
 */
const isStaff = computed(() => {
  if (!props.isLogged || !props.currentUser) return false
  const role = props.currentUser.discriminator
  return role === 'SuperUser' || role === 'SupportoTecnico'
})

/**
 * Recupera le segnalazioni del bivacco corrente (endpoint protetto)
 */
const loadStoricoSegnalazioni = async () => {
  if (!isStaff.value) return
  storicoLoading.value = true
  try {
    const token = localStorage.getItem('token')
    const response = await fetch(`/api/v1/segnalazioni/bivacco/${props.bivacco._id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    if (response.ok) {
      storicoSegnalazioni.value = await response.json()
    }
  } catch (error) {
    console.error("Errore nel caricamento dello storico segnalazioni:", error)
  } finally {
    storicoLoading.value = false
  }
}

/**
 * Formatta la stringa dello stato rendendola leggibile
 */
const formattaStato = (stato) => {
  if (!stato) return 'Inviata'
  return stato.replace(/_/g, ' ').toUpperCase()
}

/**
 * Propaga il percorso calcolato al componente padre.
 *
 * @param {Object} res - Risultato percorso.
 * @returns {void}
 */

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
    //Carico storico segnalazioni se utente è parte dello Staff
    if (isStaff.value) {
      loadStoricoSegnalazioni()
    }
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

    <!-- Banner ticket aperti: visibile se ci sono segnalazioni attive sul bivacco (US24, RF18, RF36) -->
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

      <div class="fact">
        <span class="fact-label">Tipo</span>
        <strong>
          <span class="status-pill status-ok">
            {{ bivacco.tipoStruttura || 'fisso' }}
          </span>
        </strong>
      </div>
    </div>

    <!-- Meteo (US17, US19) -->
    <section class="section">
      <MeteoPanel :bivacco="bivacco" />
    </section>

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

    <!-- Segnalazione problemi -->
    <section class="section">
      <h3 class="section-title">Segnala un problema o un guasto</h3>
      
      <div v-if="!isLogged" class="login-hint">
        Accedi per poter inviare una segnalazione sullo stato di questo bivacco.
      </div>

      <div v-else>
        <button 
          type="button" 
          @click="mostrandoFormSegnalazione = !mostrandoFormSegnalazione" 
          class="btn btn-block"
          style="background: var(--bg-surface-2); border: 1px solid var(--border-subtle); color: var(--text-secondary); text-align: left; display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; margin-bottom: 12px;"
        >
          <span>{{ mostrandoFormSegnalazione ? 'Chiudi modulo' : 'Invia una segnalazione per questo bivacco' }}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :style="{ transform: mostrandoFormSegnalazione ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>

        <div v-if="mostrandoFormSegnalazione" style="margin-top: 14px; display: flex; flex-direction: column; gap: 14px;">
          
          <p v-if="segnalazioneErrore" class="toast" style="background: var(--danger-bg); border-color: var(--danger-border); color: var(--danger); margin-bottom: 0;">
            {{ segnalazioneErrore }}
          </p>
          <p v-if="segnalazioneSuccesso" class="toast" style="background: var(--success-bg); border-color: var(--success-border); color: var(--success); margin-bottom: 0;">
            {{ segnalazioneSuccesso }}
          </p>

          <form class="review-form" @submit.prevent="inviaSegnalazione">
            <div>
              <textarea
                v-model="segnalazioneDescrizione"
                class="textarea"
                placeholder="Descrivi dettagliatamente il problema (es: infiltrazioni dal tetto, finestra rotta, rifiuti accumulati...). Minimo 20 caratteri."
                required
              />
              <div style="font-size: 11px; text-align: right; color: var(--text-tertiary); margin-top: 4px;">
                Caratteri: {{ segnalazioneDescrizione.trim().length }}/20
              </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 6px; background: var(--bg-surface-2); padding: 12px; border-radius: var(--r); border: 1px solid var(--border-subtle);">
              <span style="font-size: 13px; color: var(--text-secondary); font-weight: 500;">Foto prova del danno (Obbligatoria) *</span>
              <input 
                id="segnalazione-file-input"
                type="file" 
                accept="image/*" 
                @change="handleSegnalazioneFileChange"
                style="font-size: 13px; color: var(--text-primary); cursor: pointer;"
                required
              />
            </div>

            <button type="submit" :disabled="segnalazioneLoading" class="btn btn-primary btn-block" style="margin-top: 6px;">
              {{ segnalazioneLoading ? 'Invio in corso...' : 'Invia Segnalazione' }}
            </button>
          </form>
        </div>
      </div>
    </section>

    <!-- Recensioni -->
    <section class="section">
      <h3 class="section-title">Recensioni ({{ recensioni.length }})</h3>

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
</style>