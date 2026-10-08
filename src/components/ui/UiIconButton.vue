<script setup lang="ts">
import AppIcon from './AppIcon.vue'
import UiButton from './UiButton.vue'
import type icons from './icons.json'
withDefaults(
  defineProps<{
    icon: keyof typeof icons
    label: string
    active?: boolean
    disabled?: boolean
    iconSize?: number
  }>(),
  { active: undefined }
)
</script>
<template>
  <UiButton
    variant="icon"
    :aria-label="label"
    :title="label"
    :aria-pressed="active === undefined ? undefined : active"
    :disabled="disabled"
    :class="{ 'bg-hover text-accent': active }"
    ><AppIcon
      :name="icon"
      :size="iconSize ?? 18"
  /></UiButton>
</template>
