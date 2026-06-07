<script setup>

import {ref, onMounted} from 'vue'
import{
    getBivacchi,
    getCodaTicket,
    aggiornaStatoTicket,
    archiviaTicket,
    getSegnalazioniDaGestire,
    generaTicketDaSegnalazione,
    esportaCSV
} from '../services/api'

const codaTicket = ref([])
const codaSegnalazioni = ref([])
const loading = ref(false)
const message = ref('')
const messageType = ref('info')
const listaBivacchi = ref([])               // tutti i bivacchi
const alertAttivi = ref([])                 // alert con attivo = true
const caricamentoEmergenze = ref(false)
const mostraModaleNote = ref(false)
const ticketDaChiudere = ref(null)
const noteChiusura = ref('')
const saving = ref(false)

/**
 * @description Chiama API per aggiungere elementi nella coda ticket 
 */
async function caricaTicket() {
  try{
    codaTicket.value=await getCodaTicket()
  } catch(error) {
    console.error('Errore recupero ticket:', error)
  }
}

/**
 * @description Gestisce logica bottoni
 * di avanzamento di stato o di archiviazione
 * @param {String} id - ObjectId del ticket
 * @param {String} nuovoStato - 'in_lavorazione' o 'chiuso'
 */
async function avanzamentoTicket(id, nuovoStato) {
  if(nuovoStato === 'archivia'){
    console.warn('Usa archiviaTicketManuale per archiviare')
    return
  }

  try {
    loading.value=true
    message.value=''
    await aggiornaStatoTicket(id, nuovoStato)
    const idx = codaTicket.value.findIndex(t => t._id === id)             // trovo il ticket in coda locale e lo aggiorno
    if (idx !== -1){
      codaTicket.value[idx].stato = nuovoStato
    }
    
    message.value = 'Ticket ora in stato ${nuovoStato}'
    messageType.value = 'success'
  } catch (error) {
    console.error("Errore avanzamento ticket:", error)
    message.value=error.message || "Errore avanzamento ticket"
    messageType.value="danger"
  } finally {
    loading.value=false
  }
}

/**
 * @description Chiama API per popolare la coda delle segnalazioni
 */
async function caricaSegnalazioni() {
  try {
    codaSegnalazioni.value = await getSegnalazioniDaGestire();
  } catch (error) {
    console.error("Errore recupero segnalazioni:", error);
  }
}

/**
 * @description Crea un ticket e ricarica le schermate per far comparire 
 * il ticket nella coda inferiore
 * @param {string} segnalazioneId - ID segnalazione
 */
async function gestisciCreazioneTicket(segnalazioneId) {
    try {
        await generaTicketDaSegnalazione(segnalazioneId, 5);
        await caricaSegnalazioni(); 
        await caricaTicket();
    } catch (error) {
        alert(error.message);
    }
}



// LASCIARE COMMENTATA, SE CI SONO PROBLEMI LA DECOMMENTIAMO (TOLLO)
/**
 * @description funzione wrapper per intercettare eventuali errori durante l'esportazione dati
 *
async function gestisciEsportazione() {
  try {
    await esportaCSV();
  } catch (error) {
    alert(error.message);
  }
}
*/



/**
 * @description Gestisce l'evento del click automatico per 
 * l'esportazione del dataset CSV. Chiama l'API per l'esportazione 
 * e blocca temporaneamente l'UI intercettando gli eventuali errori.
 * @returns {Promise<void>}
 */
const handleEsportaCSV = async () => {
    loading.value = true;
    message.value = '';                                         // Resetta eventuali messaggi precedenti
    
    try {
        await esportaCSV();
        message.value = 'Dataset CSV esportato con successo!';
        messageType.value = 'success';                          
    } catch (error) {
        console.error("Fallimento durante l'esportazione del CSV:", error);
        message.value = error.message || 'Si è verificato un errore imprevisto durante il download.';
        messageType.value = 'danger';
    } finally {
        loading.value = false;
    }
};

/**
 * @description Carica l'elenco di tutti i bivacchi (serve alert emergenze)
 * @returns {Promise<void>}
 */
async function fetchBivacchiPerEmergenza() {
  try {
    const resp = await getBivacchi()   
    listaBivacchi.value = resp
  } catch (error) {
    console.error('Errore recupero bivacchi per emergenza:', error)
    listaBivacchi.value = []
  }
}

/**
 *@description Recupera tutti gli alert attivi 
 */
async function caricaAlertAttivi() {
  try {
    const token = localStorage.getItem('bivacs_token')
    const resp = await fetch(`${API_URL}/bivacchi/emergenze_attive`, {
      headers: {Authorization: `Bearer ${token}`}
    })
    if (!resp.ok) throw new Error('Fallito caricamento allerte')
    alertAttivi.value = await resp.json()
  } catch (error) {
    console.warn('Impossibile caricare allerte attive:', error)
    alertAttivi.value = []
  }
}

/**
 *@description Serve per scrivere le note prima di chiudere un ticket
 * @param {Object} ticket - Il ticket da chiudere
 */
function apriModaleNote(ticket) {
  ticketDaChiudere.value = ticket
  noteChiusura.value = ''
  mostraModaleNote.value = true
}

/**
 *@description Conferma la chiusura del ticket con le note inserite usando
 * aggiornaStatoTicket con il campo note
 */
async function confermaChiusuraConNote() {
  if (!ticketDaChiudere.value) return
  if (!noteChiusura.value || noteChiusura.value.trim() === '') {
    message.value = 'Inserisci una nota per la chiusura'
    messageType.value = 'danger'
    return
  }
  saving.value = true
  try {
    await aggiornaStatoTicket(ticketDaChiudere.value._id, 'chiuso', noteChiusura.value.trim())
    const idx = codaTicket.value.findIndex(t => t._id === ticketDaChiudere.value._id)                 // aggiorna locale
    if (idx !== -1) codaTicket.value[idx].stato = 'chiuso'
    message.value = 'Ticket chiuso con successo'
    messageType.value = 'success'
    mostraModaleNote.value = false
    ticketDaChiudere.value = null
  } catch (error) {
    console.error(error)
    message.value = error.message || 'Errore durante la chiusura'
    messageType.value = 'danger'
  } finally {
    saving.value = false
  }
}

/**
 *@description Archivia un ticket CHIUSO
 * @param {string} ticketId - ObjectId del ticket
 */
async function archiviaTicketManuale(ticketId) {
  if (!ticketId) return
  try {
    const res = await archiviaTicket(ticketId)  
    codaTicket.value = codaTicket.value.filter(t => t._id !== ticketId)
    message.value = `Ticket ${res.ticket?.id || ''} archiviato`
    messageType.value = 'success'
  } catch (error) {
    console.error(error)
    message.value = error.message || 'Archiviazione fallita'
    messageType.value = 'danger'
  }
}

/**
 *@description Attiva stato di emergenza per un bivacco
 * @param {Object} bivacco - Bivacco su cui attivare l'alert
 */
async function attivaEmergenzaBivacco(bivacco) {
  let messaggioEmergenza = prompt(`Inserisci il messaggio di emergenza per ${bivacco.nome || bivacco.id}:\n(max 140 caratteri)`, 'Pericolo valanga / struttura danneggiata')
  if (!messaggioEmergenza) return
  if (messaggioEmergenza.length > 140) messaggioEmergenza = messaggioEmergenza.slice(0,140)
  try {
    await attivaEmergenza(bivacco._id, messaggioEmergenza)
    alert(`✅ Emergenza attivata su ${bivacco.nome}`)
    await caricaAlertAttivi()                                                       // ricarica lista alert
    await fetchBivacchiPerEmergenza()                                               // per aggiornare eventuale flag locale
  } catch (error) {
    console.error('Errore attivazione', error)
    alert(`❌ Impossibile attivare: ${error.message}`)
  }
}

/**
 *@description Revoca un alert emergenza attivo
 * @param {string} bivaccoId - ID bivacco
 * @param {string} bivaccoNome - solo per messaggio
 */
async function revocaEmergenzaBivacco(bivaccoId, bivaccoNome) {
  if (!confirm(`Sei sicuro di revocare l'emergenza su ${bivaccoNome}? Il banner sparirà dalla mappa.`)) return
  try {
    await revocaEmergenza(bivaccoId)
    alert(`✅ Emergenza revocata per ${bivaccoNome}`)
    await caricaAlertAttivi()
    await fetchBivacchiPerEmergenza()
  } catch (error) {
    console.warn(error)
    alert(`❌ Revoca fallita: ${error.message}`)
  }
}

/**
 * @description ricarica ticket e segnalazioni 
 */
async function refreshData() {
    loading.value=true
    try{
        await caricaTicket()
        await caricaSegnalazioni()
    }finally{
        loading.value=false
    }
}

/**
 * @description Inizializza i dati nel pannello di supporto
 */
onMounted(async()=>{
    loading.value=true
    try {
        await caricaTicket()
        await caricaSegnalazioni()
        await fetchBivacchiPerEmergenza()
        await caricaAlertAttivi()
    } catch (error) {
        console.error("Errore caricamento dati Super User:", error)
        message.value = "Impossibile caricare pannello"
        messageType.value = 'danger'
    } finally {
        loading.value=false
    }
}) 


</script>

<template>
  <section class="support-panel">
    <header class="support-head">
      <div>
        <p class="label">Super User</p>
        <h3>Area amministrazione avanzata</h3>
      </div>
      <button class="btn btn-ghost" @click="refreshData">
        Aggiorna
      </button>
    </header>

    <p v-if="message" class="msg" :class="`msg-${messageType}`">
      {{ message }}
    </p>

    <p v-if="loading" class="loading-text">
      Caricamento dati Super User…
    </p>

    <div v-else class="support-layout">

      <!-- Segnalazioni in attesa di valutazione (con Genera Ticket) -->
      <div class="panel-section">
        <h3>Segnalazioni in attesa di Valutazione</h3>

        <div v-if="codaSegnalazioni.length === 0">
          <p>Nessuna segnalazione utente in coda.</p>
        </div>

        <div v-else class="config-list">
          <div v-for="seg in codaSegnalazioni" :key="seg._id" class="log-row">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong>Bivacco: {{ seg.bivaccoId?.nome || 'Dato Rimosso' }}</strong> - Stato: {{ seg.statoSegnalazione }}<br>
                <small>Autore: {{ seg.utenteId?.nome || 'Anonimo' }} | Difficoltà: {{ seg.descrizione }}</small>
              </div>

              <button
                v-if="seg.statoSegnalazione === 'inviata'"
                class="btn btn-primary"
                @click="gestisciCreazioneTicket(seg._id)"
              >
                Genera Ticket
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Coda Ticket Manutenzione -->
      <div class="panel-section">
        <h3>Coda Ticket Manutenzione</h3>

        <div v-if="codaTicket.length === 0">
          <p>Nessun ticket in coda.</p>
        </div>

        <div v-else class="config-list">
          <div v-for="ticket in codaTicket" :key="ticket._id" class="log-row">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong>Ticket #{{ ticket.id }}</strong> -
                <span :class="{'ok': ticket.stato === 'chiuso', 'ko': ticket.stato === 'aperto'}">
                  Stato: {{ ticket.stato.toUpperCase() }}
                </span>
                <br>
                <small>Priorità: {{ ticket.priorita }} | Aperto il: {{ new Date(ticket.dataApertura).toLocaleDateString() }}</small>
              </div>

              <div style="display: flex; gap: 8px;">
                <button
                  v-if="ticket.stato === 'aperto'"
                  class="btn btn-primary"
                  @click="avanzamentoTicket(ticket._id, 'in_lavorazione')"
                >
                  Prendi in carico
                </button>

                <button
                  v-if="ticket.stato === 'in_lavorazione'"
                  class="btn btn-primary"
                  @click="apriModaleNote(ticket)"
                >
                  Chiudi Ticket
                </button>

                <button
                  v-if="ticket.stato === 'chiuso'"
                  class="btn btn-warning"
                  @click="archiviaTicketManuale(ticket._id)"
                >
                  Archivia
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Esportazione CSV -->
      <div class="panel-section">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3>Esportazione dati</h3>
          <button @click="handleEsportaCSV" :disabled="loading">
            {{ loading ? 'Esportazione in corso...' : 'Esporta Dataset CSV' }}
          </button>
        </div>
      </div>

      <!-- GESTIONE EMERGENZE (solo SuperUser) -->
      <div class="panel-section">
        <h3>🚨 Gestione emergenze bivacchi</h3>
        <p style="font-size:13px; margin-bottom:12px;">Attiva o revoca un banner rosso su un bivacco. Visibile a tutti gli utenti in tempo reale.</p>

        <div v-if="caricamentoEmergenze" class="loading-text">Caricamento bivacchi...</div>
        <div v-else class="emergenze-list">
          <div v-for="biv in listaBivacchi" :key="biv._id" class="emergenza-row">
            <div>
              <strong>{{ biv.nome }}</strong>
              <small>{{ biv.zona }}</small>
            </div>
            <div>
              <template v-if="alertAttivi.some(a => a.bivacco?._id === biv._id || a.bivacco === biv._id)">
                <span class="badge-emergenza-attiva">⚠️ EMERGENZA ATTIVA</span>
                <button class="btn btn-sm btn-outline" @click="revocaEmergenzaBivacco(biv._id, biv.nome)">
                  Revoca
                </button>
              </template>
              <button v-else class="btn btn-sm btn-danger" @click="attivaEmergenzaBivacco(biv)">
                Attiva emergenza
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Modale note chiusura ticket -->
    <div v-if="mostraModaleNote" class="modal-overlay" @click.self="mostraModaleNote = false">
      <div class="modal-card">
        <h3>Chiudi ticket</h3>
        <p><strong>Ticket #{{ ticketDaChiudere?.id }}</strong> — inserisci una nota operativa</p>
        <textarea
          v-model="noteChiusura"
          rows="4"
          class="input"
          placeholder="Es: intervento effettuato, struttura riparata, contattato gestore..."
        ></textarea>
        <div style="display: flex; gap: 12px; margin-top: 18px; justify-content: flex-end;">
          <button class="btn btn-ghost" @click="mostraModaleNote = false">Annulla</button>
          <button class="btn btn-primary" @click="confermaChiusuraConNote" :disabled="staSalvando">
            {{ staSalvando ? 'Salvataggio...' : 'Conferma chiusura' }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.support-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.support-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
}

.support-head h3 {
  margin-top: 4px;
  font-size: 1.2rem;
}

.loading-text,
.empty {
  color: var(--text-tertiary);
  font-size: 13px;
}

.msg {
  padding: 12px 14px;
  border-radius: var(--r);
  font-size: 13px;
}

.msg-info {
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  color: var(--accent-hi);
}

.msg-success {
  background: var(--success-bg);
  border: 1px solid rgba(52,211,153,0.28);
  color: var(--success);
}

.msg-error,
.msg-danger {
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  color: var(--danger);
}

.support-layout {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.panel-section {
  background: var(--bg-surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-lg);
  padding: 20px;
}

.panel-section h3 {
  font-size: 1.15rem;
  margin-bottom: 16px;
}

.config-list,
.log-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 360px;
  overflow-y: auto;
}

.log-row {
  background: var(--bg-surface-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.log-row strong {
  font-size: 13px;
  color: var(--text-primary);
}

.log-row small {
  font-size: 11px;
  color: var(--text-tertiary);
  word-break: break-word;
}

.ok {
  color: var(--success);
  font-size: 11px;
  font-weight: 700;
}

.ko {
  color: var(--danger);
  font-size: 11px;
  font-weight: 700;
}

/* emergenze lista */
.emergenze-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 280px;
  overflow-y: auto;
  margin-top: 12px;
}

.emergenza-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-surface-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r);
  padding: 10px 12px;
}

.emergenza-row strong {
  display: block;
  font-size: 14px;
}

.emergenza-row small {
  font-size: 11px;
  color: var(--text-tertiary);
}

.badge-emergenza-attiva {
  background: var(--danger-bg);
  color: var(--danger);
  font-size: 11px;
  font-weight: bold;
  padding: 4px 8px;
  border-radius: 20px;
  margin-right: 12px;
}

.btn-sm {
  padding: 6px 14px;
  font-size: 12px;
}

.btn-outline {
  background: transparent;
  border: 1px solid var(--danger);
  color: var(--danger);
}

.btn-outline:hover {
  background: var(--danger-bg);
}

.btn-danger {
  background: var(--danger);
  border: none;
  color: white;
}

.btn-danger:hover {
  background: #dc2626;
}

/* Modale note */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-card {
  background: var(--bg-surface);
  border-radius: var(--r-lg);
  padding: 24px;
  width: 90%;
  max-width: 460px;
  box-shadow: var(--shadow-xl);
}

.modal-card h3 {
  margin-bottom: 12px;
}

.modal-card textarea {
  width: 100%;
  padding: 8px;
  border-radius: var(--r);
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface-2);
  color: var(--text-primary);
}

@media (max-width: 780px) {
  .support-layout {
    gap: 12px;
  }
  .emergenza-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>

