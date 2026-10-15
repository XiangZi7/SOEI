<script setup lang="ts">
// Adapted from Folia tilt/VisualizerTilt.tsx (AGPL-3.0); see third_party/Folia-NOTICE.md.
import {
  computed,
  onMounted,
  onScopeDispose,
  reactive,
  useTemplateRef,
  watch,
} from 'vue'
import { useResizeObserver } from '@vueuse/core'
import { getLineRenderEndTime } from '../../lyrics/folia/renderHints'
import type { VisualizerSharedProps } from '../definition'
import { visualizerRuntime } from '../runtime'
import { useVisualizerFrame } from '../useVisualizerFrame'
import VisualizerSubtitleOverlay from '../VisualizerSubtitleOverlay.vue'
import TiltLine from './TiltLine.vue'
import {
  tiltCharFrame,
  tiltCharPulse,
  tiltSegmentFrame,
  tiltVisibleSegmentIndex,
} from './tiltFrame'
import {
  buildTiltCharTimings,
  buildTiltLayout,
  buildTiltSegmentTimings,
  resolveTiltTuning,
  tiltColors,
} from './tiltLayout'

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
const tuning = computed(() => resolveTiltTuning(props.tunings?.tilt))
const colors = computed(() => tiltColors(props.theme, tuning.value.colorScheme))

const host = useTemplateRef<HTMLElement>('host')
const stack = useTemplateRef<HTMLElement>('stack')
// 响应式状态
const state = reactive({
  // 用舞台实际宽度测量，兼容壁纸与小窗。
  width: 1200,
  // 离线字体加载完成后重新测量。
  fontRevision: 0,
})
useResizeObserver(host, entries => {
  const width = entries[0]?.contentRect.width
  if (width && width > 0) state.width = width
})
let disposed = false
onScopeDispose(() => {
  disposed = true
})
onMounted(() => {
  void document.fonts?.ready.then(() => {
    if (!disposed) state.fontRevision += 1
  })
})

const layout = computed(() => {
  const line = runtime.value.activeLine
  if (!line?.fullText) return null
  // 测量依赖字体是否就绪；时间不参与布局。
  void state.fontRevision
  return buildTiltLayout({
    fullText: line.fullText,
    lineSeed: line.startTime,
    tuning: tuning.value,
    theme: props.theme,
    fontScale: props.lyricsFontScale,
    viewportWidth: state.width,
  })
})
const segmentTimings = computed(() => {
  const line = runtime.value.activeLine
  if (!line || !layout.value) return []
  return buildTiltSegmentTimings(layout.value, line)
})

interface SegmentElements {
  container: HTMLElement
  isTilt: boolean
  start: number
  chars: {
    element: HTMLElement
    charIndex: number
    direction: number
  }[]
  timings: ReturnType<typeof buildTiltCharTimings>
  staggerUnit: number
}
let segments: SegmentElements[] = []

function collect() {
  const line = runtime.value.activeLine
  const current = layout.value
  if (!stack.value || !line || !current) {
    segments = []
    return
  }
  segments = Array.from(
    stack.value.querySelectorAll<HTMLElement>('[data-tilt-segment]')
  ).map((container, index) => {
    const segment = current.segments[index]!
    const timing = segmentTimings.value[index]
    // 斜体行的驻留偏移量由字号推出，与 TiltLine 内部保持一致。
    const fontPx = Number.parseFloat(getComputedStyle(container).fontSize) || 72
    return {
      container,
      isTilt: segment.isTilt,
      start: timing?.start ?? line.startTime,
      chars: Array.from(
        container.querySelectorAll<HTMLElement>('[data-tilt-char]')
      ).map(element => ({
        element,
        charIndex: Number(element.dataset.charIndex),
        direction: Number(element.dataset.direction),
      })),
      timings: buildTiltCharTimings(
        segment.charOffset,
        segment.text,
        timing?.start ?? line.startTime,
        timing?.end ?? getLineRenderEndTime(line),
        line
      ),
      staggerUnit: fontPx / 6,
    }
  })
}

function paint() {
  const line = runtime.value.activeLine
  if (!segments.length || !line) return
  const time = props.currentTime.get()
  const staticMode = Boolean(props.staticMode)
  const visibleIndex = staticMode
    ? segments.length - 1
    : tiltVisibleSegmentIndex(time, segmentTimings.value, line)
  segments.forEach((segment, index) => {
    const visible = index <= visibleIndex
    const frame = staticMode
      ? { opacity: visible ? 1 : 0, translateY: 0, scale: 1 }
      : tiltSegmentFrame(time, segment.start, visible, segment.isTilt)
    segment.container.style.opacity = String(frame.opacity)
    segment.container.style.transform =
      'translateY(' +
      frame.translateY.toFixed(3) +
      'px) scale(' +
      frame.scale.toFixed(4) +
      ')'
    for (const char of segment.chars) {
      if (staticMode) {
        char.element.style.opacity = visible ? '1' : '0'
        char.element.style.transform = 'none'
        continue
      }
      const timing =
        char.charIndex >= 0 ? segment.timings[char.charIndex] : undefined
      const pulse = timing ? tiltCharPulse(time, timing) : 0
      const charFrame = tiltCharFrame({
        timeSec: time,
        segmentStart: segment.start,
        charIndex: Math.max(0, char.charIndex),
        visible,
        isTilt: segment.isTilt,
        pulse: char.charIndex >= 0 ? pulse : 0,
        staggerOffset: char.direction * segment.staggerUnit,
      })
      char.element.style.opacity = String(charFrame.opacity)
      char.element.style.transform =
        'translateY(' +
        charFrame.translateY.toFixed(3) +
        'px) scale(' +
        charFrame.scale.toFixed(4) +
        ')'
    }
  })
}

watch(
  [stack, layout, segmentTimings, () => props.staticMode],
  () => {
    collect()
    paint()
  },
  { immediate: true, flush: 'post' }
)
useVisualizerFrame({
  source: () => props.currentTime,
  running: () =>
    !props.paused &&
    !props.staticMode &&
    Boolean(stack.value) &&
    !!layout.value,
  frameRate: () => props.frameRate ?? 30,
  paint,
})
</script>

<template>
  <div
    ref="host"
    class="tilt-stage"
  >
    <div
      v-if="showText && runtime.activeLine && layout"
      ref="stack"
      :key="runtime.activeLine.id ?? runtime.activeLine.startTime"
      class="tilt-stack"
    >
      <TiltLine
        v-for="(segment, index) in layout.segments"
        :key="`${index}-${segment.text}`"
        :segment="segment"
        :theme="theme"
        :colors="colors"
        :font-scale="lyricsFontScale"
        :scale-multiplier="layout.scaleMultiplier"
      />
    </div>
    <div
      v-else-if="showText"
      class="tilt-waiting"
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
.tilt-stage {
  position: absolute;
  inset: 15% 8% 18%;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.tilt-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  max-width: 100%;
}
@media (min-width: 640px) {
  .tilt-stack {
    gap: 1rem;
  }
}
.tilt-waiting {
  font-size: clamp(1.5rem, 3.5vw, 2.25rem);
  opacity: 0.5;
}
</style>
