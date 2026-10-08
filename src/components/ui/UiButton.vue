<script setup lang="ts">
import AppIcon from './AppIcon.vue'
import { useUiAttrs } from './classes'
defineOptions({ inheritAttrs: false })
const { forwardedAttrs, classes } = useUiAttrs()
withDefaults(
  defineProps<{
    variant?: 'outline' | 'solid' | 'ghost' | 'text' | 'icon'
    size?: 'sm' | 'md' | 'lg'
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    loading?: boolean
  }>(),
  { variant: 'outline', size: 'md', type: 'button' }
)
const variants = {
  outline: 'border border-line hover:bg-hover',
  solid: 'border border-accent bg-accent text-surface hover:bg-ink',
  ghost: 'border border-transparent hover:bg-hover',
  text: 'border border-transparent text-muted hover:text-ink',
  icon: 'rounded-full border border-transparent hover:bg-hover',
}
const sizes = {
  sm: 'min-h-8 px-3 text-caption',
  md: 'min-h-control px-4 text-label',
  lg: 'min-h-11 px-5 text-sm',
}
</script>
<template>
  <button
    v-bind="forwardedAttrs()"
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    :class="
      classes(
        'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-input tracking-wide transition-colors duration-(--motion-hover) focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-35',
        variants[variant],
        variant === 'icon' ? 'size-control p-0' : sizes[size]
      )
    "
  >
    <AppIcon
      v-if="loading"
      name="loader-circle"
      class="animate-spin"
      :size="15"
    /><slot />
  </button>
</template>
