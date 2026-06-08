<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  getStoricoSegnalazioni,
  getTicket,
  apriTicket,
  aggiornaStatoTicket,
  chiudiTicket,
  archiviaTicket,
  getBivacchi,
  attivaEmergenza,
  revocaEmergenza
} from '../services/api'

const segnalazioni = ref([])
const ticket = ref([])
const bivacchi = ref([])
const loading = ref(false)
const message = ref('')
const messageType = ref('info')
const noteChiusura = ref({})
const alertForm = ref({ bivaccoId: '', messaggio: '' })

function ticketDiSegnalazione(segnalazioneId) {
  return ticket.value.find(t => {
    const segId = t.segnalazione?._id || t.segnalazione
    return segId === segnalazioneId
  })
}

const codaTicketAperti = computed(() =>
  ticket.value.filter(t => t.stato === 'aperto' || t.stato === 'in_lavorazione')
)

async function loadData() {
  loading.value = true
  message.value = ''
  try {
    segnalazioni.value = await getStoricoSegnalazioni()
    ticket.value = await getTicket()
    bivacchi.value = await getBivacchi()
  } catch (error) {
    messageType.value = 'error'
    message.value = error.message
  } finally {
    loading.value = false
  }
}

function mostraOk(msg) {
  messageType.value = 'success'
  message.value = msg
}
function mostraErrore(error) {
  messageType.value = 'error'
  message.value = error.message || 'Errore'
}

async function handleApri(segnalazioneId) {
  try {
    await apriTicket(segnalazioneId)
    mostraOk('Ticket aperto: segnalazione presa in carico')
    await loadData()
  } catch (error) { mostraErrore(error) }
}

async function handleAvanza(ticketId) {
  try {
    await aggiornaStatoTicket(ticketId, 'in_lavorazione')
    mostraOk('Ticket in lavorazione')
    await loadData()
  } catch (error) { mostraErrore(error) }
}

async function handleChiudi(ticketId) {
  const note = noteChiusura.value[ticketId]
  if (!note || note.trim().length === 0) {
    mostraErrore({ message: 'Inserisci le note di intervento prima di chiudere' })
    return
  }
  try {
    await chiudiTicket(ticketId, note)
    noteChiusura.value[ticketId] = ''
    mostraOk('Ticket chiuso con note di intervento')
    await loadData()
  } catch (error) { mostraErrore(error) }
}

async function handleArchivia(ticketId) {
  try {
    await archiviaTicket(ticketId)
    mostraOk('Ticket archiviato nello storico')
    await loadData()
  } catch (error) { mostraErrore(error) }
}

async function handleAttivaEmergenza() {
  if (!alertForm.value.bivaccoId || !alertForm.value.messaggio.trim()) {
    mostraErrore({ message: 'Seleziona un bivacco e scrivi un messaggio' })
    return
  }
  try {
    await attivaEmergenza(alertForm.value.bivaccoId, alertForm.value.messaggio)
    mostraOk('Emergenza attivata: banner rosso visibile a tutti')
    alertForm.value = { bivaccoId: '', messaggio: '' }
    await loadData()
  } catch (error) { mostraErrore(error) }
}

async function handleRevoca(bivaccoId) {
  try {
    await revocaEmergenza(bivaccoId)
    mostraOk('Emergenza revocata')
    await loadData()
  } catch (error) { mostraErrore(error) }
}

function formattaStato(s) {
  return (s || '').replaceAll('_', ' ').toUpperCase()
}

const bivacchiInEmergenza = computed(() => bivacchi.value.filter(b => b.emergenza))

onMounted(loadData)
</script>

<template>
  <section class="su-panel">
    <header class="su-head">
      <div>
        <p class="label">SuperUser</p>
        <h3>Area gestione segnalazioni ed emergenze</h3>
      </div>
      <button class="btn btn-ghost" @click="loadData">Aggiorna</button>
    </header>

    <p v-if="message" class="msg" :class="`msg-${messageType}`">{{ message }}</p>
    <p v-if="loading" class="dim">Caricamento…</p>

    <template v-else>
      <section class="su-card">
        <h4>Coda ticket aperti ({{ codaTicketAperti.length }})</h4>
        <p v-if="!codaTicketAperti.length" class="dim">Nessun ticket aperto.</p>
        <div v-for="t in codaTicketAperti" :key="t._id" class="ticket-row">
          <div class="ticket-info">
            <strong>{{ t.segnalazione?.bivaccoId?.nome || 'Bivacco' }}</strong>
            <span class="badge">{{ formattaStato(t.stato) }}</span>
            <p class="dim">{{ t.segnalazione?.descrizione }}</p>
          </div>

          <div class="ticket-actions">
            <button
              v-if="t.stato === 'aperto'"
              class="btn btn-ghost"
              @click="handleAvanza(t._id)"
            >
              Metti in lavorazione
            </button>

            <textarea
              v-model="noteChiusura[t._id]"
              class="textarea"
              placeholder="Note di intervento (obbligatorie per chiudere)"
            ></textarea>
            <button class="btn btn-primary" @click="handleChiudi(t._id)">
              Chiudi con note
            </button>
          </div>
        </div>
      </section>

      <section class="su-card">
        <h4>Ticket chiusi</h4>
        <div
          v-for="t in ticket.filter(x => x.stato === 'chiuso')"
          :key="t._id"
          class="ticket-row"
        >
          <div class="ticket-info">
            <strong>{{ t.segnalazione?.bivaccoId?.nome || 'Bivacco' }}</strong>
            <span class="badge ok">CHIUSO</span>
            <p class="dim">Note: {{ t.note }}</p>
          </div>
          <button class="btn btn-ghost" @click="handleArchivia(t._id)">Archivia</button>
        </div>
        <p v-if="!ticket.filter(x => x.stato === 'chiuso').length" class="dim">
          Nessun ticket chiuso in attesa di archiviazione.
        </p>
      </section>

      <section class="su-card">
        <h4>Segnalazioni ricevute</h4>
        <p v-if="!segnalazioni.length" class="dim">Nessuna segnalazione.</p>
        <div v-for="s in segnalazioni" :key="s._id" class="ticket-row">
          <div class="ticket-info">
            <strong>{{ s.bivaccoId?.nome || s.bivaccoId }}</strong>
            <span class="badge">{{ formattaStato(s.statoSegnalazione) }}</span>
            <p class="dim">{{ s.descrizione }}</p>
          </div>
          <button
            v-if="!ticketDiSegnalazione(s._id)"
            class="btn btn-primary"
            @click="handleApri(s._id)"
          >
            Prendi in carico (apri ticket)
          </button>
          <span v-else class="dim">Ticket già aperto</span>
        </div>
      </section>
      
      <section class="su-card">
        <h4>Alert di emergenza</h4>

        <div class="form">
          <label class="field">
            <span>Bivacco</span>
            <select v-model="alertForm.bivaccoId" class="select">
              <option value="">Seleziona bivacco</option>
              <option v-for="b in bivacchi" :key="b._id" :value="b._id">{{ b.nome }}</option>
            </select>
          </label>
          <label class="field">
            <span>Messaggio</span>
            <input v-model="alertForm.messaggio" class="input" placeholder="Es. Frana sul sentiero di accesso" />
          </label>
          <button class="btn btn-danger btn-block" @click="handleAttivaEmergenza">
            Attiva emergenza
          </button>
        </div>

        <div class="emergenze-attive">
          <h4>Emergenze attive</h4>
          <p v-if="!bivacchiInEmergenza.length" class="dim">Nessuna emergenza attiva.</p>
          <div v-for="b in bivacchiInEmergenza" :key="b._id" class="ticket-row">
            <strong>{{ b.nome }}</strong>
            <button class="btn btn-ghost" @click="handleRevoca(b._id)">Revoca</button>
          </div>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.su-panel { display: flex; flex-direction: column; gap: 18px; }
.su-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; }
.su-head h3 { margin-top: 4px; font-size: 1.2rem; }
.su-card {
  background: var(--bg-surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-lg);
  padding: 16px;
}
.su-card h4 { font-size: 1rem; margin-bottom: 14px; }
.ticket-row {
  display: flex; flex-direction: column; gap: 10px;
  background: var(--bg-surface-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r); padding: 12px; margin-bottom: 10px;
}
.ticket-info { display: flex; flex-direction: column; gap: 6px; }
.ticket-actions { display: flex; flex-direction: column; gap: 8px; }
.badge {
  width: fit-content; padding: 3px 8px; border-radius: var(--r-full);
  font-size: 11px; font-weight: 700; background: var(--accent-bg); color: var(--accent-hi);
}
.badge.ok { background: var(--success-bg); color: var(--success); }
.form { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field span { font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.06em; }
.msg { padding: 12px 14px; border-radius: var(--r); font-size: 13px; }
.msg-info { background: var(--accent-bg); border: 1px solid var(--accent-border); color: var(--accent-hi); }
.msg-success { background: var(--success-bg); border: 1px solid rgba(52,211,153,0.28); color: var(--success); }
.msg-error { background: var(--danger-bg); border: 1px solid var(--danger-border); color: var(--danger); }
</style>