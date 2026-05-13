<script setup>
import { reactive, ref } from 'vue'
import Modal from './Modal.vue'
import { registerUser, loginUser } from '../services/api'

const emit = defineEmits(['close', 'auth-changed'])

const mode = ref('login')
const message = ref('')
const messageType = ref('info') // 'info' | 'error' | 'success'

const loginForm = reactive({
  email: '',
  password: ''
})

const registerForm = reactive({
  id: '',
  nome: '',
  cognome: '',
  email: '',
  password: '',
  dataNascita: ''
})

async function submitLogin() {
  message.value = ''
  try {
    await loginUser(loginForm)
    messageType.value = 'success'
    message.value = 'Accesso effettuato. Benvenuta.'
    emit('auth-changed')
    setTimeout(() => emit('close'), 700)
  } catch (error) {
    messageType.value = 'error'
    message.value = error.message
  }
}

function recoverPassword() {
  messageType.value = 'info'
  message.value = 'Ti invieremo un\'email con il link per reimpostare la password.'
}

async function submitRegister() {
  message.value = ''
  try {
    await registerUser({
      id: Number(registerForm.id),
      nome: registerForm.nome,
      cognome: registerForm.cognome,
      email: registerForm.email,
      password: registerForm.password,
      dataNascita: registerForm.dataNascita
    })

    messageType.value = 'success'
    message.value = 'Registrazione completata. Ora puoi accedere.'
    mode.value = 'login'
  } catch (error) {
    messageType.value = 'error'
    message.value = error.message
  }
}
</script>

<template>
  <Modal
    label="Account"
    :title="mode === 'login' ? 'Accedi a Bivacs' : 'Crea il tuo account'"
    max-width="480px"
    @close="emit('close')"
  >
    <div class="tabs">
      <button
        :class="{ active: mode === 'login' }"
        @click="mode = 'login'; message = ''"
      >
        Accedi
      </button>
      <button
        :class="{ active: mode === 'register' }"
        @click="mode = 'register'; message = ''"
      >
        Registrati
      </button>
      <span class="tab-indicator" :class="mode"></span>
    </div>

    <p v-if="message" class="msg" :class="`msg-${messageType}`">
      {{ message }}
    </p>

    <!-- LOGIN -->
    <form v-if="mode === 'login'" class="form" @submit.prevent="submitLogin">
      <label class="field">
        <span class="field-label">Email</span>
        <input v-model="loginForm.email" class="input" type="email" placeholder="nome@example.it" required />
      </label>

      <label class="field">
        <span class="field-label">Password</span>
        <input v-model="loginForm.password" class="input" type="password" placeholder="••••••••" required />
      </label>

      <button type="submit" class="btn btn-primary btn-block">
        Accedi
      </button>

      <button type="button" class="link-btn" @click="recoverPassword">
        Password dimenticata?
      </button>
    </form>

    <!-- REGISTER -->
    <form v-else class="form" @submit.prevent="submitRegister">
      <div class="row">
        <label class="field">
          <span class="field-label">Nome</span>
          <input v-model="registerForm.nome" class="input" required />
        </label>
        <label class="field">
          <span class="field-label">Cognome</span>
          <input v-model="registerForm.cognome" class="input" required />
        </label>
      </div>

      <label class="field">
        <span class="field-label">ID utente</span>
        <input v-model="registerForm.id" class="input mono" type="number" placeholder="Es. 1024" required />
      </label>

      <label class="field">
        <span class="field-label">Email</span>
        <input v-model="registerForm.email" class="input" type="email" placeholder="nome@example.it" required />
      </label>

      <label class="field">
        <span class="field-label">Password</span>
        <input v-model="registerForm.password" class="input" type="password" placeholder="Minimo 8 caratteri" required />
      </label>

      <label class="field">
        <span class="field-label">Data di nascita</span>
        <input v-model="registerForm.dataNascita" class="input" type="date" required />
      </label>

      <button type="submit" class="btn btn-primary btn-block">
        Crea account
      </button>
    </form>
  </Modal>
</template>

<style scoped>
.tabs {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: var(--bg-surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-md);
  padding: 4px;
  margin-bottom: 22px;
}

.tabs button {
  position: relative;
  z-index: 1;
  padding: 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-tertiary);
  transition: color 0.2s var(--ease);
}

.tabs button.active { color: var(--text-primary); }

.tab-indicator {
  position: absolute;
  top: 4px;
  left: 4px;
  width: calc(50% - 4px);
  height: calc(100% - 8px);
  background: var(--bg-surface-3);
  border: 1px solid var(--border);
  border-radius: calc(var(--r-md) - 4px);
  transition: transform 0.28s var(--ease-out);
  z-index: 0;
}

.tab-indicator.register {
  transform: translateX(100%);
}

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

.link-btn {
  background: transparent;
  color: var(--text-tertiary);
  font-size: 13px;
  padding: 8px;
  transition: color 0.2s var(--ease);
}

.link-btn:hover { color: var(--accent); }

@media (max-width: 420px) {
  .row { grid-template-columns: 1fr; }
}
</style>
