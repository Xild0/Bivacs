<script setup>
import { reactive, ref } from 'vue'
import Modal from './Modal.vue'
import { registerUser, loginUser, richiediRecuperoPassword } from '../services/api'

const emit = defineEmits(['close', 'auth-changed'])

const mode = ref('login')
const message = ref('')
const messageType = ref('info')

const showPasswords = ref(false)

const loginForm = reactive({
  email: '',
  password: ''
})

const registerForm = reactive({
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

    if (error.codiceErrore === 'EMAIL_NON_VERIFICATA') {
      message.value = 'Devi prima verificare la tua email. Controlla la tua casella di posta.'
    } else {
      message.value = error.message
    }
  }
}

async function recoverPassword() {
  message.value = ''

  if (!loginForm.email) {
    messageType.value = 'info'
    message.value = 'Inserisci l’email nel campo qui sopra, poi clicca di nuovo "Password dimenticata?".'
    return
  }

  try {
    messageType.value = 'info'
    message.value = 'Invio della mail di recupero in corso...'
    await richiediRecuperoPassword(loginForm.email)
    messageType.value = 'success'
    message.value = 'Email di recupero inviata. Controlla la tua casella di posta.'
  } catch (error) {
    messageType.value = 'error'
    message.value = error.message
  }
}

async function submitRegister() {
  message.value = ''

  try {
    await registerUser({
      nome: registerForm.nome,
      cognome: registerForm.cognome,
      email: registerForm.email,
      password: registerForm.password,
      dataNascita: registerForm.dataNascita
    })

    messageType.value = 'success'
    message.value = 'Registrazione completata. Verifica la tua email e potrai accedere.'
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
        @click="mode = 'login'; message = ''; showPasswords = false"
      >
        Accedi
      </button>

      <button
        :class="{ active: mode === 'register' }"
        @click="mode = 'register'; message = ''; showPasswords = false"
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
        <input
          v-model="loginForm.email"
          class="input"
          type="email"
          placeholder="nome@example.it"
          required
        />
      </label>

      <label class="field">
        <span class="field-label">Password</span>
        <input
          v-model="loginForm.password"
          class="input"
          :type="showPasswords ? 'text' : 'password'"
          placeholder="Inserisci la password"
          required
        />
      </label>

      <label class="plain-check">
        <input v-model="showPasswords" type="checkbox" />
        <span>Mostra password</span>
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
          <input
            v-model="registerForm.nome"
            class="input"
            placeholder="Nome"
            required
          />
        </label>

        <label class="field">
          <span class="field-label">Cognome</span>
          <input
            v-model="registerForm.cognome"
            class="input"
            placeholder="Cognome"
            required
          />
        </label>
      </div>

      <label class="field">
        <span class="field-label">Email</span>
        <input
          v-model="registerForm.email"
          class="input"
          type="email"
          placeholder="nome@example.it"
          required
        />
      </label>

      <label class="field">
        <span class="field-label">Password</span>
        <input
          v-model="registerForm.password"
          class="input"
          :type="showPasswords ? 'text' : 'password'"
          placeholder="Minimo 8 caratteri"
          required
        />
      </label>

      <label class="plain-check">
        <input v-model="showPasswords" type="checkbox" />
        <span>Mostra password</span>
      </label>

      <label class="field">
        <span class="field-label">Data di nascita</span>
        <input
          v-model="registerForm.dataNascita"
          class="input"
          type="date"
          required
        />
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

.tabs button.active {
  color: var(--text-primary);
}

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

.plain-check {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: -4px;
  margin-bottom: 4px;
  cursor: pointer;
  user-select: none;
}

.plain-check input {
  width: 16px;
  height: 16px;
  accent-color: var(--accent);
}

.link-btn {
  background: transparent;
  color: var(--text-tertiary);
  font-size: 13px;
  padding: 8px;
  transition: color 0.2s var(--ease);
}

.link-btn:hover {
  color: var(--accent);
}

@media (max-width: 420px) {
  .row {
    grid-template-columns: 1fr;
  }
}
</style>