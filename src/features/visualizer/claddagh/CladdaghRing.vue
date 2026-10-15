<script setup lang="ts">
// Adapted from Folia claddagh/VisualizerCladdagh.tsx (AGPL-3.0); see third_party/Folia-NOTICE.md.
import { computed } from 'vue'
import type { Theme } from '../../theme/model'
import { colorWithAlpha } from '../../theme/colorMath'
import { claddaghFontSpec, type CladdaghSpacingItem } from './claddaghGeometry'

// 环上的一行：只负责字素结构与静态字体。
// 弧长分布由父级算好传进来，逐帧变换也由父级统一驱动，
// 所以整环只有一条帧循环、一份测量。
const props = defineProps<{
  spacing: CladdaghSpacingItem[]
  lineIndex: number
  theme: Theme
  lyricsFontScale: number
}>()

const font = computed(() =>
  claddaghFontSpec(props.theme, props.lyricsFontScale)
)
const baseColor = computed(() => colorWithAlpha(props.theme.primaryColor, 0.55))
</script>

<template>
  <div
    class="claddagh-ring"
    :data-line-index="lineIndex"
  >
    <span
      v-for="(item, index) in spacing"
      :key="index"
      data-claddagh-char
      class="claddagh-char"
      :style="{
        fontFamily: font.fontStack,
        fontSize: `${font.fontPx}px`,
        fontWeight: font.fontWeight,
        color: baseColor,
      }"
      >{{ item.char }}</span
    >
  </div>
</template>

<style scoped>
.claddagh-ring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.claddagh-char {
  position: absolute;
  top: 50%;
  left: 50%;
  opacity: 0;
  transform: translate3d(-50%, -50%, 0) scale(0.2);
  transform-origin: center center;
  letter-spacing: 0.04em;
  white-space: nowrap;
  will-change: transform, opacity, filter, color;
}
</style>
