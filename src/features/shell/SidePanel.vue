<script setup lang="ts">
import QueuePanel from '../player/QueuePanel.vue'

defineProps<{ open?: boolean }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <Transition name="side-panel">
    <aside
      v-if="open"
      class="side-panel chrome-surface"
      aria-label="播放队列面板"
    >
      <QueuePanel
        docked
        @close="$emit('close')"
      />
    </aside>
  </Transition>
</template>

<style scoped>
.side-panel {
  display: flex;
  flex-shrink: 0;
  width: var(--spacing-side-panel);
  border-left: 1px solid var(--glass-line);
  overflow: hidden;
}
/* 宽度与透明度一起过渡，收起时不会留下一条空栏。 */
.side-panel-enter-active,
.side-panel-leave-active {
  transition:
    width var(--motion-controls) var(--ease-scene),
    opacity var(--motion-controls);
}
.side-panel-enter-from,
.side-panel-leave-to {
  width: 0;
  opacity: 0;
}
</style>
