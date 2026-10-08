<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    min?: number
    max?: number
    step?: number
    disabled?: boolean
  }>(),
  { min: 0, max: 100, step: 1 }
)
const model = defineModel<number>({ default: 0 })
</script>
<template>
  <input
    type="range"
    :aria-label="label"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
    :value="model"
    class="h-1 min-w-10 cursor-pointer accent-accent disabled:cursor-not-allowed disabled:opacity-35"
    @input="model = Number(($event.target as HTMLInputElement).value)"
  />
</template>
