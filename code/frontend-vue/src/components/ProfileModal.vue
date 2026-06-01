/**
 * @file ProfileModal.vue
 * @description Modale per la gestione del profilo utente.
 */

<script setup>
import { reactive, ref, onMounted } from 'vue'
import Modal from './Modal.vue'
import SupportoTecnicoPanel from './SupportoTecnicoPanel.vue'
import {
  getProfile,
  updateProfile,
  deleteProfile,
  logoutUser,
  getAllertePreferiti,
  richiediSupportoTecnico,
  getMieSegnalazioni
} from '../services/api'

const emit = defineEmits(['close', 'auth-changed', 'open-bivacco'])

const profile = reactive({
  nome: '',
  cognome: '',
  email: '',
  password: '',
  discriminator: '',
  preferiti: [],
  richiestaSupportoTecnico: null
})

const richiestaST = reactive({
  motivo: '',
  matricola: ''
})

const message = ref('')
const messageType = ref('info')
const loaded = ref(false)
const allerteMap = ref({})
const mieSegnalazioni = ref([])
const segnalazioniLoading = ref(false)

async function loadProfile() {
  try {
    const data = await getProfile()

    profile.nome = data.nome || ''
    profile.cognome = data.cognome || ''
    profile.email = data.email || ''
    profile.discriminator = data.discriminator || ''
    profile.password = ''
    profile.preferiti = data.preferiti || []
    profile.richiestaSupportoTecnico = data.richiestaSupportoTecnico || null

    loaded.value = true
    message.value = ''
  } catch (error) {
    messageType.value = 'error'
    message.value = error.message
  }
}

async function saveProfile() {
  try {
    await updateProfile({
      nome: profile.nome,
      cognome: profile.cognome,
      email: profile.email,
      password: profile.password || undefined
    })

    profile.password = ''
    messageType.value = 'success'
    message.value = 'Profilo aggiornato correttamente'
  } catch (error) {
    messageType.value = 'error'
    message.value = error.message
  }
}

async function loadMieSegnalazioni() {
  segnalazioniLoading.value = true

  try {
    mieSegnalazioni.value = await getMieSegnalazioni()
  } catch (error) {
    console.error('Errore caricamento mie segnalazioni:', error)
    mieSegnalazioni.value = []
  } finally {
    segnalazioniLoading.value = false
  }
}

async function inviaRichiestaSupporto() {
  try {
    await richiediSupportoTecnico({
      motivo: richiestaST.motivo,
      matricola: richiestaST.matricola
    })

    messageType.value = 'success'
    message.value = 'Richiesta inviata. Attendi approvazione.'

    richiestaST.motivo = ''
    richiestaST.matricola = ''

    await loadProfile()
  } catch (error) {
    messageType.value = 'error'
    message.value = error.message
  }
}

async function removeAccount() {
  const conferma = confirm('Sei sicuro/a di voler eliminare definitivamente il tuo account? Le tue recensioni resteranno visibili in forma anonima.')
  if (!conferma) return

  try {
    await deleteProfile()
    logoutUser()
    emit('auth-changed')
    emit('close')
  } catch (error) {
    messageType.value = 'error'
    message.value = error.message
  }
}

function submitLogout() {
  logoutUser()
  emit('auth-changed')
  emit('close')
}

async function loadAllerte() {
  try {
    const data = await getAllertePreferiti()
    const newMap = {}

    for (const item of data.allerte || []) {
      if (item.meteo?.allerta) {
        newMap[item.bivacco.id] = item.meteo
      }
    }

    allerteMap.value = newMap
  } catch (error) {
    console.error('Errore allerte preferiti:', error)
  }
}

function openPreferito(bivacco) {
  emit('open-bivacco', bivacco)
  emit('close')
}

onMounted(() => {
  loadProfile()
  loadAllerte()
  loadMieSegnalazioni()
})
</script>

<template>
  <Modal
    label="Account"
    title="Il tuo profilo"
    max-width="520px"
    @close="emit('close')"
  >
    <p v-if="message" class="msg" :class="`msg-${messageType}`">
      {{ message }}
    </p>

    <div v-if="loaded" class="profile-hero">
  <div class="profile-avatar">
    {{ (profile.nome?.[0] || profile.email?.[0] || 'U').toUpperCase() }}
  </div>

  <div class="profile-info">
    <h3>
      {{ profile.nome || 'Utente' }} {{ profile.cognome || '' }}
    </h3>

    <p>{{ profile.email }}</p>

    <span
      class="role-badge"
      :class="{
        'role-user': profile.discriminator === 'UtenteRegistrato',
        'role-tech': profile.discriminator === 'SupportoTecnico',
        'role-super': profile.discriminator === 'SuperUser'
      }"
    >
      {{
        profile.discriminator === 'SupportoTecnico'
          ? 'Supporto Tecnico'
          : profile.discriminator === 'SuperUser'
            ? 'Super User'
            : 'Utente registrato'
      }}
    </span>
  </div>
</div>

    <form v-if="loaded" class="form" @submit.prevent="saveProfile">
      <div class="row">
        <label class="field">
          <span class="field-label">Nome</span>
          <input v-model="profile.nome" class="input" />
        </label>

        <label class="field">
          <span class="field-label">Cognome</span>
          <input v-model="profile.cognome" class="input" />
        </label>
      </div>

      <label class="field">
        <span class="field-label">Email</span>
        <input v-model="profile.email" class="input" type="email" />
      </label>

      <label class="field">
        <span class="field-label">Nuova password (opzionale)</span>
        <input
          v-model="profile.password"
          class="input"
          type="password"
          placeholder="Lascia vuoto per non cambiarla"
        />
      </label>

      <button type="submit" class="btn btn-primary btn-block">
        Salva modifiche
      </button>
    </form>

    <div v-else class="loading">
      <div class="spinner"></div>
      <p>Caricamento profilo…</p>
    </div>

    <div class="divider"></div>

    <section class="favorites-section">
      <h3>I miei preferiti</h3>

      <div v-if="profile.preferiti.length" class="favorites-grid">
        <button
          v-for="bivacco in profile.preferiti"
          :key="bivacco._id || bivacco"
          type="button"
          class="favorite-card"
          @click="openPreferito(bivacco)"
        >
          <div class="favorite-top">
            <h4>{{ bivacco.nome }}</h4>

            <div class="favorite-top-right">
              <span class="favorite-altitude">
                {{ bivacco.altitudine }} m
              </span>

              <span
                v-if="allerteMap[bivacco._id]"
                class="alert-badge"
                title="Meteo avverso previsto"
              >
                ⚠️
              </span>
            </div>
          </div>

          <div class="favorite-meta">
            <span>{{ bivacco.zona }}</span>
            <span>{{ bivacco.postiLetto }} posti</span>
          </div>

          <div class="favorite-footer">
            <span class="open-label">Apri scheda bivacco</span>
            <span class="arrow">→</span>
          </div>
        </button>
      </div>

      <p v-else class="empty-favorites">
        Nessun bivacco salvato nei preferiti.
      </p>
    </section>

        <div class="divider"></div>

    <section class="segnalazioni-section">
      <h3>Le mie segnalazioni</h3>

      <p v-if="segnalazioniLoading" class="empty-favorites">
        Caricamento segnalazioni…
      </p>

      <div v-else-if="mieSegnalazioni.length" class="favorites-grid">
        <div
          v-for="segnalazione in mieSegnalazioni"
          :key="segnalazione._id"
          class="favorite-card"
        >
          <div class="favorite-top">
            <h4>
              {{ segnalazione.bivaccoId?.nome || 'Bivacco non disponibile' }}
            </h4>

            <span class="favorite-altitude">
              {{ segnalazione.statoSegnalazione?.replaceAll('_', ' ').toUpperCase() }}
            </span>
          </div>

          <div class="favorite-meta">
            <span>{{ segnalazione.bivaccoId?.zona || 'Zona non indicata' }}</span>
            <span>{{ new Date(segnalazione.createdAt).toLocaleDateString('it-IT') }}</span>
          </div>

          <p class="segnalazione-desc">
            {{ segnalazione.descrizione }}
          </p>
        </div>
      </div>

      <p v-else class="empty-favorites">
        Non hai ancora inviato segnalazioni.
      </p>
    </section>

    <div class="divider"></div>

    <section
      v-if="profile.discriminator !== 'SupportoTecnico'"
      class="support-request-section"
    >
      <h3>Richiedi ruolo Supporto Tecnico</h3>

      <p
        v-if="profile.richiestaSupportoTecnico?.stato === 'in_attesa'"
        class="request-status"
      >
        Richiesta già inviata: in attesa di approvazione.
      </p>

      <form
        v-else
        class="form"
        @submit.prevent="inviaRichiestaSupporto"
      >
        <label class="field">
          <span class="field-label">Motivo richiesta</span>
          <textarea
            v-model="richiestaST.motivo"
            class="textarea"
            placeholder="Spiega perché richiedi l'accesso tecnico"
          ></textarea>
        </label>

        <label class="field">
          <span class="field-label">Matricola / codice</span>
          <input
            v-model="richiestaST.matricola"
            class="input"
            placeholder="Es. ST002"
          />
        </label>

        <button class="btn btn-primary btn-block" type="submit">
          Invia richiesta
        </button>
      </form>
    </section>

    <section
      v-if="profile.discriminator === 'SupportoTecnico'"
      class="support-section"
    >
      <SupportoTecnicoPanel />
    </section>

    <div class="divider"></div>

    <div class="danger-zone">
      <button class="btn btn-ghost btn-block" @click="submitLogout">
        Esci
      </button>

      <button class="btn btn-danger btn-block" @click="removeAccount">
        Elimina account
      </button>
    </div>
  </Modal>
</template>

<style scoped>
.msg {
  padding: 12px 14px;
  border-radius: var(--r);
  font-size: 13px;
  margin-bottom: 16px;
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

.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 30px;
}

.spinner {
  width: 28px;
  height: 28px;
  border: 2.5px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading p {
  font-size: 13px;
  color: var(--text-tertiary);
}

.divider {
  height: 1px;
  background: var(--border-subtle);
  margin: 22px 0;
}

.danger-zone {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.favorites-section h3,
.support-request-section h3 {
  font-size: 1rem;
  margin-bottom: 10px;
}

.empty-favorites,
.request-status {
  font-size: 13px;
  color: var(--text-tertiary);
  background: var(--bg-surface-2);
  border-radius: var(--r);
  padding: 12px;
}

.favorites-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.favorite-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border-radius: var(--r-lg);
  background:
    linear-gradient(
      135deg,
      rgba(79, 195, 247, 0.08),
      rgba(255, 255, 255, 0.02)
    );
  border: 1px solid var(--border-subtle);
  text-align: left;
  transition:
    transform 0.2s var(--ease),
    border-color 0.2s var(--ease),
    background 0.2s var(--ease);
}

.favorite-card:hover {
  transform: translateY(-2px);
  border-color: var(--accent-border);
  background:
    linear-gradient(
      135deg,
      rgba(79, 195, 247, 0.14),
      rgba(255, 255, 255, 0.04)
    );
}

.favorite-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}

.favorite-top h4 {
  margin: 0;
  font-size: 15px;
  line-height: 1.35;
  color: var(--text-primary);
}

.favorite-top-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.favorite-altitude {
  flex-shrink: 0;
  padding: 4px 8px;
  border-radius: var(--r-full);
  background: rgba(79, 195, 247, 0.12);
  color: var(--accent-hi);
  font-size: 11px;
  font-weight: 600;
}

.alert-badge {
  padding: 4px 8px;
  border-radius: var(--r-full);
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  font-size: 13px;
  cursor: help;
  animation: pulseGlow 2s infinite;
}

.favorite-meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.favorite-meta span {
  padding: 5px 10px;
  border-radius: var(--r-full);
  background: var(--bg-surface-2);
  border: 1px solid var(--border-subtle);
  font-size: 12px;
  color: var(--text-secondary);
}

.favorite-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.open-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.arrow {
  font-size: 18px;
  color: var(--accent);
}

.support-section {
  margin-top: 22px;
}

@media (max-width: 420px) {
  .row {
    grid-template-columns: 1fr;
  }

  .favorite-top {
    flex-direction: column;
  }
}

.profile-hero {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background:
    linear-gradient(
      135deg,
      rgba(79, 195, 247, 0.12),
      rgba(255, 255, 255, 0.03)
    );
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-lg);
  margin-bottom: 18px;
}

.profile-avatar {
  width: 54px;
  height: 54px;
  border-radius: var(--r-full);
  display: grid;
  place-items: center;
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  color: var(--accent-hi);
  font-family: var(--font-display);
  font-size: 1.4rem;
  font-weight: 700;
}

.profile-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.profile-info h3 {
  font-size: 1.1rem;
  margin: 0;
}

.profile-info p {
  font-size: 13px;
  color: var(--text-tertiary);
  word-break: break-word;
}

.role-badge {
  width: fit-content;
  padding: 4px 10px;
  border-radius: var(--r-full);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.role-user {
  background: var(--bg-surface-2);
  color: var(--text-secondary);
  border: 1px solid var(--border-subtle);
}

.role-tech {
  background: var(--accent-bg);
  color: var(--accent-hi);
  border: 1px solid var(--accent-border);
}

.role-super {
  background: var(--warning-bg);
  color: var(--warning);
  border: 1px solid rgba(251, 191, 36, 0.28);
}

.segnalazioni-section h3 {
  font-size: 1rem;
  margin-bottom: 10px;
}

.segnalazione-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}
</style>