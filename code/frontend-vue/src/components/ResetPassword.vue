<script setup>
import { reactive, ref } from 'vue'
import Modal from './Modal.vue'
import { resetPassword } from '../services/api'

/**
 * Props del componente.
 * @typedef {Object} ResetPasswordModalProps
 * @property {string} token - token monouso ricevuto dalla query string ?reset=...
 */
const props = defineProps({
  token: { type: String, required: true }
})

const emit = defineEmits(['close', 'reset-success'])

const form = reactive({
  nuovaPassword: '',
  conferma: ''
})

const message = ref('')
const messageType = ref('info')
const inCorso = ref(false)

/**
 * Invia la nuova password al backend insieme al token ricevuto via mail.
 * In caso di successo emette `reset-success` per permettere a App.vue di
 * mostrare un avviso.
 *
 * @returns {Promise<void>}
 */
async function submitReset() {
  message.value = ''

  if (form.nuovaPassword !== form.conferma) {
    messageType.value = 'error'
    message.value = 'Le due password non coincidono.'
    return
  }
  if (form.nuovaPassword.length < 8) {
    messageType.value = 'error'
    message.value = 'La password deve essere di almeno 8 caratteri.'
    return
  }

  inCorso.value = true
  try {
    await resetPassword(props.token, form.nuovaPassword)
    messageType.value = 'success'
    message.value = 'Password aggiornata! Ora puoi accedere con le nuove credenziali.'
    emit('reset-success')
    setTimeout(() => emit('close'), 1500)
  } catch (error) {
    messageType.value = 'error'
    message.value = error.message
  } finally {
    inCorso.value = false
  }
}
</script>

<template>
  <Modal
    label="Account"
    title="Imposta una nuova password"
    max-width="480px"
    @close="emit('close')"
  >
    <p v-if="message" class="msg" :class="`msg-${messageType}`">
      {{ message }}
    </p>

    <form class="form" @submit.prevent="submitReset">
      <label class="field">
        <span class="field-label">Nuova password</span>
        <input v-model="form.nuovaPassword" class="input" type="password" required />
      </label>
      <label class="field">
        <span class="field-label">Conferma password</span>
        <input v-model="form.conferma" class="input" type="password" required />
      </label>
      <button type="submit" class="btn btn-primary btn-block" :disabled="inCorso">
        {{ inCorso ? 'Aggiornamento...' : 'Aggiorna password' }}
      </button>
    </form>
  </Modal>
</template>

<style scoped>
.msg { padding: 12px 14px; border-radius: var(--r); font-size: 13px; margin-bottom: 16px; }
.msg-info    { background: var(--accent-bg); border: 1px solid var(--accent-border); color: var(--accent-hi); }
.msg-success { background: var(--success-bg); border: 1px solid rgba(52,211,153,0.28); color: var(--success); }
.msg-error   { background: var(--danger-bg); border: 1px solid var(--danger-border); color: var(--danger); }
.form { display: flex; flex-direction: column; gap: 12px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field-label {
  font-size: 11px; font-weight: 500; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--text-tertiary);
}
</style>