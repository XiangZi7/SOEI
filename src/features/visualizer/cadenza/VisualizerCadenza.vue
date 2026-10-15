<script setup lang="ts">
// Adapted from Folia cadenza/VisualizerCadenza.tsx (AGPL-3.0); see third_party/Folia-NOTICE.md.
import { computed, reactive, useTemplateRef, watch } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import { getLineRenderEndTime } from '../../lyrics/folia/renderHints'
import type { Line } from '../../lyrics/folia/model'
import { colorWithAlpha } from '../../theme/colorMath'
import type { VisualizerSharedProps } from '../definition'
import { prepareActiveAndUpcoming, visualizerRuntime } from '../runtime'
import { useVisualizerFrame } from '../useVisualizerFrame'
import VisualizerSubtitleOverlay from '../VisualizerSubtitleOverlay.vue'
import {
  prepareCadenzaLine,
  resolveCadenzaTuning,
  type CadenzaPreparedLine,
} from './cadenzaLayout'
import { cadenzaLineEnvelope, resolveCadenzaLineTiming } from './cadenzaTiming'
import {
  cadenzaBodyColor,
  cadenzaGlowFilter,
  cadenzaGraphemeGlow,
  cadenzaPlacementTarget,
  cadenzaRipple,
  followCadenzaState,
  initialCadenzaState,
  isCadenzaSeek,
  snapCadenzaState,
  type CadenzaPlacementState,
} from './cadenzaFrame'

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
const tuning = computed(() => resolveCadenzaTuning(props.tunings?.cadenza))

const host = useTemplateRef<HTMLElement>('host')
const lineLayer = useTemplateRef<HTMLElement>('lineLayer')
const overlay = useTemplateRef<HTMLElement>('overlay')
const ripples = useTemplateRef<HTMLElement>('ripples')
const state = reactive({ width: 0, height: 0 })
useResizeObserver(host, entries => {
  const rect = entries[0]?.contentRect
  if (rect && rect.width > 0 && rect.height > 0) {
    state.width = rect.width
    state.height = rect.height
  }
})

// 排版缓存：一行只排一次。缓存键只含影响排版的量，
// 上下文（视口/主题/调参）变化时整表作废。
const prepareContext = computed(() => ({
  stageWidth: state.width,
  stageHeight: state.height,
  theme: props.theme,
  fontScale: tuning.value.fontScale * props.lyricsFontScale,
  widthRatio: tuning.value.widthRatio,
}))
const contextKey = computed(() =>
  [
    state.width,
    state.height,
    props.theme.fontStyle,
    props.theme.fontFamily ?? '',
    props.theme.fontFamilyStack?.join(',') ?? '',
    props.theme.fontWeight ?? 'auto',
    props.theme.animationIntensity,
    props.theme.accentColor,
    // 逐词高亮色来自主题，换主题后已排过的行也必须重排。
    (props.theme.wordColors ?? [])
      .map(entry => `${entry.word}:${entry.color}`)
      .join('||'),
    prepareContext.value.fontScale,
    prepareContext.value.widthRatio,
  ].join('|')
)

const preparedCache = new Map<string, CadenzaPreparedLine>()
let cachedContextKey = ''
const lineKey = (line: Line) =>
  [line.startTime, line.endTime, line.fullText, line.words.length].join('|')

function getPrepared(line: Line | null): CadenzaPreparedLine | null {
  if (!line || state.width <= 0 || state.height <= 0) return null
  if (cachedContextKey !== contextKey.value) {
    preparedCache.clear()
    cachedContextKey = contextKey.value
  }
  const key = lineKey(line)
  const cached = preparedCache.get(key)
  if (cached) return cached
  const next = prepareCadenzaLine(line, prepareContext.value)
  if (next) preparedCache.set(key, next)
  return next
}

/** 活跃行的排版。顺带预热下一行，避免切行那一帧才开始测量。 */
const prepared = computed(() => {
  if (!props.showText) {
    getPrepared(runtime.value.upcomingLine ?? null)
    return null
  }
  return prepareActiveAndUpcoming({
    activeLine: runtime.value.activeLine,
    upcomingLine: runtime.value.upcomingLine,
    prepareLine: line => getPrepared(line ?? null),
  })
})

interface OverlayNodes {
  word: HTMLElement
  inner: HTMLElement
  /** 涟漪在独立的更低图层里：上游用画布画它，画布整体压在文字之下。 */
  ripple: HTMLElement
  glyphs: HTMLElement[]
  /** 字素签名，变了才重建子节点。 */
  signature: string
}
const overlayNodes = new Map<string, OverlayNodes>()
const placementStates = new Map<string, CadenzaPlacementState>()
let previousTime: number | null = null

function createOverlayNodes(): OverlayNodes {
  const word = document.createElement('div')
  word.className = 'cadenza-word'
  word.setAttribute('aria-hidden', 'true')
  const inner = document.createElement('div')
  inner.className = 'cadenza-word-inner'
  word.appendChild(inner)
  const ripple = document.createElement('div')
  ripple.className = 'cadenza-ripple'
  ripple.setAttribute('aria-hidden', 'true')
  return { word, inner, ripple, glyphs: [], signature: '' }
}

function removeOverlayNodes(nodes: OverlayNodes) {
  nodes.word.remove()
  nodes.ripple.remove()
}

/**
 * 同步字素 span。上游把发光放在一个透明文字的独立图层上，
 * 这里改成直接给正文 span 加 drop-shadow（原因见 cadenzaFrame.ts），
 * 所以逐字发光时正文本身就要按字素拆开。
 */
function syncGlyphs(nodes: OverlayNodes, texts: string[]) {
  // 分隔符不可省：join('') 会让 ['ab'] 与 ['a','b'] 得到同样的签名，
  // 切换逐字发光时就不会重建 span。
  const signature = texts.join('\u0001')
  if (nodes.signature === signature) return
  nodes.inner.replaceChildren()
  nodes.glyphs = texts.map(text => {
    const span = document.createElement('span')
    span.className = 'cadenza-glyph'
    span.textContent = text
    nodes.inner.appendChild(span)
    return span
  })
  nodes.signature = signature
}

function clearOverlay() {
  for (const nodes of overlayNodes.values()) removeOverlayNodes(nodes)
  overlayNodes.clear()
  placementStates.clear()
}

function paint() {
  const layer = lineLayer.value
  const overlayHost = overlay.value
  const rippleHost = ripples.value
  if (!layer || !overlayHost || !rippleHost) return

  const activeLine = runtime.value.activeLine
  const preparedLine = prepared.value
  if (!props.showText || !preparedLine || !activeLine) {
    layer.style.opacity = '0'
    layer.style.filter = 'none'
    layer.style.transform = 'scale(1)'
    clearOverlay()
    previousTime = null
    return
  }

  const time = props.currentTime.get()
  const seeked = isCadenzaSeek(previousTime, time)
  // 跟随器用真实帧间隔，掉帧时收敛速度不变。
  const delta =
    previousTime === null || seeked
      ? 1 / 60
      : Math.max(1 / 240, Math.min(time - previousTime, 0.05))
  previousTime = time

  const staticMode = Boolean(props.staticMode)
  const paused = Boolean(props.paused)
  const timing = resolveCadenzaLineTiming(activeLine)
  const envelope = staticMode
    ? { opacity: 1, scale: 1, blur: 0 }
    : cadenzaLineEnvelope(time, activeLine, timing)
  layer.style.opacity = envelope.opacity.toFixed(3)
  layer.style.filter =
    envelope.blur > 0.05 ? `blur(${envelope.blur.toFixed(2)}px)` : 'none'
  layer.style.transform = `scale(${envelope.scale.toFixed(4)})`

  const energy =
    paused || staticMode ? 0 : Math.min(1, props.audioPower.get() / 255)
  const motionEnergy = energy * tuning.value.motionAmount
  // 整行的缓慢起伏，让画面在词事件之间不会完全静止。
  const focusY =
    state.height * 0.42 +
    (staticMode ? 0 : Math.sin(time * 2.3) * (3 + motionEnergy * 8))
  const blurScale = 1 + energy * 0.22
  const isChorus = Boolean(activeLine.isChorus)

  // 目标只算一遍，再按 waiting → passed → active 排序：活跃词盖在最上层。
  const order = { waiting: 0, passed: 1, active: 2 } as const
  const frames = preparedLine.placements
    .map((placement, index) => ({
      placement,
      target: cadenzaPlacementTarget({
        placement,
        placementIndex: index,
        timeSec: time,
        timing,
        theme: props.theme,
        stageWidth: state.width,
        focusY,
        motionEnergy,
        staticMode,
      }),
    }))
    .sort((a, b) => order[a.target.status] - order[b.target.status])

  const liveIds = new Set<string>()
  frames.forEach(({ placement, target }, zIndex) => {
    let placementState = placementStates.get(placement.id)
    if (!placementState) {
      placementState = initialCadenzaState(
        placement,
        target,
        time,
        timing.wordRevealMode === 'instant'
      )
      placementStates.set(placement.id, placementState)
    } else if (seeked || staticMode) {
      // Seek 之后第一帧就要是正确结果，不补演跟随动画。
      snapCadenzaState(placementState, target)
    } else {
      followCadenzaState(placementState, target, delta)
    }

    const existing = overlayNodes.get(placement.id)
    if (placementState.bodyAlpha < 0.015 && placementState.glowAlpha < 0.015) {
      if (existing) {
        removeOverlayNodes(existing)
        overlayNodes.delete(placement.id)
      }
      return
    }

    liveIds.add(placement.id)
    const nodes = existing ?? createOverlayNodes()
    if (!existing) {
      overlayNodes.set(placement.id, nodes)
      overlayHost.appendChild(nodes.word)
      rippleHost.appendChild(nodes.ripple)
    }

    // 锚点就是词的视觉中心。涟漪用同一个锚点，但不跟着旋转和缩放。
    const anchorX = placementState.x + placement.width / 2
    const anchorY = placementState.y - placement.height * 0.42
    nodes.word.style.transform =
      `translate3d(${anchorX.toFixed(2)}px, ${anchorY.toFixed(2)}px, 0) ` +
      `rotate(${placementState.rotation.toFixed(3)}deg) ` +
      `scale(${placementState.scale.toFixed(4)})`
    nodes.word.style.zIndex = String(zIndex)
    nodes.inner.style.font = preparedLine.font
    nodes.inner.style.transform =
      `translate3d(${placement.offsetX.toFixed(2)}px, ` +
      `${placement.offsetY.toFixed(2)}px, 0)`
    nodes.inner.style.opacity = placementState.bodyAlpha.toFixed(3)
    nodes.inner.style.filter =
      placementState.blur > 0.05
        ? `blur(${placementState.blur.toFixed(2)}px)`
        : 'none'

    const color = cadenzaBodyColor(
      props.theme,
      placement,
      placementState.activeMix
    )
    syncGlyphs(
      nodes,
      placement.splitGlow ? placement.graphemes : [placement.text]
    )
    const glowAlpha = placementState.glowAlpha
    nodes.glyphs.forEach((span, glyphIndex) => {
      span.style.color = color
      span.style.filter = staticMode
        ? 'none'
        : cadenzaGlowFilter(
            placement.color,
            cadenzaGraphemeGlow(
              placement,
              glyphIndex,
              time,
              timing,
              glowAlpha,
              tuning.value.glowIntensity
            ),
            blurScale
          )
    })

    const ripple = staticMode
      ? null
      : cadenzaRipple(placement, target, placementState, isChorus)
    if (ripple) {
      nodes.ripple.style.display = 'block'
      nodes.ripple.style.width = `${ripple.size.toFixed(1)}px`
      nodes.ripple.style.height = `${ripple.size.toFixed(1)}px`
      nodes.ripple.style.transform =
        `translate3d(${anchorX.toFixed(2)}px, ${anchorY.toFixed(2)}px, 0) ` +
        `translate(-50%, -50%)`
      nodes.ripple.style.borderColor = colorWithAlpha(
        ripple.color,
        ripple.opacity
      )
    } else {
      nodes.ripple.style.display = 'none'
    }
  })

  for (const [id, nodes] of overlayNodes)
    if (!liveIds.has(id)) {
      removeOverlayNodes(nodes)
      overlayNodes.delete(id)
    }
  const placementIds = new Set(
    preparedLine.placements.map(placement => placement.id)
  )
  for (const id of [...placementStates.keys()])
    if (!placementIds.has(id)) placementStates.delete(id)
}

watch(
  [prepared, () => props.staticMode, () => props.showText],
  () => {
    // 换行或重排版：旧 placement 的跟随状态不能继承到新的几何上。
    clearOverlay()
    previousTime = null
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
    class="cadenza-stage"
  >
    <div
      ref="lineLayer"
      class="cadenza-line-layer"
    >
      <div
        ref="ripples"
        class="cadenza-ripples"
      />
      <div
        ref="overlay"
        class="cadenza-overlay"
      />
    </div>
    <div
      v-if="showText && !runtime.activeLine"
      class="cadenza-waiting"
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
.cadenza-stage {
  position: absolute;
  inset: 0;
  z-index: 10;
  overflow: hidden;
  user-select: none;
  pointer-events: none;
}
.cadenza-line-layer {
  position: absolute;
  inset: 0;
  opacity: 0;
  transform: scale(1);
  transform-origin: 50% 42%;
  will-change: opacity, transform, filter;
}
.cadenza-ripples,
.cadenza-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.cadenza-ripples {
  z-index: 0;
}
.cadenza-overlay {
  z-index: 1;
}
.cadenza-stage :deep(.cadenza-word) {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  /* 独立合成层：每帧都在变的 scale 否则会反复重栅格化整个词。 */
  will-change: transform;
}
.cadenza-stage :deep(.cadenza-word-inner) {
  position: relative;
  display: inline-block;
  line-height: 1;
  white-space: nowrap;
  will-change: opacity, filter;
}
.cadenza-stage :deep(.cadenza-glyph) {
  line-height: 1;
  white-space: pre;
  will-change: filter, color;
}
/* 副歌涟漪：以词的视觉中心为圆心向外扩散。 */
.cadenza-stage :deep(.cadenza-ripple) {
  position: absolute;
  top: 0;
  left: 0;
  display: none;
  box-sizing: border-box;
  border: 1.2px solid transparent;
  border-radius: 50%;
  transform-origin: 0 0;
  pointer-events: none;
}
.cadenza-waiting {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: clamp(1.2rem, 2.8vw, 1.9rem);
  opacity: 0.5;
}
</style>
