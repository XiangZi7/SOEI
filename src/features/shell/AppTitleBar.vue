<script setup lang="ts">
import { AppIcon, UiButton, UiIconButton } from '../../components/ui'
import { call, desktop } from '../../bridge/native'

withDefaults(defineProps<{ title?: string; themeName?: string }>(), {
  title: 'SOEI',
})
const emit = defineEmits<{
  search: []
  settings: []
  error: [error: unknown]
}>()

function action(action: 'drag' | 'minimize' | 'maximize' | 'close') {
  void call('window_action', { action }).catch(error => emit('error', error))
}
// 只有点在标题栏空白处才拖窗；按钮与搜索框自己 stopPropagation 由 .self 保证。
function drag(event: MouseEvent) {
  if (desktop && event.button === 0) action('drag')
}
</script>

<template>
  <header
    class="app-titlebar chrome-surface"
    aria-label="应用标题栏"
    @mousedown.self="drag"
    @dblclick.self="desktop && action('maximize')"
  >
    <div
      class="titlebar-brand"
      @mousedown.self="drag"
      @dblclick.self="desktop && action('maximize')"
    >
      <span class="titlebar-mark">{{ title }}</span>
      <span
        v-if="themeName"
        class="titlebar-theme"
        :title="`当前封面主题：${themeName}`"
        >{{ themeName }}</span
      >
    </div>
    <div
      class="titlebar-spacer"
      @mousedown.self="drag"
      @dblclick.self="desktop && action('maximize')"
    />
    <div class="titlebar-actions">
      <UiButton
        variant="ghost"
        class="titlebar-search"
        aria-label="搜索音乐"
        title="搜索音乐（Ctrl+K）"
        @click="emit('search')"
        ><AppIcon
          name="search"
          :size="13"
        /><span class="max-md:hidden">搜索</span
        ><kbd class="titlebar-kbd max-lg:hidden">Ctrl K</kbd></UiButton
      >
      <UiIconButton
        icon="settings-2"
        label="设置"
        class="titlebar-button"
        :icon-size="15"
        @click="emit('settings')"
      />
    </div>
    <div
      v-if="desktop"
      class="titlebar-window"
    >
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
        @click="action('close')"
        ><AppIcon
          name="x"
          :size="13"
      /></UiButton>
    </div>
  </header>
</template>

<style scoped>
.app-titlebar {
  position: relative;
  z-index: 2;
  display: flex;
  flex-shrink: 0;
  align-items: stretch;
  height: 44px;
  border-bottom: 1px solid var(--glass-line);
  user-select: none;
}
.titlebar-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-inline: 16px;
  min-width: 0;
}
.titlebar-mark {
  font-family: var(--font-display);
  font-size: 13px;
  letter-spacing: 0.2em;
  color: var(--theme-primary, var(--color-ink));
}
.titlebar-theme {
  overflow: hidden;
  max-width: 14ch;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--theme-accent, var(--color-muted));
  transition: color var(--motion-ambient);
}
.titlebar-spacer {
  flex: 1;
  min-width: 24px;
}
.titlebar-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  padding-inline: 6px;
}
.titlebar-search {
  gap: 7px;
  min-height: 30px;
  padding-inline: 10px;
  border: 1px solid var(--glass-line);
  border-radius: var(--radius-input);
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--color-muted);
}
.titlebar-search:hover {
  color: var(--color-ink);
}
.titlebar-kbd {
  padding: 1px 5px;
  border: 1px solid var(--glass-line);
  border-radius: 3px;
  font-family: inherit;
  font-size: 9px;
  letter-spacing: 0.06em;
  color: var(--color-faint);
}
.titlebar-button {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-input);
}
.titlebar-window {
  display: flex;
  flex-shrink: 0;
}
.window-action {
  width: 46px;
  min-height: 0;
  height: 100%;
  padding: 0;
  border-radius: 0;
  color: var(--color-muted);
}
.window-action:hover {
  color: var(--color-ink);
}
.window-close:hover {
  background: var(--color-danger-soft);
}
@media (max-width: 600px) {
  .titlebar-theme {
    display: none;
  }
  .titlebar-brand {
    padding-inline: 12px;
  }
}
</style>
