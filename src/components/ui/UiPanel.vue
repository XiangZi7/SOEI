<script setup lang="ts">
import { useUiAttrs } from './classes'
defineOptions({ inheritAttrs: false })
const { forwardedAttrs, classes } = useUiAttrs()
withDefaults(defineProps<{ glass?: boolean; padding?: boolean }>(), {
  glass: true,
  padding: false,
})
</script>
<template>
  <div
    v-bind="forwardedAttrs()"
    :class="
      classes(
        'rounded-panel border border-line shadow-panel',
        glass ? 'bg-glass backdrop-blur-lg' : 'bg-panel',
        { 'p-6': padding }
      )
    "
  >
    <slot />
  </div>
</template>
