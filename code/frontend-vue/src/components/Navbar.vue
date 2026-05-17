/**
 * @file Navbar.vue
 * @description Barra di navigazione principale dell'applicazione.
 * Mostra accesso/profilo, pulsante SOS e cambia stile durante lo scroll.
 */

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import Logo from './Logo.vue'

defineProps({
  isLogged: { type: Boolean, default: false }
})

const emit = defineEmits(['openEmergency', 'openAuth', 'openProfile'])

const scrolled = ref(false)

/**
 * Aggiorna lo stato della navbar in base alla posizione di scroll.
 *
 * @returns {void}
 */

function onScroll() {
  scrolled.value = window.scrollY > 12
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <nav class="navbar" :class="{ 'is-scrolled': scrolled }">
    <div class="container nav-inner">
      <Logo :size="34" />

      <div class="nav-right">
        <button
          v-if="!isLogged"
          class="nav-btn"
          @click="emit('openAuth')"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          Accedi
        </button>

        <button
          v-else
          class="nav-btn"
          @click="emit('openProfile')"
        >
          <span class="profile-dot"></span>
          Profilo
        </button>

        <button
          class="sos-button"
          @click="emit('openEmergency')"
          aria-label="Emergenza"
        >
          <span class="sos-pulse"></span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          SOS 112
        </button>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.navbar {
  position: sticky;
  top: 0;
  z-index: 1000;
  background: transparent;
  transition: background 0.25s var(--ease), border-color 0.25s var(--ease), backdrop-filter 0.25s var(--ease);
  border-bottom: 1px solid transparent;
}

.navbar.is-scrolled {
  background: rgba(8, 9, 12, 0.78);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom-color: var(--border-subtle);
}

.nav-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 18px;
  padding-bottom: 18px;
}

.nav-right {
  display: flex;
  gap: 10px;
  align-items: center;
}

.nav-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-full);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  transition: all 0.18s var(--ease);
}

.nav-btn:hover {
  color: var(--text-primary);
  background: var(--bg-surface-2);
  border-color: var(--border);
}

.profile-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--success);
  box-shadow: 0 0 8px var(--success);
}

.sos-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  border-radius: var(--r-full);
  color: var(--danger);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  transition: all 0.18s var(--ease);
}

.sos-button:hover {
  background: rgba(248, 113, 113, 0.22);
  color: #FCA5A5;
}

.sos-pulse {
  position: absolute;
  left: 14px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--danger-strong);
  animation: pulseGlow 2s infinite;
}

.sos-button svg {
  margin-left: 16px;
}

@media (max-width: 520px) {
  .nav-btn { display: none; }
}
</style>
