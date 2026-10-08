<script setup lang="ts">
import { call } from '../../bridge/native'
import AppIcon from './AppIcon.vue'
import UiButton from './UiButton.vue'

withDefaults(defineProps<{ title?: string }>(), { title: 'SOEI' })
const emit = defineEmits<{ close: []; error: [error: unknown] }>()
function action(action: 'drag' | 'minimize' | 'maximize') {
  void call('window_action', { action }).catch(error => emit('error', error))
}
function drag(event: MouseEvent) {
  if (event.button === 0) action('drag')
}
</script>

<template>
  <header
    class="window-strip flex h-(--spacing-window-strip) shrink-0 items-center justify-between border-b border-line bg-space/95 pl-4 text-muted backdrop-blur-xl select-none"
    aria-label="窗口标题栏"
    @mousedown.self="drag"
    @dblclick.self="action('maximize')"
  >
    <span class="pointer-events-none text-[8px] tracking-[.22em]">{{
      title
    }}</span>
    <div class="flex h-full">
      <UiButton
        variant="ghost"
        class="window-action"
        aria-label="最小化窗口"
        @click="action('minimize')"
        ><AppIcon
          name="minus"
          :size="12"
      /></UiButton>
      <UiButton
        variant="ghost"
        class="window-action"
        aria-label="最大化或还原窗口"
        @click="action('maximize')"
        ><AppIcon
          name="square"
          :size="10"
      /></UiButton>
      <UiButton
        variant="ghost"
        class="window-action window-close"
        aria-label="关闭窗口"
        @click="emit('close')"
        ><AppIcon
          name="x"
          :size="13"
      /></UiButton>
    </div>
  </header>
</template>

<style scoped>
.window-action {
  width: 37px;
  min-height: 0;
  height: 100%;
  padding: 0;
  border-radius: 0;
}
.window-close:hover {
  background: var(--color-danger-soft);
}
</style>
