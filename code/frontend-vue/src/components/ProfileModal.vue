/**
 * @file ProfileModal.vue
 * @description Modale per la gestione del profilo utente.
 * Permette modifica dati personali, logout, eliminazione account e visualizzazione preferiti.
 */

<script setup>
import { reactive, ref, onMounted } from 'vue'
import Modal from './Modal.vue'
import { getProfile, updateProfile, deleteProfile, logoutUser, getPreferiti } from '../services/api'
const emit = defineEmits(['close', 'auth-changed', 'open-bivacco'])

const profile = reactive({
  nome: '',
  cognome: '',
  email: '',
  password: '',
  preferiti: []
})

const message = ref('')
const messageType = ref('info')
const loaded = ref(false)

/**
 * Carica i dati del profilo utente dal backend.
 *
 * @returns {Promise<void>}
 */

async function loadProfile() {
  try {
    const data = await getProfile()
    profile.nome = data.nome || ''
    profile.cognome = data.cognome || ''
    profile.email = data.email || ''
    profile.password = ''
    profile.preferiti = data.preferiti || []
    loaded.value = true
    message.value = ''
  } catch (error) {
    messageType.value = 'error'
    message.value = error.message
  }
}

/**
 * Salva le modifiche al profilo utente.
 *
 * @returns {Promise<void>}
 */

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

/**
 * Elimina definitivamente l'account utente dopo conferma.
 *
 * @returns {Promise<void>}
 */
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

/**
 * Effettua il logout locale dell'utente.
 *
 * @returns {void}
 */

function submitLogout() {
  logoutUser()
  emit('auth-changed')
  emit('close')
}

/**
 * Apre la scheda di un bivacco presente nei preferiti.
 *
 * @param {Object} bivacco - Bivacco selezionato dalla lista preferiti.
 * @returns {void}
 */

function openPreferito(bivacco) {
  emit('open-bivacco', bivacco)
  emit('close')
}

onMounted(() => {
  loadProfile()
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
        <input v-model="profile.password" class="input" type="password" placeholder="Lascia vuoto per non cambiarla" />
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

      <span class="favorite-altitude">
        {{ bivacco.altitudine }} m
      </span>
    </div>

    <div class="favorite-meta">
      <span>{{ bivacco.zona }}</span>

      <span>
        {{ bivacco.postiLetto }} posti
      </span>
    </div>

    <div class="favorite-footer">
      <span class="open-label">
        Apri scheda bivacco
      </span>

      <span class="arrow">→</span>
    </div>
  </button>
</div>

  <p v-else class="empty-favorites">
    Nessun bivacco salvato nei preferiti.
  </p>
</section>

<div class="divider"></div>

    <div class="danger-zone">
      <button class="btn btn-ghost btn-block" @click="submitLogout">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        Esci
      </button>

      <button class="btn btn-danger btn-block" @click="removeAccount">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
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
.msg-info    { background: var(--accent-bg); border: 1px solid var(--accent-border); color: var(--accent-hi); }
.msg-success { background: var(--success-bg); border: 1px solid rgba(52,211,153,0.28); color: var(--success); }
.msg-error   { background: var(--danger-bg); border: 1px solid var(--danger-border); color: var(--danger); }

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

@keyframes spin { to { transform: rotate(360deg); } }

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

@media (max-width: 420px) {
  .row { grid-template-columns: 1fr; }
}

.favorites-section h3 {
  font-size: 1rem;
  margin-bottom: 10px;
}

.empty-favorites {
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
      rgba(255,255,255,0.02)
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
      rgba(255,255,255,0.04)
    );
}

.favorite-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.favorite-top h4 {
  margin: 0;
  font-size: 15px;
  line-height: 1.35;
  color: var(--text-primary);
}

.favorite-altitude {
  flex-shrink: 0;
  padding: 4px 8px;
  border-radius: var(--r-full);
  background: rgba(79,195,247,0.12);
  color: var(--accent-hi);
  font-size: 11px;
  font-weight: 600;
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
</style>
