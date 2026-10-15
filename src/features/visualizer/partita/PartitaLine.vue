<script setup lang="ts">
// Adapted from Folia partita/VisualizerPartita.tsx (AGPL-3.0); see third_party/Folia-NOTICE.md.
import {
  computed,
  onMounted,
  onScopeDispose,
  reactive,
  useTemplateRef,
  watch,
} from 'vue'
import { useResizeObserver } from '@vueuse/core'
import type { Line } from '../../lyrics/folia/model'
import type { Theme } from '../../theme/model'
import {
  resolveThemeFontStack,
  resolveThemeFontWeight,
} from '../../theme/fontStacks'
import type { ReadableValue } from '../timeSource'
import { useVisualizerFrame } from '../useVisualizerFrame'
import { breathingFrame, lineRevealFrame, wordRevealFrame } from '../wordReveal'
import { partitaChunkFrame, preparePartitaLine } from './partitaFrame'
import { partitaFontSize, type PartitaTuning } from './partitaLayout'

// 一整行：竖列里的多个 chunk，每个 chunk 一条导引线。
// 逐帧样式在这里统一写，所以整个舞台只有一条帧循环。
const props = defineProps<{
  line: Line
  currentTime: ReadableValue<number>
  theme: Theme
  tuning: PartitaTuning
  lyricsFontScale: number
  /** 呼吸浮动的幅度，由模式按强度给出；null 表示关闭。 */
  breathing: {
    distancePx: number
    durationSec: number
    scaleAmount: number
  } | null
  paused?: boolean
  staticMode?: boolean
  frameRate?: number
}>()

const host = useTemplateRef<HTMLElement>('host')
const floating = useTemplateRef<HTMLElement>('floating')
const column = useTemplateRef<HTMLElement>('column')
// 响应式状态
const state = reactive({
  // 用舞台实际高度决定行数，兼容壁纸与小窗。
  height: 800,
  // 离线字体加载完成后重新测量。
  fontRevision: 0,
})
useResizeObserver(host, entries => {
  const height = entries[0]?.contentRect.height
  if (height && height > 0) state.height = height
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

const prepared = computed(() => {
  void state.fontRevision
  return preparePartitaLine({
    line: props.line,
    theme: props.theme,
    stageHeight: state.height,
    tuning: props.tuning,
  })
})
const fontSize = computed(() =>
  partitaFontSize(prepared.value.totalGraphemes, props.lyricsFontScale)
)

interface ChunkElements {
  container: HTMLElement
  guides: HTMLElement[]
  words: {
    container: HTMLElement
    body: HTMLElement | null
    glows: HTMLElement[]
    ripple: HTMLElement | null
  }[]
}
let elements: ChunkElements[] = []

function collect() {
  elements = Array.from(
    column.value?.querySelectorAll<HTMLElement>('[data-partita-chunk]') ?? []
  ).map(container => ({
    container,
    guides: Array.from(
      container.querySelectorAll<HTMLElement>('[data-partita-guide]')
    ),
    words: Array.from(
      container.querySelectorAll<HTMLElement>('[data-partita-word]')
    ).map(word => ({
      container: word,
      body: word.querySelector<HTMLElement>('[data-partita-body]'),
      glows: Array.from(
        word.querySelectorAll<HTMLElement>('[data-partita-glow]')
      ),
      ripple: word.querySelector<HTMLElement>('[data-partita-ripple]'),
    })),
  }))
}

function paint() {
  if (!column.value || !floating.value) return
  const time = props.currentTime.get()
  const staticMode = Boolean(props.staticMode)
  const line = lineRevealFrame(
    prepared.value.profile,
    props.line.startTime,
    time,
    staticMode
  )
  floating.value.style.transform =
    staticMode || !props.breathing
      ? 'none'
      : breathingFrame(props.breathing, props.line.startTime, time)
  column.value.style.transform = line.transform
  column.value.style.opacity = String(line.opacity)
  column.value.style.filter = line.filter

  elements.forEach((item, chunkIndex) => {
    const chunk = prepared.value.chunks[chunkIndex]
    if (!chunk) return
    const frame = partitaChunkFrame(
      chunk,
      prepared.value.profile,
      time,
      staticMode
    )
    item.container.style.transform = frame.transform
    item.container.style.opacity = String(frame.opacity)
    item.container.dataset.status = frame.status
    for (const guide of item.guides) {
      const horizontal = guide.dataset.partitaGuide === 'horizontal'
      guide.style.backgroundColor = frame.guideColor
      guide.style.boxShadow = horizontal
        ? frame.guideGlowHorizontal
        : frame.guideGlowVertical
      guide.style.transform = horizontal
        ? 'scaleX(' + frame.guideScale.toFixed(4) + ')'
        : 'scaleY(' + frame.guideScale.toFixed(4) + ')'
      guide.style.opacity = String(frame.guideScale > 0 ? 1 : 0)
    }
    item.words.forEach((element, wordIndex) => {
      const word = chunk.words[wordIndex]
      if (!word) return
      const wordFrame = wordRevealFrame(
        word,
        prepared.value.profile,
        time,
        props.theme,
        staticMode
      )
      element.container.style.transform = wordFrame.transform
      element.container.style.opacity = String(wordFrame.opacity)
      element.container.dataset.status = wordFrame.status
      if (element.body) {
        element.body.style.color = wordFrame.color
        element.body.style.filter =
          wordFrame.blur < 0.01
            ? 'none'
            : 'blur(' + wordFrame.blur.toFixed(3) + 'px)'
      }
      element.glows.forEach((glow, charIndex) => {
        glow.style.filter = wordFrame.glows[charIndex] ?? 'none'
      })
      if (element.ripple) {
        element.ripple.style.transform =
          'translate(-50%, -50%) scale(' +
          wordFrame.rippleScale.toFixed(4) +
          ')'
        element.ripple.style.opacity = String(wordFrame.rippleOpacity)
      }
    })
  })
}

watch(
  [column, prepared, () => props.staticMode],
  () => {
    collect()
    paint()
  },
  { immediate: true, flush: 'post' }
)
useVisualizerFrame({
  source: () => props.currentTime,
  running: () => !props.paused && !props.staticMode && Boolean(column.value),
  frameRate: () => props.frameRate ?? 30,
  paint,
})
</script>

<template>
  <div
    ref="host"
    class="partita-stage"
  >
    <div
      ref="floating"
      class="partita-float"
    >
      <div
        ref="column"
        class="partita-column"
        :style="{
          perspective: `${prepared.perspective}px`,
          fontFamily: resolveThemeFontStack(theme),
          fontWeight: resolveThemeFontWeight(theme, 700),
          fontSize,
        }"
      >
        <div
          v-for="chunk in prepared.chunks"
          :key="chunk.chunk.config.id"
          data-partita-chunk
          data-status="waiting"
          class="partita-chunk"
          :style="{ marginBottom: chunk.chunk.config.marginBottom }"
        >
          <template v-if="tuning.showGuideLines && !staticMode">
            <span
              data-partita-guide="vertical"
              class="partita-guide-vertical"
              :class="chunk.guide === 'left' ? 'is-left' : 'is-right'"
              aria-hidden="true"
            />
            <span
              data-partita-guide="horizontal"
              class="partita-guide-horizontal"
              :class="chunk.guide === 'left' ? 'is-left' : 'is-right'"
              aria-hidden="true"
            />
          </template>
          <span
            v-for="(item, wordIndex) in chunk.words"
            :key="`${item.word.text}-${wordIndex}`"
            data-partita-word
            class="partita-word"
            :class="{ 'is-untimed': item.word.estimated }"
          >
            <span
              v-if="!item.word.estimated && !staticMode"
              class="partita-glow"
              aria-hidden="true"
              :style="{ color: item.activeColor }"
            >
              <span
                v-for="(grapheme, charIndex) in item.graphemes"
                :key="charIndex"
                data-partita-glow
                >{{ grapheme.char }}</span
              >
            </span>
            <span
              data-partita-body
              class="partita-body"
              :style="{ color: theme.primaryColor }"
              >{{ item.word.text }}</span
            >
            <span
              v-if="line.isChorus && !item.word.estimated && !staticMode"
              data-partita-ripple
              class="partita-ripple"
              aria-hidden="true"
              :style="{ borderColor: item.activeColor }"
            />
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.partita-stage {
  position: absolute;
  inset: 12% 8% 16%;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.partita-float {
  display: flex;
  justify-content: center;
  width: 100%;
  max-width: 64rem;
}
.partita-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transform-origin: center;
}
.partita-chunk {
  position: relative;
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  padding: 0.2rem 0.5rem;
  line-height: 1;
  white-space: nowrap;
  transform-origin: center;
  will-change: transform, opacity;
}
/* 导引线：竖线落在 chunk 外侧，横线沿底边延伸出去一截。 */
.partita-guide-vertical {
  position: absolute;
  bottom: -16px;
  width: 1px;
  height: 32px;
  transform-origin: bottom;
  pointer-events: none;
}
.partita-guide-vertical.is-left {
  left: -8px;
}
.partita-guide-vertical.is-right {
  right: -8px;
}
.partita-guide-horizontal {
  position: absolute;
  bottom: -8px;
  width: calc(100% + 36px);
  height: 1px;
  pointer-events: none;
}
.partita-guide-horizontal.is-left {
  left: -16px;
  transform-origin: left;
}
.partita-guide-horizontal.is-right {
  right: -16px;
  transform-origin: right;
}
.partita-word {
  position: relative;
  display: inline-block;
  margin-right: 0.8rem;
  white-space: pre-wrap;
  transform-origin: center;
  will-change: transform, opacity;
}
.partita-word:last-child {
  margin-right: 0;
}
.partita-word.is-untimed {
  text-align: center;
}
.partita-body {
  position: relative;
  z-index: 1;
  display: block;
}
.partita-glow {
  position: absolute;
  inset: 0;
  user-select: none;
  pointer-events: none;
}
.partita-ripple {
  position: absolute;
  top: 50%;
  left: 50%;
  height: 150%;
  aspect-ratio: 1;
  border: 1px solid;
  border-radius: 50%;
  filter: blur(1px);
  opacity: 0;
  pointer-events: none;
}
</style>
