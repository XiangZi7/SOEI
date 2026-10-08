<script setup lang="ts">
import { useUiAttrs } from './classes'
defineOptions({ inheritAttrs: false })
const { forwardedAttrs, classes } = useUiAttrs()
defineProps<{
  label: string
  options?: { value: string; label: string }[]
  disabled?: boolean
}>()
const model = defineModel<string>({ default: '' })
</script>
<template>
  <select
    v-model="model"
    v-bind="forwardedAttrs()"
    :aria-label="label"
    :disabled="disabled"
    :class="
      classes(
        'min-h-9 cursor-pointer rounded-input border border-line bg-surface px-3 py-2 text-label text-ink disabled:opacity-35'
      )
    "
  >
    <option
      v-for="option in options"
      :key="option.value"
      :value="option.value"
    >
      {{ option.label }}
    </option>
    <slot />
  </select>
</template>
