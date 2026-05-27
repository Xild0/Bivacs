<script setup>
import { reactive, ref, onMounted } from 'vue'
import {
  getLogApi,
  getConfigApi,
  creaConfigApi,
  modificaConfigApi,
  modificaBivaccoTecnico,
  creaBivaccoTecnico,
  getBivacchi,
  getRichiesteSupporto,
  approvaRichiestaSupporto
} from '../services/api'

const logs = ref([])
const configs = ref([])
const bivacchi = ref([])
const richieste = ref([])

const loading = ref(false)
const message = ref('')
const messageType = ref('info')

const configForm = reactive({
  provider: 'Open-Meteo',
  baseUrl: 'https://api.open-meteo.com/v1/forecast',
  enabled: true,
  timeoutMs: 5000
})

const bivaccoForm = reactive({
  bivaccoId: '',
  nome: '',
  latitudine: '',
  longitudine: '',
  altitudine: '',
  postiLetto: '',
  dotazioni: '',
  zona: '',
  tipoStruttura: 'fisso',
  acquaPresente: true,
  legnaDisponibile: true,
  emergenza: false
})

const bivaccoMode = ref('modifica')  // 'modifica' | 'creazione'

const nuovoBivaccoForm = reactive({
  nome: '',
  latitudine: '',
  longitudine: '',
  altitudine: '',
  postiLetto: '',
  dotazioni: '',
  zona: '',
  tipoStruttura: 'fisso',
  acquaPresente: true,
  legnaDisponibile: true,
  emergenza: false
})

function resetNuovoBivacco() {
  nuovoBivaccoForm.nome = ''
  nuovoBivaccoForm.latitudine = ''
  nuovoBivaccoForm.longitudine = ''
  nuovoBivaccoForm.altitudine = ''
  nuovoBivaccoForm.postiLetto = ''
  nuovoBivaccoForm.dotazioni = ''
  nuovoBivaccoForm.zona = ''
  nuovoBivaccoForm.tipoStruttura = 'fisso'
  nuovoBivaccoForm.acquaPresente = true
  nuovoBivaccoForm.legnaDisponibile = true
  nuovoBivaccoForm.emergenza = false
}

async function submitNuovoBivacco() {
  message.value = ''

  if (!nuovoBivaccoForm.nome ||
      !nuovoBivaccoForm.latitudine ||
      !nuovoBivaccoForm.longitudine ||
      !nuovoBivaccoForm.altitudine ||
      !nuovoBivaccoForm.zona) {
    messageType.value = 'error'
    message.value = 'Compila almeno nome, coordinate, altitudine e zona.'
    return
  }

  try {
    await creaBivaccoTecnico({
      nome: nuovoBivaccoForm.nome,
      latitudine: Number(nuovoBivaccoForm.latitudine),
      longitudine: Number(nuovoBivaccoForm.longitudine),
      altitudine: Number(nuovoBivaccoForm.altitudine),
      postiLetto: Number(nuovoBivaccoForm.postiLetto) || 0,
      dotazioni: nuovoBivaccoForm.dotazioni,
      zona: nuovoBivaccoForm.zona,
      tipoStruttura: nuovoBivaccoForm.tipoStruttura,
      acquaPresente: nuovoBivaccoForm.acquaPresente,
      legnaDisponibile: nuovoBivaccoForm.legnaDisponibile,
      emergenza: nuovoBivaccoForm.emergenza
    })

    messageType.value = 'success'
    message.value = `Bivacco "${nuovoBivaccoForm.nome}" creato con successo`
    resetNuovoBivacco()
    bivacchi.value = await getBivacchi()
  } catch (error) {
    messageType.value = 'error'
    message.value = error.message
  }
}
const richiesteSupporto = ref([])

async function loadRichiesteSupporto() {
  richiesteSupporto.value = await getRichiesteSupporto()
}

async function approvaRichiesta(utenteId) {
  try {
    await approvaRichiestaSupporto(utenteId)
    messageType.value = 'success'
    message.value = 'Richiesta approvata correttamente'
    await loadRichiesteSupporto()
  } catch (error) {
    messageType.value = 'error'
    message.value = error.message
  }
}

async function loadSupportoData() {
  loading.value = true
  message.value = ''

  try {
    logs.value = await getLogApi()
    configs.value = await getConfigApi()
    bivacchi.value = await getBivacchi()
    richiesteSupporto.value = await getRichiesteSupporto()
  } catch (error) {
    messageType.value = 'error'
    message.value = error.message
  } finally {
    loading.value = false
  }
}

async function submitConfig() {
  message.value = ''

  try {
    const esistente = configs.value.find(c => c.provider === configForm.provider)

    if (esistente) {
      await modificaConfigApi(esistente._id, {
        baseUrl: configForm.baseUrl,
        enabled: configForm.enabled,
        timeoutMs: Number(configForm.timeoutMs)
      })

      message.value = 'Configurazione API aggiornata correttamente'
    } else {
      await creaConfigApi({
        provider: configForm.provider,
        baseUrl: configForm.baseUrl,
        enabled: configForm.enabled,
        timeoutMs: Number(configForm.timeoutMs)
      })

      message.value = 'Configurazione API creata correttamente'
    }

    messageType.value = 'success'
    configs.value = await getConfigApi()
  } catch (error) {
    messageType.value = 'error'
    message.value = error.message
  }
}

function selezionaBivacco() {
  const bivacco = bivacchi.value.find(b => b._id === bivaccoForm.bivaccoId)
  if (!bivacco) return

  bivaccoForm.nome = bivacco.nome || ''
  bivaccoForm.latitudine = bivacco.latitudine ?? ''
  bivaccoForm.longitudine = bivacco.longitudine ?? ''
  bivaccoForm.altitudine = bivacco.altitudine ?? ''
  bivaccoForm.postiLetto = bivacco.postiLetto ?? ''
  bivaccoForm.dotazioni = bivacco.dotazioni || ''
  bivaccoForm.zona = bivacco.zona || ''
  bivaccoForm.tipoStruttura = bivacco.tipoStruttura || 'fisso'
  bivaccoForm.acquaPresente = Boolean(bivacco.acquaPresente)
  bivaccoForm.legnaDisponibile = Boolean(bivacco.legnaDisponibile)
  bivaccoForm.emergenza = Boolean(bivacco.emergenza)
}

async function submitBivacco() {
  if (!bivaccoForm.bivaccoId) {
    messageType.value = 'error'
    message.value = 'Seleziona un bivacco da modificare'
    return
  }

  try {
    await modificaBivaccoTecnico(bivaccoForm.bivaccoId, {
      nome: bivaccoForm.nome,
      latitudine: Number(bivaccoForm.latitudine),
      longitudine: Number(bivaccoForm.longitudine),
      altitudine: Number(bivaccoForm.altitudine),
      postiLetto: Number(bivaccoForm.postiLetto),
      dotazioni: bivaccoForm.dotazioni,
      zona: bivaccoForm.zona,
      tipoStruttura: bivaccoForm.tipoStruttura,
      acquaPresente: bivaccoForm.acquaPresente,
      legnaDisponibile: bivaccoForm.legnaDisponibile,
      emergenza: bivaccoForm.emergenza
    })

    messageType.value = 'success'
    message.value = 'Bivacco aggiornato correttamente'
    bivacchi.value = await getBivacchi()
  } catch (error) {
    messageType.value = 'error'
    message.value = error.message
  }
}

onMounted(() => {
  loadSupportoData()
})
</script>

<template>
  <section class="support-panel">
    <header class="support-head">
  <div>
    <p class="label">Supporto Tecnico</p>
    <h3>Area gestione tecnica</h3>
  </div>

      <button class="btn btn-ghost" @click="loadSupportoData">
        Aggiorna
      </button>
    </header>

    <p v-if="message" class="msg" :class="`msg-${messageType}`">
      {{ message }}
    </p>

    <p v-if="loading" class="loading-text">
      Caricamento dati supporto tecnico…
    </p>

    <div v-else class="support-layout">
      <!-- US38 -->
      <section class="support-card">
        <h4>Log API esterne</h4>

        <div v-if="logs.length" class="log-list">
          <div v-for="log in logs" :key="log._id" class="log-row">
            <div>
              <strong>{{ log.provider }}</strong>
              <small>{{ new Date(log.createdAt).toLocaleString('it-IT') }}</small>
            </div>

            <span :class="log.esito ? 'ok' : 'ko'">
              {{ log.esito ? 'OK' : 'ERRORE' }}
            </span>

            <p v-if="log.dettaglioErrore">
              {{ log.dettaglioErrore }}
            </p>
          </div>
        </div>

        <p v-else class="empty">
          Nessun log API disponibile.
        </p>
      </section>
      <section class="support-card support-card-wide">
  <h4>Richieste Supporto Tecnico</h4>

  <div v-if="richiesteSupporto.length" class="log-list">
    <div
      v-for="utente in richiesteSupporto"
      :key="utente._id"
      class="log-row"
    >
      <strong>{{ utente.email }}</strong>
      <small>
        {{ utente.richiestaSupportoTecnico?.motivo || 'Nessun motivo indicato' }}
      </small>
      <small>
        Matricola: {{ utente.richiestaSupportoTecnico?.matricolaRichiesta || 'non indicata' }}
      </small>

      <button
        class="btn btn-primary"
        type="button"
        @click="approvaRichiesta(utente._id)"
      >
        Approva
      </button>
    </div>
  </div>

  <p v-else class="empty">
    Nessuna richiesta in attesa.
  </p>
</section>

      <!-- US39 -->
      <section class="support-card">
        <h4>Configurazione API</h4>

        <form class="form" @submit.prevent="submitConfig">
          <label class="field">
            <span>Provider</span>
            <input v-model="configForm.provider" class="input" />
          </label>

          <label class="field">
            <span>Base URL</span>
            <input v-model="configForm.baseUrl" class="input" />
          </label>

          <label class="field">
            <span>Timeout ms</span>
            <input v-model="configForm.timeoutMs" type="number" class="input" />
          </label>

          <label class="check">
            <input v-model="configForm.enabled" type="checkbox" />
            API abilitata
          </label>

          <button class="btn btn-primary btn-block" type="submit">
            Salva configurazione
          </button>
        </form>

        <div class="config-list">
          <div v-for="config in configs" :key="config._id" class="config-row">
            <strong>{{ config.provider }}</strong>
            <small>{{ config.baseUrl }}</small>
            <span :class="config.enabled ? 'ok' : 'ko'">
              {{ config.enabled ? 'Attiva' : 'Disattiva' }}
            </span>
          </div>
        </div>
      </section>

      <section class="support-card support-card-wide">
  <div class="bivacco-tabs">
    <button
      :class="{ active: bivaccoMode === 'creazione' }"
      @click="bivaccoMode = 'creazione'"
    >
      Aggiungi nuovo
    </button>
    <button
      :class="{ active: bivaccoMode === 'modifica' }"
      @click="bivaccoMode = 'modifica'"
    >
      Modifica esistente
    </button>
  </div>

  <!-- Modalità creazione -->
  <form
    v-if="bivaccoMode === 'creazione'"
    class="form"
    @submit.prevent="submitNuovoBivacco"
  >
    <div class="form-grid">
      <label class="field">
        <span>Nome *</span>
        <input v-model="nuovoBivaccoForm.nome" class="input" placeholder="Bivacco Mario Rossi" />
      </label>

      <label class="field">
        <span>Zona *</span>
        <input v-model="nuovoBivaccoForm.zona" class="input" placeholder="Adamello / Brenta / …" />
      </label>

      <label class="field">
        <span>Latitudine * (decimali)</span>
        <input v-model="nuovoBivaccoForm.latitudine" type="number" step="0.000001" class="input" placeholder="46.123456" />
      </label>

      <label class="field">
        <span>Longitudine *</span>
        <input v-model="nuovoBivaccoForm.longitudine" type="number" step="0.000001" class="input" placeholder="10.987654" />
      </label>

      <label class="field">
        <span>Altitudine * (m)</span>
        <input v-model="nuovoBivaccoForm.altitudine" type="number" class="input" placeholder="2350" />
      </label>

      <label class="field">
        <span>Posti letto</span>
        <input v-model="nuovoBivaccoForm.postiLetto" type="number" class="input" placeholder="4" />
      </label>

      <label class="field">
        <span>Tipo struttura</span>
        <select v-model="nuovoBivaccoForm.tipoStruttura" class="select">
          <option value="fisso">Fisso</option>
          <option value="mobile">Mobile</option>
          <option value="invernale">Locale invernale</option>
        </select>
      </label>
    </div>

    <label class="field">
      <span>Dotazioni</span>
      <textarea
        v-model="nuovoBivaccoForm.dotazioni"
        class="textarea"
        placeholder="Stufa a legna, brande, coperte, tavolo…"
      ></textarea>
    </label>

    <div class="checks">
      <label class="check">
        <input v-model="nuovoBivaccoForm.acquaPresente" type="checkbox" />
        Acqua presente
      </label>

      <label class="check">
        <input v-model="nuovoBivaccoForm.legnaDisponibile" type="checkbox" />
        Legna disponibile
      </label>

      <label class="check danger-check">
        <input v-model="nuovoBivaccoForm.emergenza" type="checkbox" />
        Stato emergenza
      </label>
    </div>

    <button class="btn btn-primary btn-block" type="submit">
      Crea bivacco
    </button>

    <small class="form-hint">
      * Campi obbligatori. Le coordinate devono essere nei limiti della PAT (lat 45.6–46.6, lng 10.4–12.0).
    </small>
  </form>

  <!-- Modalità modifica (form esistente) -->
  <form
    v-else
    class="form"
    @submit.prevent="submitBivacco"
  >
    <label class="field">
      <span>Bivacco</span>
      <select
        v-model="bivaccoForm.bivaccoId"
        class="select"
        @change="selezionaBivacco"
      >
        <option value="">Seleziona bivacco</option>
        <option
          v-for="bivacco in bivacchi"
          :key="bivacco._id"
          :value="bivacco._id"
        >
          {{ bivacco.nome }}
        </option>
      </select>
    </label>

    <div class="form-grid">
      <label class="field">
        <span>Nome</span>
        <input v-model="bivaccoForm.nome" class="input" />
      </label>

      <label class="field">
        <span>Zona</span>
        <input v-model="bivaccoForm.zona" class="input" />
      </label>

      <label class="field">
        <span>Latitudine</span>
        <input v-model="bivaccoForm.latitudine" type="number" step="0.000001" class="input" />
      </label>

      <label class="field">
        <span>Longitudine</span>
        <input v-model="bivaccoForm.longitudine" type="number" step="0.000001" class="input" />
      </label>

      <label class="field">
        <span>Altitudine</span>
        <input v-model="bivaccoForm.altitudine" type="number" class="input" />
      </label>

      <label class="field">
        <span>Posti letto</span>
        <input v-model="bivaccoForm.postiLetto" type="number" class="input" />
      </label>
    </div>

    <label class="field">
      <span>Dotazioni</span>
      <textarea v-model="bivaccoForm.dotazioni" class="textarea"></textarea>
    </label>

    <div class="checks">
      <label class="check">
        <input v-model="bivaccoForm.acquaPresente" type="checkbox" />
        Acqua presente
      </label>

      <label class="check">
        <input v-model="bivaccoForm.legnaDisponibile" type="checkbox" />
        Legna disponibile
      </label>

      <label class="check danger-check">
        <input v-model="bivaccoForm.emergenza" type="checkbox" />
        Stato emergenza
      </label>
    </div>

    <button class="btn btn-primary btn-block" type="submit">
      Aggiorna bivacco
    </button>
  </form>
</section>

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

.msg-error {
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  color: var(--danger);
}

.support-layout {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.support-card {
  background: var(--bg-surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-lg);
  padding: 20px;
}

.support-card h4 {
  font-size: 1.15rem;
  margin-bottom: 16px;
}

.bivacco-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: var(--bg-surface-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-md);
  padding: 4px;
  margin-bottom: 18px;
}

.bivacco-tabs button {
  padding: 10px 14px;
  border-radius: calc(var(--r-md) - 4px);
  color: var(--text-tertiary);
  font-size: 13px;
  font-weight: 700;
}

.bivacco-tabs button.active {
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  color: var(--accent-hi);
}

.support-card {
  background: var(--bg-surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-lg);
  padding: 16px;
}

.support-card-wide {
  grid-column: 1 / -1;
}

.support-card h4 {
  font-size: 1rem;
  margin-bottom: 14px;
}

.log-list,
.config-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 360px;
  overflow-y: auto;
}

.log-row,
.config-row {
  background: var(--bg-surface-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.log-row strong,
.config-row strong {
  font-size: 13px;
  color: var(--text-primary);
}

.log-row small,
.config-row small {
  font-size: 11px;
  color: var(--text-tertiary);
  word-break: break-word;
}

.log-row p {
  font-size: 12px;
  color: var(--danger);
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

.form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
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

.checks {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 13px;
}

.check input {
  accent-color: var(--accent);
}

.danger-check {
  color: var(--danger);
}

@media (max-width: 780px) {
  .support-grid,
  .form-grid {
    grid-template-columns: 1fr;
  }

  .support-card-wide {
    grid-column: auto;
  }
}
</style>