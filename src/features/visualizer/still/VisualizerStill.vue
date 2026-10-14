<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { VisualizerSharedProps } from '../definition'
import {
  resolveThemeFontStack,
  resolveThemeFontWeight,
  resolveThemeTranslationFontStack,
} from '../../theme/fontStacks'

// 静止：三行歌词垂直居中不动，加一层径向暗角。零动画，也不挂背景层。
// 从 Folia still/VisualizerStill.tsx 移植。
// 外壳由 VisualizerRenderer 统一套，所以这里不再自己包 VisualizerShell。
const props = withDefaults(defineProps<VisualizerSharedProps>(), {
  lyricsFontScale: 1,
  subtitleFontScale: 1,
  hideTranslationSubtitle: false,
  isDaylight: false,
  showText: true,
})

// 间隙（currentLineIndex === -1）时保持上一句不动，而不是整屏清空。
const state = reactive({ effectiveIndex: Math.max(0, props.currentLineIndex) })
watch(
  () => [props.currentLineIndex, props.lines.length] as const,
  ([index, length]) => {
    if (index !== -1) state.effectiveIndex = index
    else if (state.effectiveIndex >= length) state.effectiveIndex = 0
  },
  { immediate: true }
)

const subtitleTheme = computed(() => props.subtitleTheme ?? props.theme)
// 上一句 / 当前句 / 下一句。
const window = computed(() =>
  [-1, 0, 1].map(offset => {
    const index = state.effectiveIndex + offset
    return { offset, index, line: props.lines[index] }
  })
)

const lyricStyle = (isCurrent: boolean) => ({
  color: props.theme.primaryColor,
  fontFamily: resolveThemeFontStack(props.theme),
  scale: String(props.lyricsFontScale),
  fontWeight: resolveThemeFontWeight(props.theme, isCurrent ? 700 : 600),
})
const translationStyle = (isCurrent: boolean) => ({
  color: subtitleTheme.value.secondaryColor,
  fontFamily: resolveThemeTranslationFontStack(subtitleTheme.value),
  scale: String(props.lyricsFontScale * props.subtitleFontScale),
  fontWeight: resolveThemeFontWeight(
    subtitleTheme.value,
    isCurrent ? 500 : 400
  ),
})
</script>

<template>
  <div
    class="still-vignette"
    :class="isDaylight ? 'is-daylight' : 'is-night'"
    aria-hidden="true"
  />
  <div
    v-if="showText"
    class="still-stack"
  >
    <template
      v-for="item in window"
      :key="item.line ? item.index : `empty-${item.offset}`"
    >
      <div
        v-if="!item.line"
        class="still-gap"
      />
      <div
        v-else
        class="still-line"
      >
        <div
          v-if="item.line.fullText"
          class="still-text"
          :class="item.offset === 0 ? 'is-current' : 'is-neighbour'"
          :style="lyricStyle(item.offset === 0)"
        >
          {{ item.line.fullText }}
        </div>
        <!-- 与上游一致：静止模式直接读 line.translation，不走 subtitleContentMode。 -->
        <div
          v-if="item.line.translation && !hideTranslationSubtitle"
          class="still-translation"
          :class="item.offset === 0 ? 'is-current' : 'is-neighbour'"
          :style="translationStyle(item.offset === 0)"
        >
          {{ item.line.translation }}
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.still-vignette {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 0%, #000 100%);
}
.still-vignette.is-night {
  opacity: 0.65;
}
.still-vignette.is-daylight {
  opacity: 0.3;
  mix-blend-mode: multiply;
}
.still-stack {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 32px;
  padding: 0 48px 64px;
  pointer-events: none;
}
.still-gap {
  height: 80px;
}
.still-line {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 56rem;
}
.still-text {
  text-align: center;
  letter-spacing: 0.02em;
  filter: drop-shadow(0 2px 4px #0000004d);
}
.still-text.is-current {
  font-size: 2.5rem;
  line-height: 1.25;
  opacity: 1;
}
.still-text.is-neighbour {
  font-size: 1.875rem;
  opacity: 0.3;
}
.still-translation {
  text-align: center;
  letter-spacing: 0.025em;
  filter: drop-shadow(0 1px 2px #00000040);
}
.still-translation.is-current {
  margin-top: 12px;
  font-size: 1.5rem;
  opacity: 0.8;
}
.still-translation.is-neighbour {
  margin-top: 8px;
  font-size: 1.25rem;
  opacity: 0.3;
}
</style>
