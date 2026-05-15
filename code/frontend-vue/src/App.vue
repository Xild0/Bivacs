<script setup>
import { ref, onMounted } from 'vue'

import Navbar from './components/Navbar.vue'
import Hero from './components/Hero.vue'
import Filters from './components/Filters.vue'
import BivaccoCard from './components/BivaccoCard.vue'
import BivaccoDetails from './components/BivaccoDetails.vue'
import BivaccoMap from './components/BivaccoMap.vue'
import EmergencyModal from './components/EmergencyModal.vue'
import AuthModal from './components/AuthModal.vue'
import ProfileModal from './components/ProfileModal.vue'
import RouteModal from './components/RouteModal.vue'
import ResetPassword from './components/ResetPassword.vue'

import { getBivacchi, getBivaccoById, isLoggedIn } from './services/api'

const bivacchi = ref([])
const viewMode = ref('list')
const selectedBivacco = ref(null)
const routeModal = ref(null)       // dati del modal del tragitto     // coordinate del tragitto calcolato
const loading = ref(true)

const showEmergency = ref(false)
const showAuth = ref(false)
const showProfile = ref(false)
const logged = ref(isLoggedIn())

const resetTokenAttivo = ref(null)
const notTemp = ref({ visible: false, type: 'info', text: ''})

async function loadBivacchi(filters = {}) {
  loading.value = true
  try {
    bivacchi.value = await getBivacchi(filters)
  } catch (error) {
    console.error(error)
    bivacchi.value = []
  } finally {
    loading.value = false
  }
}

async function openDetails(bivacco) {
  routeModal.value = null

  try {
    selectedBivacco.value = await getBivaccoById(bivacco._id)
  } catch (error) {
    console.error('Errore caricamento dettagli bivacco:', error)
    selectedBivacco.value = bivacco
  }

  if (window.innerWidth < 1100) {
    setTimeout(() => {
      document.querySelector('.details-pane')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })
    }, 60)
  }
}

function closeDetails() {
  selectedBivacco.value = null
  routeModal.value = null
}

function onRouteCalculated(result) {
  routeModal.value = {
    result,
    bivacco: selectedBivacco.value
  }
}

function onClearRoute() {
  routeModal.value = null
}

function refreshAuth() {
  logged.value = isLoggedIn()
}

/**
 * Mostra una notifica temporanea (notTemp) in sovrimpressione.
 *
 * @param {string} text testo da mostrare all'utente
 * @param {'info'|'success'|'error'} [type='info'] tipo di avviso, condiziona il colore
 * @param {number} [durata=4000] millisecondi di permanenza a schermo
 * @returns {void}
 */
function mostraNotTemp(text, type = 'info', durata = 4000) {
  notTemp.value = { visible: true, type, text }
  setTimeout(() => { notTemp.value.visible = false }, durata)
}

/**
 * All'avvio dell'app, ispeziona l'URL e gestisce
 * i due link che arrivano via email:
 *   - ?verificato=true|false  → esito verifica email
 *   - ?reset=<token>          → reset password
 *
 * @returns {void}
 */
function gestisciQueryString() {
  const params = new URLSearchParams(window.location.search)

  const verificato = params.get('verificato')
  if (verificato === 'true') {
    mostraNotTemp('Email verificata! Ora puoi accedere.', 'success')
  } else if (verificato === 'false') {
    mostraNotTemp('Link di verifica non valido o già usato.', 'error')
  }

  const reset = params.get('reset')
  if (reset) {
    resetTokenAttivo.value = reset
  }

  if (verificato || reset) {
    window.history.replaceState({}, '', window.location.pathname)
  }
}

/**
 * Handler dell'evento globale 'bivacs:auth-expired' emesso quando il backend risponde 401. 
 * Aggiorna lo stato locale di login e avvisa l'utente con una notifica temporanea.
 *
 * @returns {void}
 */
function gestisciSessioneScaduta() {
  logged.value = false
  mostraNotTemp('La tua sessione è scaduta. Effettua di nuovo l\'accesso.', 'error', 6000)
}

onMounted(() => {
  loadBivacchi()
  gestisciQueryString()
  window.addEventListener('bivacs:auth-expired', gestisciSessioneScaduta)
})


onMounted(() => {
  loadBivacchi()
})
</script>

<template>
  <div class="app">
    <Navbar
      :is-logged="logged"
      @openEmergency="showEmergency = true"
      @openAuth="showAuth = true"
      @openProfile="showProfile = true"
    />

    <Hero :bivacchi="bivacchi" />

    <main class="container main">
      <Filters @search="loadBivacchi" />

      <div class="results">
        <!-- LEFT: cards/map -->
        <section class="results-pane">
          <div class="results-head">
            <div>
              <p class="label">Risultati</p>
              <h2 class="results-title">
                {{ bivacchi.length }} <small>bivacchi trovati</small>
              </h2>
            </div>

            <div class="view-toggle" role="tablist">
              <button
                :class="{ active: viewMode === 'list' }"
                @click="viewMode = 'list'"
                role="tab"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
                Lista
              </button>

              <button
                :class="{ active: viewMode === 'map' }"
                @click="viewMode = 'map'"
                role="tab"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                  <line x1="8" y1="2" x2="8" y2="18" />
                  <line x1="16" y1="6" x2="16" y2="22" />
                </svg>
                Mappa
              </button>

              <span class="toggle-indicator" :class="viewMode"></span>
            </div>
          </div>

          <!-- Loading state -->
          <div v-if="loading" class="cards-grid">
            <div v-for="n in 4" :key="n" class="skeleton">
              <div class="skeleton-header"></div>
              <div class="skeleton-body">
                <div class="skeleton-line w-60"></div>
                <div class="skeleton-line w-40"></div>
                <div class="skeleton-line w-80"></div>
              </div>
            </div>
          </div>

          <!-- List view -->
          <div v-else-if="viewMode === 'list' && bivacchi.length > 0" class="cards-grid">
            <BivaccoCard
              v-for="bivacco in bivacchi"
              :key="bivacco._id"
              :bivacco="bivacco"
              @open="openDetails"
            />
          </div>

          <!-- Empty state -->
          <div v-else-if="viewMode === 'list' && bivacchi.length === 0" class="empty">
            <div class="empty-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <h3>Nessun bivacco trovato</h3>
            <p>Prova a modificare i filtri di ricerca o ad allargare l'area.</p>
          </div>

          <!-- Map view -->
          <BivaccoMap
          v-else
          :bivacchi="bivacchi"
          @open="openDetails"
        />
        </section>

        <!-- RIGHT: details (sticky on desktop) -->
        <aside class="details-pane">
          <BivaccoDetails
            v-if="selectedBivacco"
            :bivacco="selectedBivacco"
            @route-calculated="onRouteCalculated"
            @clear-route="onClearRoute"
          />

          <div v-else class="placeholder">
            <div class="placeholder-icon">
              <svg width="40" height="40" viewBox="0 0 60 60" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">
                <path d="M30 6 L54 52 L6 52 Z" />
                <path d="M24 50 L30 38 L36 50 Z M30 38 L30 50" stroke-linecap="round" />
              </svg>
            </div>
            <h3>Seleziona un bivacco</h3>
            <p>Clicca su una card o sulla mappa per consultare la scheda completa, pianificare il tragitto e leggere le recensioni.</p>
          </div>
        </aside>
      </div>
    </main>

    <footer class="footer">
      <div class="container footer-inner">
        <p class="footer-brand">
          <span class="dot"></span>
          Bivacs &middot; Provincia Autonoma di Trento
        </p>
        <p class="footer-credits mono">
          Gruppo 9 &middot; UniTrento &middot; Ingegneria del Software
        </p>
      </div>
    </footer>

    <!-- Modals -->
    <EmergencyModal v-if="showEmergency" @close="showEmergency = false" />
    <AuthModal
      v-if="showAuth"
      @close="showAuth = false"
      @auth-changed="refreshAuth"
    />
    <ProfileModal
      v-if="showProfile"
      @close="showProfile = false"
      @auth-changed="refreshAuth"
    />

    <RouteModal
          v-if="routeModal"
          :result="routeModal.result"
          :bivacco="routeModal.bivacco"
          @close="routeModal = null"
        />
    
    <ResetPasswordModal
      v-if="resetTokenAttivo"
      :token="resetTokenAttivo"
      @close="resetTokenAttivo = null"
      @reset-success="logged = false"
    />

    <div v-if="toast.visible" class="toast" :class="`toast-${toast.type}`">
      {{ toast.text }}
    </div>

  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  position: relative;
}

.main {
  padding-top: 60px;
  padding-bottom: 80px;
  position: relative;
  z-index: 2;
}

.results {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 420px;
  gap: 24px;
  margin-top: 40px;
}

@media (max-width: 1100px) {
  .results { grid-template-columns: 1fr; }
}

.results-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 22px;
  gap: 16px;
  flex-wrap: wrap;
}

.results-title {
  font-size: 1.6rem;
  font-family: var(--font-display);
  margin-top: 6px;
}

.results-title small {
  font-weight: 400;
  color: var(--text-tertiary);
  font-size: 0.65em;
  letter-spacing: 0;
}

.view-toggle {
  position: relative;
  display: inline-flex;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-full);
  padding: 4px;
}

.view-toggle button {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-tertiary);
  border-radius: var(--r-full);
  transition: color 0.2s var(--ease);
}

.view-toggle button.active { color: var(--text-primary); }

.toggle-indicator {
  position: absolute;
  top: 4px;
  left: 4px;
  width: calc(50% - 4px);
  height: calc(100% - 8px);
  background: var(--bg-surface-3);
  border: 1px solid var(--border);
  border-radius: var(--r-full);
  transition: transform 0.28s var(--ease-out);
  z-index: 0;
}

.toggle-indicator.map { transform: translateX(100%); }

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.skeleton {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-xl);
  overflow: hidden;
}

.skeleton-header {
  height: 132px;
  background: linear-gradient(90deg, var(--bg-surface-2), var(--bg-surface-3), var(--bg-surface-2));
  background-size: 200% 100%;
  animation: shimmer 1.6s linear infinite;
}

.skeleton-body {
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.skeleton-line {
  height: 12px;
  background: linear-gradient(90deg, var(--bg-surface-2), var(--bg-surface-3), var(--bg-surface-2));
  background-size: 200% 100%;
  animation: shimmer 1.6s linear infinite;
  border-radius: 4px;
}

.w-40 { width: 40%; }
.w-60 { width: 60%; }
.w-80 { width: 80%; }

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.empty {
  text-align: center;
  padding: 60px 30px;
  background: var(--bg-surface);
  border: 1px dashed var(--border);
  border-radius: var(--r-xl);
}

.empty-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 18px;
  border-radius: 50%;
  background: var(--bg-surface-2);
  color: var(--text-tertiary);
  display: grid;
  place-items: center;
}

.empty h3 {
  font-size: 1.2rem;
  margin-bottom: 6px;
}

.empty p {
  font-size: 14px;
  color: var(--text-tertiary);
}

.details-pane {
  position: sticky;
  top: 92px;
  max-height: calc(100vh - 112px);
  overflow-y: auto;
  scrollbar-width: thin;
}

@media (max-width: 1100px) {
  .details-pane {
    position: static;
    max-height: none;
  }
}

.placeholder {
  text-align: center;
  padding: 60px 30px;
  background: var(--bg-surface);
  border: 1px dashed var(--border);
  border-radius: var(--r-xl);
  position: relative;
  overflow: hidden;
}

.placeholder::before {
  content: '';
  position: absolute;
  top: -50%;
  left: 50%;
  transform: translateX(-50%);
  width: 300px;
  height: 300px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--accent-bg), transparent 70%);
  pointer-events: none;
}

.placeholder-icon {
  position: relative;
  width: 72px;
  height: 72px;
  margin: 0 auto 20px;
  display: grid;
  place-items: center;
  color: var(--accent);
  filter: drop-shadow(0 0 12px var(--accent-bg));
}

.placeholder h3 {
  font-size: 1.2rem;
  margin-bottom: 8px;
  position: relative;
}

.placeholder p {
  font-size: 13px;
  color: var(--text-tertiary);
  line-height: 1.6;
  max-width: 32ch;
  margin: 0 auto;
  position: relative;
}

.footer {
  border-top: 1px solid var(--border-subtle);
  padding: 30px 0;
  margin-top: 40px;
}

.footer-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.footer-brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-tertiary);
}

.footer-brand .dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
}

.footer-credits {
  font-size: 11px;
  color: var(--text-dim);
  letter-spacing: 0.06em;
}

.toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  padding: 12px 20px; border-radius: var(--r-md); font-size: 14px;
  z-index: 9999; max-width: 90vw; box-shadow: 0 8px 24px rgba(0,0,0,0.3);
}
.toast-info    { background: var(--accent-bg); border: 1px solid var(--accent-border); color: var(--accent-hi); }
.toast-success { background: var(--success-bg); border: 1px solid rgba(52,211,153,0.28); color: var(--success); }
.toast-error   { background: var(--danger-bg); border: 1px solid var(--danger-border); color: var(--danger); }

</style>
