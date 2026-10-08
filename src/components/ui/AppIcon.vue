<script setup lang="ts">
import { Icon } from '@iconify/vue'
import icons from './icons.json'
defineProps<{ name: keyof typeof icons; size?: number }>()
</script>
<template>
  <Icon
    :icon="icons[name]"
    :width="size ?? 18"
    :height="size ?? 18"
    aria-hidden="true"
  />
</template>
