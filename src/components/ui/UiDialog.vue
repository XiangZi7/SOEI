<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue'
defineProps<{ title: string }>()
const emit = defineEmits<{ close: [] }>()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const priorFocus =
  document.activeElement instanceof HTMLElement ? document.activeElement : null
onMounted(() => dialog.value?.showModal())
onBeforeUnmount(() => {
  dialog.value?.close()
  priorFocus?.focus()
})
</script>
<template>
  <dialog
    ref="dialog"
    :aria-label="title"
    class="max-h-[calc(100dvh-3rem)] w-[min(780px,calc(100vw-2rem))] overflow-hidden rounded-panel border border-line bg-panel p-0 text-ink shadow-dialog backdrop:bg-backdrop backdrop:backdrop-blur-md"
    @cancel.prevent="emit('close')"
  >
    <slot />
  </dialog>
</template>
