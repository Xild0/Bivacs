<script setup>
import { computed, ref } from 'vue'
import { aggiungiPreferito, rimuoviPreferito } from '../services/api'

const props = defineProps({
  bivacco: {
    type: Object,
    required: true
  },
  isLogged: {
    type: Boolean,
    default: false
  },
  isFavorite: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['open', 'favorite-changed'])

const initials = computed(() => {
  const words = (props.bivacco.nome || '').trim().split(/\s+/)
  return words.slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'B'
})

// Deterministic hue from the bivacco name so each card has its own gradient
const hue = computed(() => {
  const str = props.bivacco.nome || ''
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) % 360
  }
  return h
})

const rating = computed(() => Number(props.bivacco.mediaStelle) || 0)

const favoriteLoading = ref(false)

async function toggleFavorite(event) {
  event.stopPropagation()

  if (!props.isLogged || favoriteLoading.value) return

  favoriteLoading.value = true

  try {
    const data = props.isFavorite
      ? await rimuoviPreferito(props.bivacco._id)
      : await aggiungiPreferito(props.bivacco._id)

    emit('favorite-changed', data.preferiti || [])
  } catch (error) {
    console.error('Errore preferiti:', error)
  } finally {
    favoriteLoading.value = false
  }
}

</script>

<template>
  <article class="bcard" @click="emit('open', bivacco)">
    <!-- Header band with gradient + monogram -->
    <div
      class="bcard-header"
      :style="{
        background: `
          radial-gradient(120% 100% at 20% 0%, hsla(${hue}, 60%, 28%, 0.85), transparent 60%),
          radial-gradient(120% 100% at 90% 100%, rgba(79, 195, 247, 0.20), transparent 60%),
          linear-gradient(135deg, hsl(${hue}, 35%, 14%) 0%, #11151D 100%)
        `
      }"
    >
      <div class="bcard-monogram">{{ initials }}</div>

      <button
        v-if="isLogged"
        type="button"
        class="favorite-btn"
        :class="{ active: isFavorite }"
        title="Aggiungi/rimuovi dai preferiti"
        @click="toggleFavorite"
      >
        ♥
      </button>

      <!-- Topo lines decoration -->
      <svg class="topo" viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0,80 Q50,60 100,70 T200,55" stroke="currentColor" stroke-width="0.5" fill="none" opacity="0.4" />
        <path d="M0,90 Q50,72 100,82 T200,68" stroke="currentColor" stroke-width="0.5" fill="none" opacity="0.3" />
        <path d="M0,65 Q50,48 100,58 T200,42" stroke="currentColor" stroke-width="0.5" fill="none" opacity="0.5" />
      </svg>

      <span v-if="bivacco.emergenza" class="danger-badge" aria-label="Emergenza segnalata">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </span>
    </div>

    <div class="bcard-body">
      <h3>{{ bivacco.nome }}</h3>
      <p class="zona">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        {{ bivacco.zona }}
      </p>

      <div class="stats">
        <div class="stat">
          <span class="stat-num mono">{{ bivacco.altitudine }}</span>
          <span class="stat-unit">m</span>
        </div>
        <div class="stat">
          <span class="stat-num mono">{{ bivacco.postiLetto }}</span>
          <span class="stat-unit">posti</span>
        </div>
        <div class="stat rating">
          <div class="stars" :aria-label="`Valutazione ${rating} su 5`">
            <span v-for="n in 5" :key="n" :class="{ filled: n <= Math.round(rating) }">★</span>
          </div>
          <span class="stat-unit">{{ rating ? rating.toFixed(1) : '—' }}</span>
        </div>
      </div>

      <p v-if="bivacco.dotazioni" class="dotazioni">
        {{ bivacco.dotazioni }}
      </p>

      <div class="resources">
        <span class="chip" :class="bivacco.acquaPresente ? 'chip-ok' : 'chip-ko'">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
          </svg>
          Acqua
        </span>
        <span class="chip" :class="bivacco.legnaDisponibile ? 'chip-ok' : 'chip-ko'">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 21l3-9 6-6 9 3-3 9-6 6z" />
            <path d="M9 12l6-6" />
          </svg>
          Legna
        </span>
        <span v-if="bivacco.ticketAperti" class="chip chip-warning">
          Ticket aperti
          <span v-if="bivacco.numeroTicketAperti">({{ bivacco.numeroTicketAperti }})</span>
        </span>
      </div>

      <div class="bcard-cta">
        <span>Apri scheda</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </div>
    </div>
  </article>
</template>

<style scoped>
.bcard {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-xl);
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.3s var(--ease-out), border-color 0.25s var(--ease), box-shadow 0.3s var(--ease);
  position: relative;
}

.bcard:hover {
  transform: translateY(-4px);
  border-color: var(--border-strong);
  box-shadow: var(--shadow-md);
}

.bcard:hover .bcard-cta {
  color: var(--accent);
}

.bcard:hover .bcard-cta svg {
  transform: translateX(4px);
}

/* —— Header band —— */
.bcard-header {
  position: relative;
  height: 132px;
  overflow: hidden;
  border-bottom: 1px solid var(--border-subtle);
}

.bcard-monogram {
  position: absolute;
  bottom: 14px;
  left: 18px;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 3.5rem;
  letter-spacing: -0.05em;
  color: rgba(255, 255, 255, 0.92);
  line-height: 1;
  text-shadow: 0 2px 20px rgba(0, 0, 0, 0.45);
}

.topo {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  color: rgba(255, 255, 255, 0.3);
}

.danger-badge {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 32px;
  height: 32px;
  border-radius: var(--r-full);
  background: var(--danger-strong);
  color: white;
  display: grid;
  place-items: center;
  box-shadow: 0 0 0 4px rgba(248, 113, 113, 0.2), 0 8px 18px rgba(0, 0, 0, 0.4);
  animation: pulseGlow 2.5s infinite;
}

/* —— Body —— */
.bcard-body {
  padding: 22px;
}

h3 {
  font-size: 1.4rem;
  font-weight: 600;
  margin-bottom: 6px;
  letter-spacing: -0.02em;
}

.zona {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-tertiary);
  font-size: 13px;
  margin-bottom: 18px;
}

/* —— Stats —— */
.stats {
  display: flex;
  gap: 16px;
  padding: 14px 0;
  border-top: 1px solid var(--border-subtle);
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: 14px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat:not(:last-child) {
  padding-right: 16px;
  border-right: 1px solid var(--border-subtle);
}

.stat-num {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.stat-unit {
  font-size: 11px;
  color: var(--text-tertiary);
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.rating { margin-left: auto; align-items: flex-end; }
.rating .stat-unit { font-family: var(--font-mono); }

.stars {
  display: flex;
  gap: 1px;
  font-size: 14px;
  color: var(--text-dim);
  line-height: 1;
}
.stars .filled { color: #FBBF24; }

/* —— Dotazioni —— */
.dotazioni {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.55;
  margin-bottom: 14px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* —— Resources —— */
.resources {
  display: flex;
  gap: 8px;
  margin-bottom: 18px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: var(--r-full);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.chip-ok {
  background: var(--success-bg);
  color: var(--success);
}

.chip-ko {
  background: var(--bg-surface-2);
  color: var(--text-tertiary);
  opacity: 0.7;
}

.chip-ko svg { opacity: 0.5; }

/* —— CTA —— */
.bcard-cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  transition: color 0.2s var(--ease);
}

.bcard-cta svg {
  transition: transform 0.25s var(--ease-out);
}

.favorite-btn {
  position: absolute;
  top: 14px;
  left: 14px;
  width: 34px;
  height: 34px;
  border-radius: var(--r-full);
  background: rgba(15, 17, 23, 0.75);
  border: 1px solid var(--border);
  color: var(--text-tertiary);
  font-size: 18px;
  display: grid;
  place-items: center;
  z-index: 2;
  transition: all 0.18s var(--ease);
}

.favorite-btn:hover,
.favorite-btn.active {
  color: var(--danger);
  background: var(--danger-bg);
  border-color: var(--danger-border);
}

.chip-warning {
  background: var(--warning-bg);
  color: var(--warning);
}
</style>
