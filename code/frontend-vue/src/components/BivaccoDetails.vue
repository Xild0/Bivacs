<script setup>
/**
 * @file BivaccoDetails.vue
 * @description Visualizza il dettaglio di un bivacco, incluse recensioni,
 * risorse disponibili, emergenze, segnalazioni, storico staff e download GPX.
 */

import { reactive, ref, watch, computed } from 'vue'

import {
  attivaEmergenza,
  revocaEmergenza,
  createRecensione,
  getRecensioni,
  creaSegnalazione,
  getSegnalazioniBivacco,
  aggiornaRisorseBivacco,
  getAutoDownloadGpxUrl,
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

const risorseForm = reactive({
  acqua: 'disponibile',
  legna: 'disponibile'
})

const risorseOverride = ref(null)
const risorseMsg = ref('')
const risorseMsgType = ref('info')

const downloadLoading = ref(false)
const downloadMsg = ref('')
const downloadMsgType = ref('info')

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
 * Verifica se l'utente corrente ha ruolo SuperUser.
 *
 * @returns {boolean} True se l'utente è SuperUser.
 */
const isSuperUser = computed(() => {
  return props.currentUser?.discriminator === 'SuperUser'
})

/**
 * Verifica se l'utente corrente appartiene allo staff.
 *
 * @returns {boolean} True se l'utente è SuperUser o SupportoTecnico.
 */
const isStaff = computed(() => {
  if (!props.isLogged || !props.currentUser) return false

  const role = props.currentUser.discriminator
  return role === 'SuperUser' || role === 'SupportoTecnico'
})

/**
 * Restituisce il nome visualizzato dell'utente corrente.
 *
 * @returns {string} Nome completo dell'utente oppure valore predefinito.
 */
const nomeUtente = computed(() => {
  if (!props.currentUser) return 'Escursionista'

  return `${props.currentUser.nome || ''} ${props.currentUser.cognome || ''}`.trim() || 'Escursionista'
})

/**
 * Calcola la media delle recensioni del bivacco.
 *
 * @returns {number} Media delle stelle oppure 0 se non sono presenti recensioni.
 */
const mediaRecensioni = computed(() => {
  const mediaDaBivacco = Number(props.bivacco.mediaStelle)

  if (Number.isFinite(mediaDaBivacco) && mediaDaBivacco > 0) {
    return mediaDaBivacco
  }

  if (!recensioni.value.length) return 0

  const totale = recensioni.value.reduce((sum, r) => {
    return sum + Number(r.stelle || 0)
  }, 0)

  return totale / recensioni.value.length
})

/**
 * Calcola il numero totale di recensioni disponibili.
 *
 * @returns {number} Numero di recensioni del bivacco.
 */
const numeroRecensioni = computed(() => {
  return Number(props.bivacco.numRecensioni) || recensioni.value.length || 0
})

/**
 * Restituisce lo stato corrente delle risorse del bivacco.
 *
 * @returns {{ acqua: string, legna: string }} Stato corrente di acqua e legna.
 */
const risorseCorrenti = computed(() => {
  if (risorseOverride.value) {
    return risorseOverride.value
  }

  if (props.bivacco.risorse) {
    return {
      acqua: props.bivacco.risorse.acqua || statoDaBooleano(props.bivacco.acquaPresente),
      legna: props.bivacco.risorse.legna || statoDaBooleano(props.bivacco.legnaDisponibile)
    }
  }

  return {
    acqua: statoDaBooleano(props.bivacco.acquaPresente),
    legna: statoDaBooleano(props.bivacco.legnaDisponibile)
  }
})

/**
 * Converte un valore booleano nello stato testuale di una risorsa.
 *
 * @param {boolean} value - Valore booleano della risorsa.
 * @returns {string} Stato della risorsa.
 */
function statoDaBooleano(value) {
  return value ? 'disponibile' : 'assente'
}

/**
 * Restituisce l'etichetta leggibile di una risorsa.
 *
 * @param {string} stato - Stato tecnico della risorsa.
 * @returns {string} Etichetta visualizzata nell'interfaccia.
 */
function labelRisorsa(stato) {
  if (stato === 'disponibile') return 'Disponibile'
  if (stato === 'scarsa') return 'Scarsa'
  if (stato === 'assente') return 'Assente'
  if (stato === 'non_verificata') return 'Non verificata'
  return 'Non verificata'
}

/**
 * Restituisce la classe CSS associata allo stato di una risorsa.
 *
 * @param {string} stato - Stato della risorsa.
 * @returns {string} Classe CSS da applicare.
 */
function classeRisorsa(stato) {
  if (stato === 'disponibile') return 'res-ok'
  if (stato === 'scarsa') return 'res-warning'
  if (stato === 'assente') return 'res-ko'
  return 'res-unknown'
}

/**
 * Determina il nome da mostrare per una recensione.
 *
 * @param {Object} recensione - Recensione del bivacco.
 * @returns {string} Nome del recensore o valore anonimo/predefinito.
 */
function nomeRecensore(recensione) {
  if (recensione.anonima) return 'Anonimo'

  if (recensione.nomeVisualizzato) {
    return recensione.nomeVisualizzato
  }

  if (typeof recensione.utente === 'string') {
    return recensione.utente
  }

  if (recensione.utente?.nome || recensione.utente?.cognome) {
    return `${recensione.utente.nome || ''} ${recensione.utente.cognome || ''}`.trim()
  }

  if (recensione.utente?.email) {
    return recensione.utente.email
  }

  return 'Escursionista'
}

/**
 * Carica le recensioni associate al bivacco corrente.
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
 * Invia una nuova recensione per il bivacco corrente.
 *
 * @returns {Promise<void>}
 */
async function submitRecensione() {
  if (!props.isLogged) {
    message.value = 'Accedi per lasciare una recensione.'
    return
  }

  try {
    await createRecensione({
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
 * Aggiorna lo stato delle risorse disponibili del bivacco.
 *
 * @returns {Promise<void>}
 */
async function inviaRisorse() {
  risorseMsg.value = ''
  risorseMsgType.value = 'info'

  try {
    const data = await aggiornaRisorseBivacco(props.bivacco._id, {
      acqua: risorseForm.acqua,
      legna: risorseForm.legna
    })

    risorseOverride.value = {
      acqua: data.risorse?.acqua || risorseForm.acqua,
      legna: data.risorse?.legna || risorseForm.legna
    }

    risorseMsgType.value = 'success'
    risorseMsg.value = 'Stato risorse aggiornato'

    emit('bivacco-updated')
  } catch (e) {
    risorseMsgType.value = 'error'
    risorseMsg.value = e.message
  }
}

/**
 * Scarica il file GPX SAT associato al bivacco corrente.
 *
 * @returns {Promise<void>}
 */
async function scaricaGpx() {
  downloadMsg.value = ''
  downloadMsgType.value = 'info'

  const token = getToken()

  if (!token) {
    downloadMsgType.value = 'error'
    downloadMsg.value = 'Accedi per scaricare il GPX.'
    return
  }

  downloadLoading.value = true

  try {
    const response = await fetch(getAutoDownloadGpxUrl(props.bivacco._id), {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.message || 'Download GPX non disponibile per questo bivacco.')
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)

    const nomePulito = (props.bivacco.nome || 'bivacco')
      .replace(/[^a-zA-Z0-9_-]/g, '_')

    const a = document.createElement('a')
    a.href = url
    a.download = `${nomePulito}_SAT.gpx`
    a.click()

    URL.revokeObjectURL(url)

    downloadMsgType.value = 'success'
    downloadMsg.value = 'Download GPX avviato.'
  } catch (error) {
    downloadMsgType.value = 'error'
    downloadMsg.value = error.message
  } finally {
    downloadLoading.value = false
  }
}

/**
 * Attiva lo stato di emergenza per il bivacco corrente.
 *
 * @returns {Promise<void>}
 */
async function gestisciAttivazioneEmergenza() {
  const descr = prompt('Inserisci la descrizione o causa dell\'emergenza:')

  if (descr === null) return

  try {
    await attivaEmergenza(props.bivacco._id, descr || 'Allerta meteo o emergenza generica')
    props.bivacco.emergenza = true
    props.bivacco.noteEmergenza = descr
    emit('bivacco-updated')
    alert('Stato di emergenza attivato con successo')
  } catch (error) {
    console.error('Errore nell\'attivazione dell\'alert:', error)
    alert('Impossibile attivare lo stato di emergenza. Verificare la connessione o i permessi.')
  }
}

/**
 * Revoca lo stato di emergenza del bivacco corrente.
 *
 * @returns {Promise<void>}
 */
async function gestisciRevocaEmergenza() {
  if (!confirm('Sei sicuro di voler revocare lo stato di emergenza per questo bivacco?')) return

  try {
    await revocaEmergenza(props.bivacco._id)
    props.bivacco.emergenza = false
    emit('bivacco-updated')
    alert('Stato di emergenza revocato con successo')
  } catch (error) {
    console.error('Errore nella revoca dell\'alert:', error)
    alert('Impossibile revocare lo stato di emergenza. Verificare la connessione o i permessi.')
  }
}

/**
 * Salva il file selezionato per una segnalazione.
 *
 * @param {Event} e - Evento di cambio file dell'input.
 * @returns {void}
 */
function handleSegnalazioneFileChange(e) {
  const file = e.target.files[0]

  if (file) {
    segnalazioneFoto.value = file
  }
}

/**
 * Invia una segnalazione con descrizione e foto al team di supporto.
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
    const formData = new FormData()
    formData.append('bivaccoId', props.bivacco._id)
    formData.append('descrizione', segnalazioneDescrizione.value)
    formData.append('foto', segnalazioneFoto.value)

    await creaSegnalazione(formData)

    segnalazioneSuccesso.value = 'Segnalazione inviata con successo al team di supporto!'
    segnalazioneDescrizione.value = ''
    segnalazioneFoto.value = null

    const fileInput = document.getElementById('segnalazione-file-input')
    if (fileInput) fileInput.value = ''

    emit('bivacco-updated')
  } catch (err) {
    segnalazioneErrore.value = err.message
  } finally {
    segnalazioneLoading.value = false
  }
}

/**
 * Carica lo storico delle segnalazioni visibile allo staff.
 *
 * @returns {Promise<void>}
 */
async function loadStoricoSegnalazioni() {
  if (!isStaff.value) return

  storicoLoading.value = true

  try {
    storicoSegnalazioni.value = await getSegnalazioniBivacco(props.bivacco._id)
  } catch (error) {
    console.error('Errore nel caricamento dello storico segnalazioni:', error)
  } finally {
    storicoLoading.value = false
  }
}

/**
 * Formatta lo stato tecnico di una segnalazione.
 *
 * @param {string} stato - Stato della segnalazione.
 * @returns {string} Stato formattato.
 */
function formattaStato(stato) {
  if (!stato) return 'Inviata'
  return stato.replace(/_/g, ' ').toUpperCase()
}

/**
 * Propaga al componente padre il percorso calcolato.
 *
 * @param {Object} res - Risultato del calcolo del percorso.
 * @returns {void}
 */
function onRouteCalculated(res) {
  emit('route-calculated', res)
}

/**
 * Richiede al componente padre la rimozione del percorso dalla mappa.
 *
 * @returns {void}
 */
function onClearRoute() {
  emit('clear-route')
}

/**
 * Aggiorna dati locali e contenuti collegati quando cambia il bivacco selezionato.
 */
watch(
  () => props.bivacco,
  () => {
    risorseOverride.value = null
    risorseMsg.value = ''
    downloadMsg.value = ''

    risorseForm.acqua = risorseCorrenti.value.acqua
    risorseForm.legna = risorseCorrenti.value.legna

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

    <div v-if="bivacco.emergenza" class="emergency-banner-active">
  <span class="emergency-icon">⚠️</span>

  <div class="emergency-content">
    <h3>STATO DI EMERGENZA ATTIVO</h3>

    <p v-if="bivacco.noteEmergenza">
      {{ bivacco.noteEmergenza }}
    </p>

    <p v-else>
      Questo bivacco è attualmente in stato di emergenza.
    </p>
  </div>
</div>

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

        <small>
          Sono stati segnalati problemi su questo bivacco da altri escursionisti.
        </small>
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
        <span class="fact-label">Media recensioni</span>
        <strong class="mono">
          {{ mediaRecensioni ? mediaRecensioni.toFixed(1) : '0.0' }}<small>/5</small>
        </strong>
        <p class="fact-sub">
          {{ numeroRecensioni }} {{ numeroRecensioni === 1 ? 'recensione' : 'recensioni' }}
        </p>
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

          <span :class="classeRisorsa(risorseCorrenti.acqua)">
            {{ labelRisorsa(risorseCorrenti.acqua) }}
          </span>
        </div>

        <div class="resource-row">
          <span>Legna</span>

          <span :class="classeRisorsa(risorseCorrenti.legna)">
            {{ labelRisorsa(risorseCorrenti.legna) }}
          </span>
        </div>
      </div>

      <div v-if="isLogged" class="risorse-form">
        <select v-model="risorseForm.acqua" class="select">
          <option value="disponibile">Acqua: disponibile</option>
          <option value="scarsa">Acqua: scarsa</option>
          <option value="assente">Acqua: assente</option>
        </select>

        <select v-model="risorseForm.legna" class="select">
          <option value="disponibile">Legna: disponibile</option>
          <option value="scarsa">Legna: scarsa</option>
          <option value="assente">Legna: assente</option>
        </select>

        <button class="btn btn-ghost btn-block" type="button" @click="inviaRisorse">
          Aggiorna risorse
        </button>

        <p v-if="risorseMsg" class="inline-msg" :class="`inline-${risorseMsgType}`">
          {{ risorseMsg }}
        </p>
      </div>
    </section>

    <section class="section">
      <h3 class="section-title">Download GPX</h3>

      <p class="dim download-note">
        Scarica il tracciato GPX SAT più vicino al bivacco per consultarlo offline.
      </p>

      <button
        v-if="isLogged"
        class="btn btn-primary btn-block"
        type="button"
        :disabled="downloadLoading"
        @click="scaricaGpx"
      >
        {{ downloadLoading ? 'Download in corso…' : 'Scarica GPX' }}
      </button>

      <div v-else class="login-hint">
        Accedi per scaricare il file GPX.
      </div>

      <p v-if="downloadMsg" class="inline-msg" :class="`inline-${downloadMsgType}`">
        {{ downloadMsg }}
      </p>
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
        <div class="cai-row">
          <span class="cai-code">T</span>
          <span>Turistico</span>
        </div>

        <div class="cai-row">
          <span class="cai-code">E</span>
          <span>Escursionistico</span>
        </div>

        <div class="cai-row">
          <span class="cai-code">EE</span>
          <span>Escursionisti esperti</span>
        </div>

        <div class="cai-row">
          <span class="cai-code">EEA</span>
          <span>Attrezzatura richiesta</span>
        </div>
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
          class="toggle-form-btn"
          @click="mostrandoFormSegnalazione = !mostrandoFormSegnalazione"
        >
          <span>
            {{ mostrandoFormSegnalazione ? 'Chiudi modulo' : 'Invia una segnalazione per questo bivacco' }}
          </span>

          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            :style="{ transform: mostrandoFormSegnalazione ? 'rotate(180deg)' : 'none' }"
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>

        <div v-if="mostrandoFormSegnalazione" class="segnalazione-box">
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

              <div class="char-counter">
                Caratteri: {{ segnalazioneDescrizione.trim().length }}/20
              </div>
            </div>

            <div class="file-box">
              <span>Foto prova del danno (obbligatoria)</span>

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
              {{ segnalazioneLoading ? 'Invio in corso…' : 'Invia segnalazione' }}
            </button>
          </form>
        </div>
      </div>
    </section>

    <div v-if="isSuperUser" class="superuser-actions">
      <h4>Pannello stato emergenze</h4>

      <button
        v-if="!bivacco.emergenza"
        type="button"
        class="btn-emergency-trigger"
        @click="gestisciAttivazioneEmergenza"
      >
        Attiva allerta emergenza
      </button>

      <button
        v-else
        type="button"
        class="btn-emergency-revoke"
        @click="gestisciRevocaEmergenza"
      >
        Revoca allerta emergenza
      </button>
    </div>

    <section v-if="isStaff" class="section">
      <button
        type="button"
        class="toggle-form-btn"
        @click="mostrandoStoricoStaff = !mostrandoStoricoStaff"
      >
        <span>Storico segnalazioni staff</span>
        <span>{{ mostrandoStoricoStaff ? '−' : '+' }}</span>
      </button>

      <div v-if="mostrandoStoricoStaff" class="staff-history">
        <p v-if="storicoLoading" class="dim">
          Caricamento storico…
        </p>

        <p v-else-if="!storicoSegnalazioni.length" class="empty">
          Nessuna segnalazione per questo bivacco.
        </p>

        <div
          v-for="s in storicoSegnalazioni"
          :key="s._id"
          class="review"
        >
          <div class="review-head">
            <strong>{{ formattaStato(s.statoSegnalazione) }}</strong>
          </div>

          <p>{{ s.descrizione }}</p>
        </div>
      </div>
    </section>

    <section class="section">
      <h3 class="section-title">
        Recensioni (<span class="mono">{{ recensioni.length }}</span>)
      </h3>

      <p class="rating-summary">
        Valutazione media:
        <strong>{{ mediaRecensioni ? mediaRecensioni.toFixed(1) : '0.0' }}/5</strong>
        su {{ numeroRecensioni }} {{ numeroRecensioni === 1 ? 'recensione' : 'recensioni' }}.
      </p>

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
            <strong>{{ nomeRecensore(recensione) }}</strong>

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

.fact-sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-tertiary);
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
  font-weight: 700;
}

.res-warning {
  color: var(--warning);
  font-weight: 700;
}

.res-ko {
  color: var(--danger);
  font-weight: 700;
}

.res-unknown {
  color: var(--text-tertiary);
  font-weight: 600;
}

.risorse-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.inline-msg {
  font-size: 13px;
  margin-top: 4px;
}

.inline-success {
  color: var(--success);
}

.inline-error {
  color: var(--danger);
}

.inline-info {
  color: var(--text-tertiary);
}

.download-note {
  font-size: 13px;
  margin-bottom: 12px;
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

.review-author {
  font-size: 13px;
  color: var(--text-tertiary);
}

.review-author strong {
  color: var(--text-primary);
}

.rating-summary {
  background: var(--bg-surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r);
  padding: 12px 14px;
  font-size: 13px;
  margin-bottom: 14px;
  color: var(--text-secondary);
}

.rating-summary strong {
  color: var(--accent-hi);
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

.emergency-banner-active {
  display: flex;
  align-items: center;
  gap: 16px;
  background-color: rgba(239, 68, 68, 0.12);
  border: 2px solid #ef4444;
  border-radius: var(--r);
  padding: 16px;
  margin-bottom: 20px;
  color: #b91c1c;
}

.emergency-icon {
  font-size: 26px;
}

.emergency-content h3 {
  margin: 0 0 4px 0;
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 0.05em;
}

.emergency-content p {
  margin: 0;
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.4;
}

.superuser-actions {
  margin-top: 24px;
  padding: 16px;
  background: var(--bg-surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r);
}

.superuser-actions h4 {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.btn-emergency-trigger {
  background-color: #ef4444;
  color: white;
  border: none;
  padding: 10px 16px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.btn-emergency-trigger:hover {
  background-color: #dc2626;
}

.btn-emergency-revoke {
  background-color: #10b981;
  color: white;
  border: none;
  padding: 10px 16px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.btn-emergency-revoke:hover {
  background-color: #059669;
}

.toggle-form-btn {
  width: 100%;
  background: var(--bg-surface-2);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  text-align: left;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  margin-bottom: 12px;
  border-radius: var(--r);
}

.toggle-form-btn svg {
  transition: transform 0.2s;
}

.segnalazione-box {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.char-counter {
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
  display: flex;
  flex-direction: column;
  gap: 10px;
}

@media (max-width: 480px) {
  .facts {
    grid-template-columns: 1fr;
  }

  .cai-grid {
    grid-template-columns: 1fr;
  }

  .emergency-grid {
    grid-template-columns: 1fr;
  }

  .emergency-wide {
    grid-column: auto;
  }
}
</style>