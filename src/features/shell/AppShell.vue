<script setup lang="ts">
import { useWindowChrome } from './useWindowChrome'

defineProps<{
  // 壁纸小窗模式下不要外壳的圆角与内描边，由小窗自己的玻璃面板负责。
  bare?: boolean
}>()
const { rounded } = useWindowChrome()
</script>

<template>
  <div
    class="app-shell"
    :class="{ 'is-rounded': rounded && !bare }"
  >
    <div
      class="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      <slot name="background" />
    </div>
    <slot name="titlebar" />
    <div class="shell-body">
      <slot name="sidebar" />
      <main
        class="shell-content"
        tabindex="-1"
      >
        <slot />
      </main>
      <slot name="panel" />
      <!-- 舞台层：覆盖侧栏与内容区，但标题栏和播放条留在外面，
           所以进入歌词场景后窗口控制和播放控制仍然可用。 -->
      <slot name="stage" />
    </div>
    <div class="shell-player">
      <slot name="player" />
    </div>
    <slot name="overlays" />
  </div>
</template>

<style scoped>
/* 应用级外壳：整窗不滚动，只有内容区自己滚。 */
.app-shell {
  position: fixed;
  inset: 0;
  z-index: 0;
  display: flex;
  flex-direction: column;
  isolation: isolate;
  overflow: hidden;
  background: var(--gradient-space);
}
/* 透明无边框窗口的圆角与内描边；最大化/全屏时由 is-rounded 整体摘掉。 */
.app-shell.is-rounded {
  border-radius: var(--radius-window);
  box-shadow: inset 0 0 0 1px var(--color-window-ring);
}
.shell-body {
  position: relative;
  z-index: 1;
  display: flex;
  flex: 1;
  /* 没有它，flex 子项的 overflow 会被内容撑开，内容区就滚不起来。 */
  min-height: 0;
}
.shell-content {
  position: relative;
  flex: 1;
  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.shell-content:focus-visible {
  outline: none;
}
/* 播放条在舞台层之上，所以切到歌词场景后播放控制不会被盖住。 */
.shell-player {
  position: relative;
  z-index: var(--z-controls);
  flex-shrink: 0;
}
</style>
