<script setup lang="ts">
import type { SceneLayout } from '../../types/music'
import { sceneModes } from './sceneModes'

defineProps<{ compact?: boolean }>()
const model = defineModel<SceneLayout>({ required: true })
</script>

<template>
  <div class="scene-mode-picker" :class="{ compact }" role="group" aria-label="歌词场景风格">
    <button v-for="mode in sceneModes" :key="mode.id" class="mode-option" :class="{ selected: model === mode.id }" :aria-pressed="model === mode.id" :title="mode.description" @click="model = mode.id">
      <span class="mode-number">{{ mode.number }}</span>
      <span>{{ mode.name }}</span>
      <span class="mode-indicator" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.scene-mode-picker { display: flex; gap: 6px; padding: 5px; border: 1px solid var(--color-line); border-radius: 999px; background: #070c17b3; backdrop-filter: blur(16px); }
.mode-option { min-height: 44px; display: flex; align-items: center; gap: 10px; padding: 0 19px; border-radius: 999px; color: var(--color-muted); font-size: 12px; transition: color 220ms, background 220ms; }
.mode-option:hover { color: var(--color-ink); background: var(--color-hover); }
.mode-option.selected { color: var(--color-ink); background: #ffffff12; }
.mode-number { color: #b3bdcc; font-size: 9px; font-variant-numeric: tabular-nums; }
.mode-indicator { width: 4px; height: 4px; border-radius: 50%; background: transparent; }
.selected .mode-indicator { background: var(--color-stage-gold); box-shadow: 0 0 9px #e8c87970; }
.compact .mode-option { padding: 0 14px; }
@media (max-width: 650px) { .mode-option { gap: 7px; padding: 0 12px; } .compact .mode-number, .compact .mode-indicator { display: none; } .compact .mode-option { padding: 0 13px; } }
</style>
