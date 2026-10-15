<script setup lang="ts">
// Adapted from Folia tilt/VisualizerTilt.tsx (AGPL-3.0); see third_party/Folia-NOTICE.md.
import { computed } from 'vue'
import type { Theme } from '../../theme/model'
import { resolveThemeFontWeight } from '../../theme/fontStacks'
import { tiltGraphemes, type TiltSegment } from './tiltLayout'

// 一个段落（一行）：只负责字素结构与静态排版。
// 逐帧样式由父级 VisualizerTilt 统一驱动，所以整个舞台只有一条帧循环，
// 字符时间也只在父级算一次。
const props = defineProps<{
  segment: TiltSegment
  theme: Theme
  colors: { normal: string; tilt: string }
  fontScale: number
  scaleMultiplier: number
}>()

const baseScale = computed(() => props.fontScale * props.scaleMultiplier)
// 末行过短时放大一点，避免看着像掉了字。
const shortBoost = computed(() => (props.segment.isShortLastLine ? 1.18 : 1))
const fontSize = computed(() => {
  const scale = baseScale.value * (props.segment.isTilt ? 1 : shortBoost.value)
  return `clamp(${(3.125 * scale).toFixed(3)}rem, ${(6.875 * scale).toFixed(3)}vw, ${(5.625 * scale).toFixed(3)}rem)`
})

const isSpace = (text: string) => /^\s+$/.test(text)

/**
 * 字素列表，连带它的非空白序号与交替方向。
 * 空白不参与错开也不参与交替，否则句中有空格时后半句会整体晚一拍、上下相位也会错。
 */
const graphemes = computed(() => {
  let charIndex = 0
  return tiltGraphemes(props.segment.text).map(text => {
    const space = isSpace(text)
    const entry = {
      text: space ? ' ' : text,
      space,
      charIndex: space ? -1 : charIndex,
      // 偶数位向上、奇数位向下。
      direction: space ? 0 : charIndex % 2 === 0 ? -1 : 1,
    }
    if (!space) charIndex += 1
    return entry
  })
})
</script>

<template>
  <div
    data-tilt-segment
    class="tilt-segment"
    :data-tilt="segment.isTilt ? 'true' : 'false'"
    :style="{
      fontSize,
      color: segment.isTilt ? colors.tilt : colors.normal,
      fontStyle: segment.isTilt ? 'italic' : 'normal',
      fontWeight: resolveThemeFontWeight(theme, segment.isTilt ? 300 : 400),
      letterSpacing: segment.isTilt ? '0.15em' : '0.08em',
      lineHeight: segment.isTilt ? 1.25 : 1.35,
    }"
  >
    <span
      v-for="(grapheme, position) in graphemes"
      :key="position"
      data-tilt-char
      class="tilt-char"
      :class="{ 'is-space': grapheme.space }"
      :data-char-index="grapheme.charIndex"
      :data-direction="grapheme.direction"
      >{{ grapheme.text }}</span
    >
  </div>
</template>

<style scoped>
.tilt-segment {
  white-space: nowrap;
  will-change: transform, opacity;
}
.tilt-char {
  display: inline-block;
  will-change: transform, opacity;
}
.tilt-char.is-space {
  min-width: 0.25em;
}
[data-tilt='true'] .tilt-char.is-space {
  min-width: 0.35em;
}
</style>
