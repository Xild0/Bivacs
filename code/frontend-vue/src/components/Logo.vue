/**
 * @file Logo.vue
 * @description Componente grafico per visualizzare il logo dell'applicazione Bivacs.
 */

<script setup>
defineProps({
  size: {
    type: Number,
    default: 36
  },
  showWordmark: {
    type: Boolean,
    default: true
  }
})
</script>

<template>
  <div class="logo" :style="{ '--logo-size': size + 'px' }">
    <img
      src="/logoBivacs.jpeg"
      alt="Bivacs Logo"
      class="logo-image"
    />
  </div>
</template>

<style scoped>
.logo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  user-select: none;
}

.logo-mark {
  flex-shrink: 0;
  filter: drop-shadow(0 0 8px rgba(79, 195, 247, 0.35));
}

.logo-wordmark {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: calc(var(--logo-size) * 0.5);
  letter-spacing: 0.18em;
  background: linear-gradient(180deg, #F4F5F7 0%, #8B96A6 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.logo-image {
  height: 52px;
  width: auto;
  object-fit: contain;
  display: block;
}
</style>
