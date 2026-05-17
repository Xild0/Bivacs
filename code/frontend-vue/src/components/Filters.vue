/**
 * @file Filters.vue
 * @description Pannello filtri per ricerca bivacchi.
 */

<script setup>
import { reactive, computed } from 'vue'

const props = defineProps({
  bivacchi: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['search'])

const filters = reactive({
  nome: '',
  zona: '',
  altitudineMin: '',
  altitudineMax: '',
  postiLetto: ''
})

const suggerimentiNome = computed(() => {
  const q = filters.nome.trim().toLowerCase()

  if (q.length === 0) return []

  return props.bivacchi
    .filter(b => {
      const nomePulito = (b.nome || '')
        .replace(/^bivacco\s+/i, '')
        .toLowerCase()

      return nomePulito.startsWith(q)
    })
    .slice(0, 6)
})

/**
 * Seleziona un suggerimento automatico del nome bivacco.
 *
 * @param {string} nome - Nome selezionato.
 * @returns {void}
 */

function selezionaNome(nome) {
  filters.nome = nome
  submitSearch()
}

/**
 * Invia i filtri di ricerca al componente padre.
 *
 * @returns {void}
 */

function submitSearch() {
  emit('search', { ...filters })
}

/**
 * Ripristina tutti i filtri di ricerca.
 *
 * @returns {void}
 */

function resetFilters() {
  Object.keys(filters).forEach(k => { filters[k] = '' })
  emit('search', {})
}
</script>

<template>
  <section class="filters card card-header-glow">
    <div class="filters-head">
      <div>
        <p class="label">Ricerca</p>
        <h2>Filtra i bivacchi</h2>
      </div>

      <button class="reset-btn" @click="resetFilters">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 12a9 9 0 1 0 9-9" />
          <polyline points="3 4 3 12 11 12" />
        </svg>
        Reset
      </button>
    </div>

    <form class="filters-grid" @submit.prevent="submitSearch">
      <label class="field">
        <span class="field-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>
        <input v-model="filters.nome" class="input field-input" placeholder="Nome bivacco" />
        
        <div v-if="suggerimentiNome.length" class="suggestions">
          <button
            v-for="b in suggerimentiNome"
            :key="b._id"
            type="button"
            class="suggestion"
            @click="selezionaNome(b.nome)"
          >
            {{ b.nome }}
          </button>
        </div>

      </label>

      <label class="field">
        <span class="field-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </span>
        <input v-model="filters.zona" class="input field-input" placeholder="Zona" />
      </label>

      <label class="field">
        <span class="field-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 3 18 9" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </span>
        <input v-model="filters.altitudineMin" type="number" class="input field-input" placeholder="Quota min (m)" />
      </label>

      <label class="field">
        <span class="field-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 15 12 21 18 15" />
            <line x1="12" y1="21" x2="12" y2="9" />
          </svg>
        </span>
        <input v-model="filters.altitudineMax" type="number" class="input field-input" placeholder="Quota max (m)" />
      </label>

      <label class="field">
        <span class="field-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 4v16" />
            <path d="M2 8h18a2 2 0 0 1 2 2v10" />
            <path d="M2 17h20" />
            <path d="M6 8v9" />
          </svg>
        </span>
        <input v-model="filters.postiLetto" type="number" class="input field-input" placeholder="Posti letto min" />
      </label>

      <button type="submit" class="btn btn-primary search-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        Cerca
      </button>
    </form>
  </section>
</template>

<style scoped>
.filters {
  padding: 28px;
}

.filters-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 22px;
  gap: 16px;
}

.filters-head h2 {
  margin-top: 6px;
  font-size: 1.5rem;
}

.reset-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-tertiary);
  padding: 8px 14px;
  border-radius: var(--r-full);
  border: 1px solid var(--border-subtle);
  background: transparent;
  transition: all 0.18s var(--ease);
}

.reset-btn:hover {
  color: var(--text-primary);
  border-color: var(--border);
  background: var(--bg-surface-2);
}

.filters-grid {
  display: grid;
  grid-template-columns: 2fr 1.4fr 1fr 1fr 1.2fr auto;
  gap: 10px;
}

.field {
  position: relative;
  display: block;
}

.field-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary);
  pointer-events: none;
  display: grid;
  place-items: center;
}

.field-input {
  padding-left: 38px;
}

.search-btn {
  padding-left: 22px;
  padding-right: 22px;
}

@media (max-width: 1100px) {
  .filters-grid {
    grid-template-columns: 1fr 1fr;
  }
  .search-btn {
    grid-column: 1 / -1;
  }
}

@media (max-width: 520px) {
  .filters-grid {
    grid-template-columns: 1fr;
  }
}


.suggestions {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 50;
  background: var(--bg-surface-2);
  border: 1px solid var(--border);
  border-radius: var(--r);
  box-shadow: var(--shadow-md);
  overflow: hidden;
}

.suggestion {
  width: 100%;
  padding: 10px 14px 10px 38px;
  text-align: left;
  color: var(--text-secondary);
  font-size: 13px;
  background: transparent;
}

.suggestion:hover {
  background: var(--bg-surface-3);
  color: var(--text-primary);
}
</style>
