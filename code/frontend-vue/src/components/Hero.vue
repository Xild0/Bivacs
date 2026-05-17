/**
 * @file Hero.vue
 * @description Hero section principale della homepage Bivacs.
 */

<script setup>
import { computed } from 'vue'

const props = defineProps({
  bivacchi: {
    type: Array,
    default: () => []
  }
})

/**
 * Calcola statistiche generali sui bivacchi caricati.
 */

const stats = computed(() => {
  const count = props.bivacchi.length
  const zones = new Set(props.bivacchi.map(b => b.zona).filter(Boolean)).size
  const ratings = props.bivacchi
    .map(b => Number(b.mediaStelle) || 0)
    .filter(r => r > 0)
  const avg = ratings.length
    ? (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1)
    : '—'

  return [
    { value: count || '—', label: 'Bivacchi catalogati' },
    { value: zones || '—',  label: 'Zone alpine' },
  ]
})
</script>

<template>
  <section class="hero">
    <!-- Layered SVG background -->
    <div class="hero-bg" aria-hidden="true">
      <!-- Stars -->
      <svg class="stars" viewBox="0 0 1440 600" preserveAspectRatio="none">
        <g fill="#F4F5F7">
          <circle cx="120"  cy="80"  r="0.8" opacity="0.7" />
          <circle cx="280"  cy="140" r="1.1" opacity="0.85" />
          <circle cx="410"  cy="60"  r="0.6" opacity="0.5" />
          <circle cx="560"  cy="180" r="0.8" opacity="0.7" />
          <circle cx="700"  cy="50"  r="1.2" opacity="0.95" />
          <circle cx="820"  cy="130" r="0.7" opacity="0.6" />
          <circle cx="960"  cy="80"  r="0.9" opacity="0.8" />
          <circle cx="1080" cy="180" r="0.6" opacity="0.55" />
          <circle cx="1220" cy="100" r="1.1" opacity="0.9" />
          <circle cx="1360" cy="160" r="0.7" opacity="0.6" />
          <circle cx="180"  cy="220" r="0.7" opacity="0.6" />
          <circle cx="640"  cy="240" r="0.8" opacity="0.7" />
          <circle cx="1140" cy="260" r="0.6" opacity="0.5" />
        </g>
      </svg>

      <!-- Moon glow -->
      <div class="moon-glow"></div>

      <!-- Mountain layers — far to near -->
      <svg class="mountains layer-1" viewBox="0 0 1440 400" preserveAspectRatio="none">
        <path
          d="M0,400 L0,260 L120,200 L240,250 L360,180 L480,230 L600,170 L720,210 L840,160 L960,220 L1080,180 L1200,230 L1320,190 L1440,240 L1440,400 Z"
          fill="#10141C"
        />
      </svg>

      <svg class="mountains layer-2" viewBox="0 0 1440 400" preserveAspectRatio="none">
        <path
          d="M0,400 L0,300 L100,240 L220,290 L340,210 L460,270 L580,200 L700,260 L820,190 L940,250 L1060,210 L1180,270 L1300,220 L1440,260 L1440,400 Z"
          fill="#161C28"
        />
      </svg>

      <svg class="mountains layer-3" viewBox="0 0 1440 400" preserveAspectRatio="none">
        <path
          d="M0,400 L0,330 L140,260 L280,320 L420,240 L560,310 L700,230 L840,290 L980,250 L1120,310 L1260,260 L1440,300 L1440,400 Z"
          fill="#1B2230"
        />
      </svg>

      <!-- Front mountain with snow caps + main peak echoing the logo -->
      <svg class="mountains layer-4" viewBox="0 0 1440 400" preserveAspectRatio="none">
        <defs>
          <linearGradient id="frontRange" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#222A38" />
            <stop offset="100%" stop-color="#10141C" />
          </linearGradient>
        </defs>
        <path
          d="M0,400 L0,360 L160,300 L320,340 L500,230 L640,310 L820,180 L960,300 L1100,260 L1260,320 L1440,290 L1440,400 Z"
          fill="url(#frontRange)"
        />
        <!-- Snow on the highest peak (the one at x=820, y=180) -->
        <path
          d="M790,210 L820,180 L840,200 L835,210 L820,205 L810,215 L800,210 Z"
          fill="#E9F4FB"
          opacity="0.85"
        />
        <!-- Snow on the second peak (x=500, y=230) -->
        <path
          d="M482,250 L500,230 L515,247 L508,254 L500,250 L492,256 Z"
          fill="#E9F4FB"
          opacity="0.7"
        />
      </svg>
    </div>

    <!-- Foreground content -->
    <div class="container hero-content">
      <p class="hero-label fade-up" style="animation-delay: 0.05s">
        <span class="dot"></span>
        Provincia Autonoma di Trento
      </p>

      <h1 class="hero-title fade-up" style="animation-delay: 0.15s">
        Esplora i bivacchi
        <span class="accent-line">del Trentino.</span>
      </h1>

      <p class="hero-sub fade-up" style="animation-delay: 0.28s">
        Pianifica escursioni, consulta risorse alpine, monitora la sicurezza in quota.
        Una piattaforma cartografica per chi vive la montagna.
      </p>

      <div class="hero-stats fade-up" style="animation-delay: 0.42s">
        <div
          v-for="(s, i) in stats"
          :key="i"
          class="stat"
        >
          <span class="stat-value mono">{{ s.value }}</span>
          <span class="stat-label">{{ s.label }}</span>
        </div>
      </div>
    </div>

    <!-- Scroll indicator -->
    <div class="scroll-cue fade-up" style="animation-delay: 0.7s" aria-hidden="true">
      <span></span>
    </div>
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  min-height: clamp(560px, 88vh, 820px);
  overflow: hidden;
  display: flex;
  align-items: center;
  isolation: isolate;
  margin-top: -76px; /* let the hero pass behind the transparent navbar */
  padding-top: 76px;
}

/* —— Background atmosphere —— */
.hero-bg {
  position: absolute;
  inset: 0;
  z-index: -1;
  background:
    radial-gradient(ellipse 80% 50% at 70% 20%, rgba(79, 195, 247, 0.08), transparent 60%),
    linear-gradient(180deg, #0A0D14 0%, #08090C 50%, #06070A 100%);
}

.stars {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 60%;
  opacity: 0.85;
}

.moon-glow {
  position: absolute;
  top: 12%;
  right: 12%;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #E9F4FB;
  box-shadow:
    0 0 12px rgba(233, 244, 251, 0.8),
    0 0 40px rgba(125, 216, 255, 0.4),
    0 0 90px rgba(79, 195, 247, 0.25);
}

.mountains {
  position: absolute;
  left: 0;
  right: 0;
  width: 100%;
  display: block;
}

.layer-1 { bottom: 0; height: 55%; opacity: 0.7; }
.layer-2 { bottom: 0; height: 50%; opacity: 0.85; }
.layer-3 { bottom: 0; height: 45%; }
.layer-4 { bottom: 0; height: 40%; }

/* —— Foreground content —— */
.hero-content {
  position: relative;
  z-index: 2;
  padding-top: 60px;
  padding-bottom: 100px;
}

.hero-label {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--accent);
  padding: 8px 14px;
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  border-radius: var(--r-full);
  margin-bottom: 28px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
}

.hero-title {
  font-family: var(--font-display);
  font-size: clamp(2.75rem, 7vw, 5.5rem);
  font-weight: 700;
  letter-spacing: -0.04em;
  line-height: 1.02;
  margin-bottom: 28px;
  max-width: 14ch;
  background: linear-gradient(180deg, #FFFFFF 0%, #B8C2D0 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.accent-line {
  display: block;
  background: linear-gradient(120deg, #7DD8FF 0%, #4FC3F7 50%, #2A8FB8 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-style: italic;
  font-weight: 600;
}

.hero-sub {
  max-width: 56ch;
  font-size: clamp(1rem, 1.4vw, 1.15rem);
  color: var(--text-secondary);
  line-height: 1.65;
  margin-bottom: 56px;
}

.hero-stats {
  display: flex;
  gap: clamp(20px, 4vw, 60px);
  flex-wrap: wrap;
  padding-top: 32px;
  border-top: 1px solid var(--border-subtle);
  max-width: 720px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat-value {
  font-family: var(--font-mono);
  font-size: clamp(1.75rem, 3vw, 2.5rem);
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
}

.stat-label {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

/* —— Scroll cue —— */
.scroll-cue {
  position: absolute;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 38px;
  border: 1.5px solid var(--border-strong);
  border-radius: 12px;
  display: grid;
  place-items: start center;
  padding-top: 6px;
  z-index: 2;
}

.scroll-cue span {
  display: block;
  width: 2px;
  height: 8px;
  background: var(--accent);
  border-radius: 2px;
  animation: scrollDot 1.8s ease-in-out infinite;
  box-shadow: 0 0 6px var(--accent);
}

@keyframes scrollDot {
  0%   { transform: translateY(0);  opacity: 1; }
  50%  { transform: translateY(12px); opacity: 0.3; }
  100% { transform: translateY(0);  opacity: 1; }
}

@media (max-width: 640px) {
  .hero { min-height: 720px; }
  .hero-stats { gap: 24px; }
  .scroll-cue { display: none; }
}
</style>
