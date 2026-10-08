<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'neutral' | 'accent' | 'danger' }>(), {
  tone: 'neutral',
})
const tones = {
  neutral: 'border-line text-muted',
  accent: 'border-accent/30 bg-accent/5 text-accent',
  danger: 'border-danger/30 bg-danger/5 text-danger',
}
</script>
<template>
  <span
    class="inline-flex items-center gap-1 rounded-input border px-2 py-1 text-[9px] tracking-wide"
    :class="tones[tone]"
    ><slot
  /></span>
</template>
