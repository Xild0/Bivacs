/**
 * @file EmergencyModal.vue
 * @description Modale informativa per emergenze alpine e numeri utili.
 */

<script setup>
import Modal from './Modal.vue'

async function attivaAllarme() {
  try {
    const msg = {msg:'Struttura inagibile'};
    await getApi.post('/api/v1/bivacchi/${bivacco.id}/emergenza', msg);
  } catch (error){
    console.error(error);
  }
}

async function disattivaAllarme() {
  try  {
    await getApi.delete('/api/v1/bivacchi/${bivacco.id}/emergenza');
  } catch (error){
    console.error(error);
  }
}

const emit = defineEmits(['close'])
</script>

<template>
  <Modal
    label="Sicurezza alpina"
    title="Emergenza in montagna"
    max-width="480px"
    @close="emit('close')"
  >
    <p class="intro">
      Comunica immediatamente <strong>posizione</strong>, numero di persone coinvolte e
      condizioni meteo. Resta calma, non muovere i feriti, attendi i soccorsi.
    </p>

    <div class="numbers">
      <a href="tel:112" class="number-card">
        <span class="num mono">112</span>
        <span class="desc">Numero unico emergenze</span>
        <svg class="phone" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      </a>

      <a href="tel:118" class="number-card">
        <span class="num mono">118</span>
        <span class="desc">Soccorso sanitario e alpino</span>
        <svg class="phone" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      </a>
    </div>

    <div class="tips">
      <h4>Cosa comunicare</h4>
      <ul>
        <li>Posizione GPS o riferimenti precisi</li>
        <li>Numero di persone coinvolte</li>
        <li>Condizioni dei feriti</li>
        <li>Meteo e visibilità sul posto</li>
        <li>Numero da cui chiami</li>
      </ul>
    </div>

    <button class="btn btn-ghost btn-block" @click="emit('close')">
      Chiudi
    </button>
  </Modal>
</template>

<style scoped>
.intro {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 22px;
  line-height: 1.6;
}

.intro strong { color: var(--text-primary); }

.numbers {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 22px;
}

.number-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 20px;
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  border-radius: var(--r-md);
  color: var(--text-primary);
  text-decoration: none;
  transition: all 0.2s var(--ease);
  overflow: hidden;
}

.number-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--danger), transparent);
  animation: pulseGlow 2s infinite;
}

.number-card:hover {
  background: rgba(248, 113, 113, 0.22);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.num {
  font-family: var(--font-display);
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--danger);
  letter-spacing: -0.04em;
  line-height: 1;
}

.desc {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

.phone {
  position: absolute;
  top: 18px;
  right: 18px;
  color: var(--danger);
  opacity: 0.6;
}

.tips {
  padding: 16px;
  background: var(--bg-surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-md);
  margin-bottom: 18px;
}

.tips h4 {
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
  color: var(--text-primary);
}

.tips ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tips li {
  position: relative;
  padding-left: 18px;
  font-size: 13px;
  color: var(--text-secondary);
}

.tips li::before {
  content: '';
  position: absolute;
  left: 4px;
  top: 8px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 6px var(--accent);
}

@media (max-width: 420px) {
  .numbers { grid-template-columns: 1fr; }
}
</style>
