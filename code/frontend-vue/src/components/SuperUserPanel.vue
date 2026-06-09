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
  revocaEmergenza,
  exportCSV
} from '../services/api'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'

const segnalazioni = ref([])
const ticket = ref([])
const bivacchi = ref([])
const loading = ref(false)
const message = ref('')
const messageType = ref('info')
const noteChiusura = ref({})
const alertForm = ref({ bivaccoId: '', messaggio: '' })

const showTicketAperti = ref(true)
const showTicketChiusi = ref(false)
const showStoricoSegnalazioni = ref(false)
const showEmergenze = ref(false)

/**
 * Restituisce i bivacchi attualmente in stato di emergenza.
 *
 * @returns {Array<Object>} Lista dei bivacchi con emergenza attiva.
 */
const bivacchiInEmergenza = computed(() =>
  bivacchi.value.filter(b => b.emergenza)
)

/**
 * Restituisce i ticket aperti o in lavorazione.
 *
 * @returns {Array<Object>} Coda dei ticket ancora attivi.
 */
const codaTicketAperti = computed(() =>
  ticket.value.filter(t => t.stato === 'aperto' || t.stato === 'in_lavorazione')
)

/**
 * Restituisce i ticket chiusi non ancora archiviati.
 *
 * @returns {Array<Object>} Lista dei ticket chiusi.
 */
const ticketChiusi = computed(() =>
  ticket.value.filter(t => t.stato === 'chiuso')
)

/**
 * Cerca il ticket associato a una specifica segnalazione.
 *
 * @param {string} segnalazioneId - ID della segnalazione.
 * @returns {Object|undefined} Ticket collegato, se presente.
 */
function ticketDiSegnalazione(segnalazioneId) {
  return ticket.value.find(t => {
    const segId = t.segnalazione?._id || t.segnalazione
    return String(segId) === String(segnalazioneId)
  })
}

/**
 * Genera l'URL completo della foto di una segnalazione.
 *
 * @param {string} foto - Percorso o URL della foto.
 * @returns {string} URL completo della foto.
 */
function fotoUrl(foto) {
  if (!foto) return ''
  if (foto.startsWith('http')) return foto
  return `${API_BASE}${foto}`
}

/**
 * Apre o chiude una sezione del pannello SuperUser.
 *
 * @param {string} section - Nome della sezione da alternare.
 * @returns {void}
 */
function toggleSection(section) {
  if (section === 'aperti') showTicketAperti.value = !showTicketAperti.value
  if (section === 'chiusi') showTicketChiusi.value = !showTicketChiusi.value
  if (section === 'storico') showStoricoSegnalazioni.value = !showStoricoSegnalazioni.value
  if (section === 'emergenze') showEmergenze.value = !showEmergenze.value
}

/**
 * Carica segnalazioni, ticket e bivacchi necessari al pannello.
 *
 * @returns {Promise<void>}
 */
async function loadData() {
  loading.value = true
  message.value = ''

  try {
    const seg = await getStoricoSegnalazioni()
    const tk = await getTicket()
    const biv = await getBivacchi()

    segnalazioni.value = Array.isArray(seg) ? seg : []
    ticket.value = Array.isArray(tk) ? tk : []
    bivacchi.value = Array.isArray(biv) ? biv : []
  } catch (error) {
    messageType.value = 'error'
    message.value = error.message
  } finally {
    loading.value = false
  }
}

/**
 * Mostra un messaggio di successo nel pannello.
 *
 * @param {string} msg - Messaggio da visualizzare.
 * @returns {void}
 */
function mostraOk(msg) {
  messageType.value = 'success'
  message.value = msg
}

/**
 * Mostra un messaggio di errore nel pannello.
 *
 * @param {Error|Object} error - Errore ricevuto.
 * @returns {void}
 */
function mostraErrore(error) {
  messageType.value = 'error'
  message.value = error.message || 'Errore'
}

/**
 * Apre un ticket a partire da una segnalazione.
 *
 * @param {string} segnalazioneId - ID della segnalazione da prendere in carico.
 * @returns {Promise<void>}
 */
async function handleApri(segnalazioneId) {
  try {
    await apriTicket(segnalazioneId)
    mostraOk('Ticket aperto: segnalazione presa in carico')
    await loadData()
  } catch (error) {
    mostraErrore(error)
  }
}

/**
 * Imposta un ticket nello stato "in lavorazione".
 *
 * @param {string} ticketId - ID del ticket.
 * @returns {Promise<void>}
 */
async function handleAvanza(ticketId) {
  try {
    await aggiornaStatoTicket(ticketId, 'in_lavorazione')
    mostraOk('Ticket in lavorazione')
    await loadData()
  } catch (error) {
    mostraErrore(error)
  }
}

/**
 * Chiude un ticket inserendo le note di intervento.
 *
 * @param {string} ticketId - ID del ticket da chiudere.
 * @returns {Promise<void>}
 */
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
  } catch (error) {
    mostraErrore(error)
  }
}

/**
 * Archivia un ticket chiuso nello storico.
 *
 * @param {string} ticketId - ID del ticket da archiviare.
 * @returns {Promise<void>}
 */
async function handleArchivia(ticketId) {
  try {
    await archiviaTicket(ticketId)
    mostraOk('Ticket archiviato nello storico')
    await loadData()
  } catch (error) {
    mostraErrore(error)
  }
}

/**
 * Attiva un alert di emergenza su un bivacco.
 *
 * @returns {Promise<void>}
 */
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
  } catch (error) {
    mostraErrore(error)
  }
}

/**
 * Revoca lo stato di emergenza di un bivacco.
 *
 * @param {string} bivaccoId - ID del bivacco.
 * @returns {Promise<void>}
 */
async function handleRevoca(bivaccoId) {
  try {
    await revocaEmergenza(bivaccoId)
    mostraOk('Emergenza revocata')
    await loadData()
  } catch (error) {
    mostraErrore(error)
  }
}

/**
 * Formatta uno stato tecnico rendendolo leggibile.
 *
 * @param {string} s - Stato da formattare.
 * @returns {string} Stato formattato.
 */
function formattaStato(s) {
  return (s || '').replaceAll('_', ' ').toUpperCase()
}

/**
 * Esporta il dataset delle segnalazioni in formato CSV.
 *
 * @returns {Promise<void>}
 */
async function handleExportCSV() {
  try {
    const csv = await exportCSV()
    const blob = new Blob(['\uFEFF' + csv], {
      type: 'text/csv;charset=utf-8;'
    })

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')

    a.href = url
    a.download = 'dataset_segnalazioni.csv'
    a.click()

    URL.revokeObjectURL(url)
    mostraOk('Dataset segnalazioni esportato in CSV')
  } catch (error) {
    mostraErrore(error)
  }
}

/**
 * Carica i dati del pannello al montaggio.
 */
onMounted(loadData)
</script>

<template>
  <section class="su-panel">
    <header class="su-head">
      <div>
        <p class="label">SuperUser</p>
        <h3>Area gestione segnalazioni ed emergenze</h3>
      </div>

      <div class="su-head-actions">
        <button class="btn btn-ghost" type="button" @click="handleExportCSV">
          Esporta CSV
        </button>

        <button class="btn btn-ghost" type="button" @click="loadData">
          Aggiorna
        </button>
      </div>
    </header>

    <p v-if="message" class="msg" :class="`msg-${messageType}`">
      {{ message }}
    </p>

    <p v-if="loading" class="dim">
      Caricamento…
    </p>

    <template v-else>
      <section class="su-card">
        <button class="section-toggle" type="button" @click="toggleSection('aperti')">
          <span>Coda ticket aperti</span>
          <span class="count-badge">{{ codaTicketAperti.length }}</span>
          <span class="chevron">{{ showTicketAperti ? '−' : '+' }}</span>
        </button>

        <div v-if="showTicketAperti" class="section-content">
          <p v-if="!codaTicketAperti.length" class="dim">
            Nessun ticket aperto.
          </p>

          <div v-for="t in codaTicketAperti" :key="t._id" class="ticket-row">
            <div class="ticket-info">
              <strong>{{ t.segnalazione?.bivaccoId?.nome || 'Bivacco' }}</strong>

              <span class="badge">
                {{ formattaStato(t.stato) }}
              </span>

              <p class="dim">
                {{ t.segnalazione?.descrizione }}
              </p>

              <img
                v-if="t.segnalazione?.foto"
                :src="fotoUrl(t.segnalazione.foto)"
                alt="Foto segnalazione"
                class="ticket-photo"
              />
            </div>

            <div class="ticket-actions">
              <button
                v-if="t.stato === 'aperto'"
                class="btn btn-ghost"
                type="button"
                @click="handleAvanza(t._id)"
              >
                Metti in lavorazione
              </button>

              <textarea
                v-model="noteChiusura[t._id]"
                class="textarea"
                placeholder="Note di intervento (obbligatorie per chiudere)"
              ></textarea>

              <button class="btn btn-primary" type="button" @click="handleChiudi(t._id)">
                Chiudi con note
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="su-card">
        <button class="section-toggle" type="button" @click="toggleSection('chiusi')">
          <span>Ticket chiusi</span>
          <span class="count-badge">{{ ticketChiusi.length }}</span>
          <span class="chevron">{{ showTicketChiusi ? '−' : '+' }}</span>
        </button>

        <div v-if="showTicketChiusi" class="section-content">
          <div v-for="t in ticketChiusi" :key="t._id" class="ticket-row">
            <div class="ticket-info">
              <strong>{{ t.segnalazione?.bivaccoId?.nome || 'Bivacco' }}</strong>

              <span class="badge ok">
                CHIUSO
              </span>

              <p class="dim">
                Note: {{ t.note }}
              </p>

              <img
                v-if="t.segnalazione?.foto"
                :src="fotoUrl(t.segnalazione.foto)"
                alt="Foto segnalazione"
                class="ticket-photo"
              />
            </div>

            <button class="btn btn-ghost" type="button" @click="handleArchivia(t._id)">
              Archivia
            </button>
          </div>

          <p v-if="!ticketChiusi.length" class="dim">
            Nessun ticket chiuso in attesa di archiviazione.
          </p>
        </div>
      </section>

      <section class="su-card">
        <button class="section-toggle" type="button" @click="toggleSection('storico')">
          <span>Storico segnalazioni</span>
          <span class="count-badge">{{ segnalazioni.length }}</span>
          <span class="chevron">{{ showStoricoSegnalazioni ? '−' : '+' }}</span>
        </button>

        <div v-if="showStoricoSegnalazioni" class="section-content">
          <p v-if="!segnalazioni.length" class="dim">
            Nessuna segnalazione.
          </p>

          <div v-for="s in segnalazioni" :key="s._id" class="ticket-row">
            <div class="ticket-info">
              <strong>{{ s.bivaccoId?.nome || s.bivaccoId }}</strong>

              <span class="badge">
                {{ formattaStato(s.statoSegnalazione) }}
              </span>

              <p class="dim">
                {{ s.descrizione }}
              </p>

              <img
                v-if="s.foto"
                :src="fotoUrl(s.foto)"
                alt="Foto segnalazione"
                class="ticket-photo"
              />
            </div>

            <button
              v-if="!ticketDiSegnalazione(s._id)"
              class="btn btn-primary"
              type="button"
              @click="handleApri(s._id)"
            >
              Prendi in carico (apri ticket)
            </button>

            <span v-else class="dim">
              Ticket già aperto
            </span>
          </div>
        </div>
      </section>

      <section class="su-card">
        <button class="section-toggle" type="button" @click="toggleSection('emergenze')">
          <span>Alert di emergenza</span>
          <span class="count-badge">{{ bivacchiInEmergenza.length }}</span>
          <span class="chevron">{{ showEmergenze ? '−' : '+' }}</span>
        </button>

        <div v-if="showEmergenze" class="section-content">
          <div class="form">
            <label class="field">
              <span>Bivacco</span>

              <select v-model="alertForm.bivaccoId" class="select">
                <option value="">Seleziona bivacco</option>

                <option v-for="b in bivacchi" :key="b._id" :value="b._id">
                  {{ b.nome }}
                </option>
              </select>
            </label>

            <label class="field">
              <span>Messaggio</span>

              <input
                v-model="alertForm.messaggio"
                class="input"
                placeholder="Es. Frana sul sentiero di accesso"
              />
            </label>

            <button class="btn btn-danger btn-block" type="button" @click="handleAttivaEmergenza">
              Attiva emergenza
            </button>
          </div>

          <div class="emergenze-attive">
            <h4>Emergenze attive</h4>

            <p v-if="!bivacchiInEmergenza.length" class="dim">
              Nessuna emergenza attiva.
            </p>

            <div v-for="b in bivacchiInEmergenza" :key="b._id" class="ticket-row">
              <strong>{{ b.nome }}</strong>

              <button class="btn btn-ghost" type="button" @click="handleRevoca(b._id)">
                Revoca
              </button>
            </div>
          </div>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.su-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.su-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
}

.su-head-actions {
  display: flex;
  gap: 8px;
}

.su-head h3 {
  margin-top: 4px;
  font-size: 1.2rem;
}

.su-card {
  background: var(--bg-surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-lg);
  overflow: hidden;
}

.section-toggle {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 10px;
  padding: 16px;
  text-align: left;
  background: var(--bg-surface-2);
  color: var(--text-primary);
  font-weight: 700;
}

.section-toggle:hover {
  background: var(--bg-surface-3);
}

.count-badge {
  min-width: 28px;
  height: 28px;
  padding: 0 9px;
  border-radius: var(--r-full);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  color: var(--accent-hi);
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.chevron {
  width: 28px;
  height: 28px;
  border-radius: var(--r-full);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-surface-3);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  font-size: 18px;
  line-height: 1;
}

.section-content {
  padding: 0 16px 16px;
}

.ticket-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--bg-surface-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r);
  padding: 12px;
  margin-bottom: 10px;
}

.ticket-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ticket-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ticket-photo {
  width: 100%;
  max-height: 260px;
  object-fit: cover;
  border-radius: var(--r);
  border: 1px solid var(--border-subtle);
  margin-top: 10px;
}

.badge {
  width: fit-content;
  padding: 3px 8px;
  border-radius: var(--r-full);
  font-size: 11px;
  font-weight: 700;
  background: var(--accent-bg);
  color: var(--accent-hi);
}

.badge.ok {
  background: var(--success-bg);
  color: var(--success);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field span {
  font-size: 11px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.emergenze-attive h4 {
  font-size: 0.95rem;
  margin-bottom: 10px;
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
  border: 1px solid rgba(52, 211, 153, 0.28);
  color: var(--success);
}

.msg-error {
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  color: var(--danger);
}

@media (max-width: 520px) {
  .su-head {
    flex-direction: column;
  }

  .su-head-actions {
    width: 100%;
    flex-direction: column;
  }
}
</style>