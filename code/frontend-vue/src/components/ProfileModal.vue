<script setup>
import { reactive, ref, onMounted } from 'vue'
import Modal from './Modal.vue'
import { getProfile, updateProfile, deleteProfile, logoutUser } from '../services/api'

const emit = defineEmits(['close', 'auth-changed'])

const profile = reactive({
  nome: '',
  cognome: '',
  email: '',
  password: ''
})

const message = ref('')
const messageType = ref('info')
const loaded = ref(false)

async function loadProfile() {
  try {
    const data = await getProfile()
    profile.nome = data.nome || ''
    profile.cognome = data.cognome || ''
    profile.email = data.email || ''
    profile.password = ''
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

async function removeAccount() {
  const conferma = confirm('Sei sicura di voler eliminare definitivamente il tuo account?')
  if (!conferma) return

  try {
    await deleteProfile()
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
</style>
