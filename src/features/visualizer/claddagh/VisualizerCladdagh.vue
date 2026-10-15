<script setup lang="ts">
// Adapted from Folia claddagh/VisualizerCladdagh.tsx (AGPL-3.0); see third_party/Folia-NOTICE.md.
import { computed, reactive, useTemplateRef, watch } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import { getLineRenderEndTime } from '../../lyrics/folia/renderHints'
import { colorWithAlpha } from '../../theme/colorMath'
import type { VisualizerSharedProps } from '../definition'
import { visualizerRuntime } from '../runtime'
import { springStep } from '../easing'
import { useVisualizerFrame } from '../useVisualizerFrame'
import VisualizerSubtitleOverlay from '../VisualizerSubtitleOverlay.vue'
import CladdaghRing from './CladdaghRing.vue'
import {
  claddaghAxisFrame,
  claddaghCharFrame,
  claddaghLengthMitigation,
  claddaghRadiusPulse,
  createPowerNormalizer,
} from './claddaghFrame'
import {
  buildCladdaghSpacing,
  buildCladdaghTimeline,
  claddaghFontSpec,
  claddaghLineRenderEnd,
  claddaghRadius,
  claddaghSpacingScale,
  getLinePlaybackProgress,
  getLineWordOffset,
  resolveCladdaghTuning,
  shouldHoldCladdaghFrame,
  CLADDAGH_BACK_FOLLOW_RATIO,
  CLADDAGH_BACK_ORBIT_FOLLOW_RATIO,
  CLADDAGH_NEXT_LINE_ENTRY_LEAD_SECONDS,
} from './claddaghGeometry'

const props = withDefaults(defineProps<VisualizerSharedProps>(), {
  showText: true,
  lyricsFontScale: 1,
  subtitleFontScale: 1,
  hideTranslationSubtitle: false,
  showSubtitleTranslation: true,
})

const runtime = computed(() =>
  visualizerRuntime({
    currentTime: props.currentTime,
    currentLineIndex: props.currentLineIndex,
    lines: props.lines,
    getLineEndTime: getLineRenderEndTime,
  })
)
const tuning = computed(() => resolveCladdaghTuning(props.tunings?.claddagh))

const host = useTemplateRef<HTMLElement>('host')
const axis = useTemplateRef<HTMLElement>('axis')
// 响应式状态
const state = reactive({ width: 800, height: 600 })
useResizeObserver(host, entries => {
  const rect = entries[0]?.contentRect
  if (rect && rect.width > 0 && rect.height > 0) {
    state.width = rect.width
    state.height = rect.height
  }
})

const radius = computed(() =>
  claddaghRadius(state.width, tuning.value.radiusScale)
)
const spacingScale = computed(() =>
  claddaghSpacingScale(tuning.value.focusScaleRatio)
)

/** 聚焦行：没有活跃行时用最近唱完的那一行，避免间奏期间整环归零。 */
const centerLineIndex = computed(() => {
  if (props.currentLineIndex !== -1) return props.currentLineIndex
  const recent = runtime.value.recentCompletedLine
  return recent ? props.lines.indexOf(recent) : -1
})

/** 保留「转场的两行 + 前一行」，这样离场的那一行在 spring 旋转期间仍然可见。 */
const renderIndices = computed(() => {
  const center = Math.max(0, centerLineIndex.value)
  if (!props.lines.length) return []
  const indices: number[] = []
  for (let index = center - 1; index <= center + 2; index += 1)
    if (index >= 0 && index < props.lines.length) indices.push(index)
  return indices.length
    ? indices
    : [Math.max(0, Math.min(center, props.lines.length - 1))]
})

/** 每个待渲染行的弧长分布。整环只测一次，子组件只负责结构。 */
const ringSpacings = computed(() => {
  const font = claddaghFontSpec(props.theme, props.lyricsFontScale)
  return renderIndices.value.map(index => ({
    index,
    line: props.lines[index]!,
    spacing: buildCladdaghSpacing(
      buildCladdaghTimeline(props.lines[index]!, props.theme.wordColors),
      font.fontSpec,
      font.fontPx,
      radius.value.rx,
      spacingScale.value,
      tuning.value.letterSpacingOffset
    ),
  }))
})
/** 活跃行的弧长分布，供后续行跟随它旋转。 */
const activeSpacing = computed(
  () =>
    ringSpacings.value.find(
      item => item.index === Math.max(0, centerLineIndex.value)
    )?.spacing ?? []
)

// 整环旋转：行索引变化时用 spring 转到新角度。
// 上游用 framer animate(lineOffset, target, spring(55, 14, 0.9))；
// 这里走解析阶跃响应，所以 Seek 不需要重演旋转历史。
const ringSpring = springStep(55, 14, 0.9, 4)
const rotation = reactive({
  /** 当前已到位的角度（弧度）。 */
  from: 0,
  to: 0,
  /** 本次旋转的起始时刻；为 null 表示没有进行中的旋转。 */
  startedAt: null as number | null,
})
watch(
  centerLineIndex,
  (index, previous) => {
    const target = Math.max(0, index) * Math.PI
    // 跳歌/大跨度跳转直接落位，不做长距离旋转。
    if (previous === undefined || Math.abs(index - (previous ?? 0)) > 1) {
      rotation.from = target
      rotation.to = target
      rotation.startedAt = null
      return
    }
    rotation.from = currentRotation()
    rotation.to = target
    rotation.startedAt = props.currentTime.get()
  },
  { immediate: true }
)
function currentRotation(): number {
  if (rotation.startedAt === null) return rotation.to
  const elapsed = props.currentTime.get() - rotation.startedAt
  // 回拖到旋转开始之前：直接给目标角度，不要反向播放。
  if (elapsed < 0) return rotation.to
  return rotation.from + (rotation.to - rotation.from) * ringSpring(elapsed)
}

const normalizeBass = createPowerNormalizer()
const normalizeVocal = createPowerNormalizer()
const normalizePower = createPowerNormalizer()
// 副歌发光按帧缓动，避免切到副歌的那一下硬跳。
let chorusGlow = 0
let previousTime = 0
let holdFrame = false

interface RingElements {
  lineIndex: number
  chars: HTMLElement[]
}
let rings: RingElements[] = []

function collect() {
  rings = Array.from(
    host.value?.querySelectorAll<HTMLElement>('.claddagh-ring') ?? []
  ).map(ring => ({
    lineIndex: Number(ring.dataset.lineIndex),
    chars: Array.from(
      ring.querySelectorAll<HTMLElement>('[data-claddagh-char]')
    ),
  }))
}

function paint() {
  if (!host.value) return
  const time = props.currentTime.get()
  const center = centerLineIndex.value
  // 时间源会在行索引更新之前归零；那一瞬间保留已完成的那一帧。
  if (shouldHoldCladdaghFrame(previousTime, time, center)) holdFrame = true
  previousTime = time
  if (holdFrame && center > 0) return
  holdFrame = false

  const paused = Boolean(props.paused)
  const staticMode = Boolean(props.staticMode)
  const bass = paused ? 0 : normalizeBass(props.audioBands.bass.get())
  const vocal = paused ? 0 : normalizeVocal(props.audioBands.vocal.get())
  const power = paused ? 0 : normalizePower(props.audioPower.get())
  const isChorus = runtime.value.activeLine?.isChorus ?? false

  if (axis.value) {
    // 约 330ms 的缓动（60fps 下每帧 0.05）。
    const target = isChorus ? 1 : 0
    const diff = target - chorusGlow
    chorusGlow =
      Math.abs(diff) > 0.01
        ? Math.min(1, Math.max(0, chorusGlow + Math.sign(diff) * 0.05))
        : target
    const frame = claddaghAxisFrame(
      props.theme,
      bass,
      vocal,
      tuning.value.ellipseTiltDeg,
      chorusGlow
    )
    axis.value.style.background = frame.background
    axis.value.style.transform = frame.transform
    axis.value.style.filter = frame.filter
  }

  const pulse = staticMode
    ? 1
    : claddaghRadiusPulse(props.theme.animationIntensity, bass)
  const rx = radius.value.rx * pulse
  const ry = radius.value.ry * pulse
  const lineOffset = staticMode ? center * Math.PI : currentRotation()
  const activeRenderEnd = claddaghLineRenderEnd(props.lines, center)
  const activeOffset = getLineWordOffset(
    activeSpacing.value,
    time,
    activeRenderEnd
  )
  const activeProgress = getLinePlaybackProgress(
    activeSpacing.value,
    time,
    activeRenderEnd
  )
  // 背面跟随：唱得越久，背面的行越往前凑。
  const backOrbit =
    Math.PI *
    CLADDAGH_BACK_ORBIT_FOLLOW_RATIO *
    (1 - (1 - activeProgress) ** 1.35)
  const font = claddaghFontSpec(props.theme, props.lyricsFontScale)
  const baseColor = colorWithAlpha(props.theme.primaryColor, 0.55)
  const highlightColor = props.theme.accentColor || props.theme.primaryColor
  const centerText = props.lines[center]?.fullText

  for (const ring of rings) {
    const entry = ringSpacings.value.find(item => item.index === ring.lineIndex)
    const line = entry?.line
    const spacing = entry?.spacing
    if (!line || !spacing?.length) continue

    const lineDiff = Math.abs(lineOffset - ring.lineIndex * Math.PI) / Math.PI
    const ownRenderEnd = claddaghLineRenderEnd(props.lines, ring.lineIndex)
    let wordOffset = getLineWordOffset(spacing, time, ownRenderEnd)
    if (ring.lineIndex >= center) {
      // 用 lineDiff 做连续混合，避免 renderBaseIndex 更新时跟随量突然归零。
      const factor =
        ring.lineIndex > center ? 1 : Math.min(1, Math.max(0, lineDiff))
      wordOffset +=
        (activeOffset * CLADDAGH_BACK_FOLLOW_RATIO + backOrbit) * factor
    }
    // 已过去的行保留自己唱完时的偏移，不跟新的活跃行，否则会弹回 0。

    const upcomingEntry =
      ring.lineIndex > center
        ? Math.min(
            1,
            Math.max(
              0,
              (time -
                (line.startTime - CLADDAGH_NEXT_LINE_ENTRY_LEAD_SECONDS)) /
                CLADDAGH_NEXT_LINE_ENTRY_LEAD_SECONDS
            )
          )
        : 0
    const mitigation = claddaghLengthMitigation(
      centerText,
      line.fullText,
      lineDiff,
      ring.lineIndex > center
    )

    ring.chars.forEach((element, charIndex) => {
      const item = spacing[charIndex]
      if (!item) return
      const frame = claddaghCharFrame({
        item,
        charIndex,
        timeSec: time,
        lineOffset,
        wordOffset,
        lineIndex: ring.lineIndex,
        centerLineIndex: center,
        rx,
        ry,
        fontPx: font.fontPx,
        theme: props.theme,
        tiltDeg: tuning.value.ellipseTiltDeg,
        focusScaleRatio: tuning.value.focusScaleRatio,
        power,
        isChorus: Boolean(line.isChorus),
        upcomingEntry,
        lengthFade: mitigation.fade,
        lengthScale: mitigation.scale,
        baseColor,
        highlightColor,
      })
      element.style.transform = frame.transform
      element.style.opacity = String(frame.opacity)
      element.style.color = frame.color
      element.style.filter = frame.filter
    })
  }
}

watch(
  [host, ringSpacings, () => props.staticMode],
  () => {
    collect()
    paint()
  },
  { immediate: true, flush: 'post' }
)
useVisualizerFrame({
  source: () => props.currentTime,
  running: () => !props.paused && !props.staticMode && Boolean(host.value),
  frameRate: () => props.frameRate ?? 30,
  paint,
})
</script>

<template>
  <div
    ref="host"
    class="claddagh-stage"
  >
    <div
      v-if="tuning.showAxisLine && !staticMode"
      ref="axis"
      class="claddagh-axis"
      aria-hidden="true"
    />
    <template v-if="showText && radius.rx > 0">
      <CladdaghRing
        v-for="entry in ringSpacings"
        :key="entry.index"
        :spacing="entry.spacing"
        :line-index="entry.index"
        :theme="theme"
        :lyrics-font-scale="lyricsFontScale"
      />
    </template>
    <div
      v-else-if="showText"
      class="claddagh-waiting"
      :style="{ color: theme.secondaryColor }"
    >
      {{ lines.length ? '等待下一句' : '等待歌词' }}
    </div>
  </div>
  <VisualizerSubtitleOverlay
    :show-text="showText"
    :active-line="runtime.activeLine"
    :recent-completed-line="runtime.recentCompletedLine"
    :next-lines="runtime.nextLines"
    :theme="theme"
    :subtitle-theme="subtitleTheme"
    :lyrics-font-scale="lyricsFontScale"
    :subtitle-font-scale="subtitleFontScale"
    :subtitle-overlay-opacity="subtitleOverlayOpacity"
    :subtitle-overlay-background="subtitleOverlayBackground"
    :subtitle-upcoming-lyrics-blur="subtitleUpcomingLyricsBlur"
    :hide-translation-subtitle="hideTranslationSubtitle"
    :show-subtitle-translation="showSubtitleTranslation"
    :subtitle-content-mode="subtitleContentMode"
  />
</template>

<style scoped>
.claddagh-stage {
  position: absolute;
  inset: 0;
  z-index: 10;
  overflow: hidden;
  user-select: none;
  pointer-events: none;
}
/* 中轴线：两端由 linear-gradient 淡出，所以这条短线段没有硬边。 */
.claddagh-axis {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 1;
  width: 300px;
  height: 4px;
  transform-origin: center center;
  will-change: background, transform, filter;
}
.claddagh-waiting {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: clamp(1.2rem, 2.8vw, 1.9rem);
  opacity: 0.5;
}
</style>
