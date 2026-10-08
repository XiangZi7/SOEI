<script setup lang="ts">
defineProps<{ title: string; hint?: string }>()
</script>
<template>
  <div
    class="flex items-center justify-between gap-7 border-b border-line py-5 max-sm:gap-4"
  >
    <div class="flex-1">
      <h3 class="m-0 text-label font-normal">{{ title }}</h3>
      <p
        v-if="hint"
        class="mt-2 max-w-68 text-caption leading-relaxed text-muted"
      >
        {{ hint }}
      </p>
    </div>
    <div class="flex items-center gap-2.5 text-[11px]"><slot /></div>
  </div>
</template>
