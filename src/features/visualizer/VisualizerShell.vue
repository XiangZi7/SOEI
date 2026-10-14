<script setup lang="ts">
import { computed, reactive } from 'vue'
import type { Theme } from '../theme/model'
import {
  resolveThemeFontStack,
  resolveThemeFontWeight,
} from '../theme/fontStacks'
import { AppIcon } from '../../components/ui'

// 所有 visualizer 的共享外壳。从 Folia VisualizerShell.tsx 移植：
// 透明容器、字体栈注入、只在左上热区出现的返回按钮。
// 上游在这里还挂了背景 renderer、mod 的舞台图层槽和 OBS 判定；
// SOEI 的背景由调用方通过 #background 插槽提供（现有 SceneBackdrop.vue 即走这条路），
// mod 与 OBS 两套机制 SOEI 没有，不做无消费者的空壳。

const props = withDefaults(
  defineProps<{
    theme: Theme
    visualizerOpacity?: number
    /** 是否提供返回入口。上游靠 onBack 是否传入判断，Vue 里用显式 prop。 */
    canGoBack?: boolean
    /** 为真时返回按钮常显，而不是只在左上热区出现。 */
    alwaysShowBackButton?: boolean
  }>(),
  { visualizerOpacity: 1, canGoBack: false }
)
const emit = defineEmits<{ back: [] }>()

// 左上热区的边长。上游用同样的 120px 判定。
const HOTSPOT_SIZE = 120

const state = reactive({ nearBackArea: false })
const backVisible = computed(
  () => props.alwaysShowBackButton || state.nearBackArea
)
// 字体测量与最终渲染必须用同一个解析结果，否则逐字扫光会偏移。
const fontStack = computed(() => resolveThemeFontStack(props.theme))
const fontWeight = computed(() => resolveThemeFontWeight(props.theme, 400))

function track(event: MouseEvent) {
  state.nearBackArea =
    event.clientX <= HOTSPOT_SIZE && event.clientY <= HOTSPOT_SIZE
}
</script>

<template>
  <div
    class="visualizer-shell"
    :style="{
      fontFamily: fontStack,
      fontWeight,
      opacity: visualizerOpacity,
    }"
    @mousemove="track"
    @mouseleave="state.nearBackArea = false"
  >
    <div
      class="shell-background"
      aria-hidden="true"
    >
      <slot name="background" />
    </div>
    <button
      v-if="canGoBack"
      class="shell-back"
      :class="{ 'is-visible': backVisible }"
      aria-label="返回音乐空间"
      :tabindex="backVisible ? 0 : -1"
      @click.stop="emit('back')"
    >
      <AppIcon
        name="chevron-left"
        :size="20"
      />
    </button>
    <slot />
  </div>
</template>

<style scoped>
.visualizer-shell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: transparent;
  transition: color 1s;
}
.shell-background {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.shell-back {
  position: absolute;
  top: 24px;
  left: 24px;
  z-index: 30;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  color: color-mix(in srgb, var(--color-ink) 60%, transparent);
  background: #00000033;
  backdrop-filter: blur(12px);
  opacity: 0;
  pointer-events: none;
  transform: translateX(-6px) scale(0.92);
  transition:
    opacity 200ms ease-out,
    transform 200ms ease-out,
    background var(--motion-hover);
}
.shell-back.is-visible {
  opacity: 1;
  pointer-events: auto;
  transform: none;
}
.shell-back:hover {
  background: var(--color-hover);
  color: var(--color-ink);
}
</style>
