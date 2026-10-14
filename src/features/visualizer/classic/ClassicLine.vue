<script setup lang="ts">
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
import {
  classicLineFrame,
  classicWordFrame,
  prepareClassicLine,
} from './classicFrame'
import { classicPixelFontSize, type ClassicTuning } from './classicLayout'

const props = defineProps<{
  line: Line
  currentTime: ReadableValue<number>
  theme: Theme
  tuning: ClassicTuning
  lyricsFontScale: number
  paused?: boolean
  staticMode?: boolean
  frameRate?: number
  seed?: string | number
}>()
const host = useTemplateRef<HTMLElement>('host')
const floating = useTemplateRef<HTMLElement>('floating')
const row = useTemplateRef<HTMLElement>('row')
// 响应式状态
const state = reactive({
  // 使用舞台的实际宽度测量字号与词距，兼容壁纸和小窗。
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
const prepared = computed(() => {
  // 测量依赖字体是否就绪，时间不参与布局计算。
  void state.fontRevision
  return prepareClassicLine({
    line: props.line,
    theme: props.theme,
    tuning: props.tuning,
    lyricsFontScale: props.lyricsFontScale,
    viewportWidth: state.width,
    seed: props.seed,
  })
})
const rowStyle = computed(() => ({
  justifyContent: props.staticMode
    ? 'center'
    : prepared.value.lineConfig.justifyContent,
  alignItems: prepared.value.lineConfig.alignItems,
  perspective: prepared.value.lineConfig.perspective + 'px',
  fontFamily: resolveThemeFontStack(props.theme),
  fontWeight: resolveThemeFontWeight(props.theme, 700),
  fontSize: classicPixelFontSize(props.lyricsFontScale, state.width) + 'px',
}))
interface WordElements {
  container: HTMLElement
  body: HTMLElement | null
  glows: HTMLElement[]
  ripple: HTMLElement | null
}
let elements: WordElements[] = []
function paint() {
  if (!row.value || !floating.value) return
  const time = props.currentTime.get()
  const lineFrame = classicLineFrame(prepared.value, time, props.staticMode)
  floating.value.style.transform = lineFrame.floatTransform
  row.value.style.transform = lineFrame.transform
  row.value.style.opacity = String(lineFrame.opacity)
  row.value.style.filter = lineFrame.filter
  for (let index = 0; index < elements.length; index += 1) {
    const word = prepared.value.words[index]
    const item = elements[index]!
    if (!word) continue
    const frame = classicWordFrame(
      word,
      prepared.value.profile,
      time,
      props.theme,
      props.staticMode
    )
    item.container.style.transform = frame.transform
    item.container.style.opacity = String(frame.opacity)
    item.container.dataset.status = frame.status
    if (item.body) {
      item.body.style.color = frame.color
      item.body.style.filter =
        frame.blur < 0.01 ? 'none' : 'blur(' + frame.blur.toFixed(3) + 'px)'
    }
    item.glows.forEach((glow, charIndex) => {
      glow.style.filter = frame.glows[charIndex] ?? 'none'
    })
    if (item.ripple) {
      item.ripple.style.transform =
        'translate(-50%, -50%) scale(' + frame.rippleScale.toFixed(4) + ')'
      item.ripple.style.opacity = String(frame.rippleOpacity)
    }
  }
}
watch(
  [row, prepared, () => props.staticMode],
  () => {
    elements = Array.from(
      row.value?.querySelectorAll<HTMLElement>('[data-classic-word]') ?? []
    ).map(container => ({
      container,
      body: container.querySelector<HTMLElement>('[data-classic-body]'),
      glows: Array.from(
        container.querySelectorAll<HTMLElement>('[data-classic-glow]')
      ),
      ripple: container.querySelector<HTMLElement>('[data-classic-ripple]'),
    }))
    paint()
  },
  { immediate: true, flush: 'post' }
)
useVisualizerFrame({
  source: () => props.currentTime,
  running: () => !props.paused && !props.staticMode && Boolean(row.value),
  frameRate: () => props.frameRate ?? 30,
  paint,
})
</script>

<template>
  <div
    ref="host"
    class="classic-stage"
  >
    <div
      ref="floating"
      class="classic-float"
    >
      <div
        ref="row"
        class="classic-row"
        :style="rowStyle"
      >
        <span
          v-for="item in prepared.words"
          :key="item.config.id"
          data-classic-word
          class="classic-word"
          :class="{ 'is-untimed': item.word.estimated }"
          :style="{
            marginRight: staticMode ? '0.2em' : item.config.marginRight,
            alignSelf: staticMode ? 'auto' : item.config.alignSelf,
          }"
        >
          <span
            v-if="!item.word.estimated && !staticMode"
            class="classic-glow"
            aria-hidden="true"
            :style="{ color: item.activeColor }"
          >
            <span
              v-for="(grapheme, index) in item.graphemes"
              :key="index"
              data-classic-glow
              >{{ grapheme.char }}</span
            >
          </span>
          <span
            data-classic-body
            class="classic-body"
            :style="{ color: theme.primaryColor }"
            >{{ item.word.text }}</span
          >
          <span
            v-if="line.isChorus && !item.word.estimated && !staticMode"
            data-classic-ripple
            class="classic-ripple"
            aria-hidden="true"
            :style="{ borderColor: item.activeColor }"
          />
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.classic-stage {
  position: absolute;
  inset: 15% 8% 18%;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.classic-float {
  width: 100%;
  max-width: 72rem;
}
.classic-row {
  display: flex;
  flex-wrap: wrap;
  align-content: center;
  width: 100%;
  gap: 1em 0;
  line-height: 1.22;
  transform-origin: center;
}
.classic-word {
  position: relative;
  display: inline-block;
  max-width: 100%;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  transform-origin: center;
}
.classic-word.is-untimed {
  text-align: center;
}
.classic-body {
  position: relative;
  z-index: 1;
  display: block;
}
.classic-glow {
  position: absolute;
  inset: 0;
  user-select: none;
  pointer-events: none;
}
.classic-ripple {
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
