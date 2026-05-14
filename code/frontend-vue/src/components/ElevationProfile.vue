<script setup>
import { computed } from 'vue'

const props = defineProps({
  // Array di { distance: metri, elevation: metri }
  profile: {
    type: Array,
    required: true
  }
})

const stats = computed(() => {
  if (props.profile.length === 0) return null
  const elevs = props.profile.map(p => p.elevation)
  const dists = props.profile.map(p => p.distance)
  return {
    minE: Math.min(...elevs),
    maxE: Math.max(...elevs),
    maxD: Math.max(...dists)
  }
})

const paths = computed(() => {
  if (!stats.value) return { line: '', area: '' }
  const { minE, maxE, maxD } = stats.value
  const W = 400
  const H = 120
  const padTop = 12
  const padBot = 8
  const usableH = H - padTop - padBot
  const yRange = (maxE - minE) || 1

  const pts = props.profile.map(p => {
    const x = maxD ? (p.distance / maxD) * W : 0
    const y = H - padBot - ((p.elevation - minE) / yRange) * usableH
    return [x, y]
  })

  const linePath = pts.length
    ? 'M' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')
    : ''

  const areaPath = pts.length
    ? `${linePath} L${W},${H} L0,${H} Z`
    : ''

  return { line: linePath, area: areaPath }
})
</script>

<template>
  <div v-if="stats" class="elevation">
    <svg viewBox="0 0 400 120" class="elevation-svg" preserveAspectRatio="none">
      <defs>
        <linearGradient id="elevFillDyn" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#4FC3F7" stop-opacity="0.55" />
          <stop offset="100%" stop-color="#4FC3F7" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="elevLineDyn" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stop-color="#7DD8FF" />
          <stop offset="100%" stop-color="#4FC3F7" />
        </linearGradient>
      </defs>

      <!-- Grid -->
      <line x1="0" y1="30" x2="400" y2="30" stroke="#1A1E27" stroke-width="1" stroke-dasharray="2 4" />
      <line x1="0" y1="60" x2="400" y2="60" stroke="#1A1E27" stroke-width="1" stroke-dasharray="2 4" />
      <line x1="0" y1="90" x2="400" y2="90" stroke="#1A1E27" stroke-width="1" stroke-dasharray="2 4" />

      <path :d="paths.area" fill="url(#elevFillDyn)" />
      <path
        :d="paths.line"
        fill="none"
        stroke="url(#elevLineDyn)"
        stroke-width="2"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
    </svg>

    <div class="elev-axis mono">
      <span>{{ Math.round(stats.minE) }} m</span>
      <span>{{ Math.round(stats.maxE) }} m</span>
    </div>
  </div>
</template>

<style scoped>
.elevation {
  margin-top: 4px;
}

.elevation-svg {
  width: 100%;
  height: 140px;
  display: block;
  background: var(--bg-surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-md);
}

.elev-axis {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 6px;
}
</style>