<script setup lang="ts">
import { UiDialog } from '../../components/ui'
import SettingsPanel from './SettingsPanel.vue'

defineProps<{ initialCategory?: string }>()
defineEmits<{ close: []; lyrics: [] }>()
</script>

<template>
  <UiDialog
    title="设置"
    @close="$emit('close')"
  >
    <SettingsPanel
      :initial-category="initialCategory"
      @close="$emit('close')"
      @lyrics="$emit('lyrics')"
    />
  </UiDialog>
</template>
