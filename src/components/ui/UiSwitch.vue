<script setup lang="ts">
defineProps<{ label: string; disabled?: boolean }>()
const model = defineModel<boolean>({ default: false })
</script>
<template>
  <label
    class="relative inline-flex shrink-0 cursor-pointer items-center p-1"
    :class="{ 'cursor-not-allowed opacity-35': disabled }"
    ><input
      v-model="model"
      class="peer sr-only"
      type="checkbox"
      :aria-label="label"
      :disabled="disabled" /><span
      class="relative h-5 w-9 rounded-full border border-line bg-surface transition-colors duration-(--motion-hover) peer-checked:bg-accent peer-focus-visible:outline peer-focus-visible:outline-offset-4 peer-focus-visible:outline-accent before:absolute before:top-[3px] before:left-[3px] before:size-3 before:rounded-full before:bg-muted before:transition-transform before:duration-(--motion-hover) peer-checked:before:translate-x-4 peer-checked:before:bg-surface"
      aria-hidden="true"
  /></label>
</template>
