/**
 * @file Modal.vue
 * @description Componente modale riutilizzabile.
 * Gestisce apertura, chiusura tramite click esterno e chiusura con tasto Escape.
 */

<script setup>
import { onMounted, onUnmounted } from 'vue'

const props = defineProps({
  title: { type: String, default: '' },
  label: { type: String, default: '' },
  maxWidth: { type: String, default: '520px' }
})

const emit = defineEmits(['close'])

/**
 * Chiude la modale quando viene premuto il tasto Escape.
 *
 * @param {KeyboardEvent} e - Evento tastiera.
 * @returns {void}
 */

function onKeyDown(e) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
  document.body.style.overflow = 'hidden'
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div
      class="modal"
      role="dialog"
      aria-modal="true"
      :style="{ maxWidth }"
    >
      <header class="modal-header">
        <div>
          <p v-if="label" class="label">{{ label }}</p>
          <h2 v-if="title">{{ title }}</h2>
        </div>

        <button
          class="modal-close"
          aria-label="Chiudi"
          @click="emit('close')"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="6" y1="18" x2="18" y2="6" />
          </svg>
        </button>
      </header>

      <div class="modal-body">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(4, 5, 8, 0.72);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 3000;
  padding: 24px;
  animation: fadeIn 0.25s var(--ease-out);
}

.modal {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--r-2xl);
  width: 100%;
  max-height: calc(100vh - 48px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-lg);
  animation: modalIn 0.35s var(--ease-out);
  position: relative;
}

.modal::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--accent-border), transparent);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 24px 24px 0;
  gap: 16px;
}

.modal-header h2 {
  margin-top: 4px;
}

.modal-close {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: var(--r);
  color: var(--text-tertiary);
  background: var(--bg-surface-2);
  border: 1px solid var(--border-subtle);
  transition: all 0.18s var(--ease);
}

.modal-close:hover {
  color: var(--text-primary);
  background: var(--bg-surface-3);
  border-color: var(--border);
}

.modal-body {
  padding: 20px 24px 24px;
  overflow-y: auto;
}
</style>
