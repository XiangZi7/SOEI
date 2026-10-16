<script setup lang="ts">
import { computed, nextTick, onScopeDispose, reactive, shallowRef, useTemplateRef, watch } from 'vue'
import { useElementSize, useEventListener, useTimeoutFn } from '@vueuse/core'
import type { VisualizerSharedProps } from '../definition'
import { getRecentCompletedLine, getUpcomingLine } from '../runtime'
import { useVisualizerFrame } from '../useVisualizerFrame'
import { springStep } from '../easing'
import { buildMonetVisibleLineEntries, clearMonetMeasurementCaches, resolveMonetLargeScreenScale } from '../../lyrics/folia/monetLyricsModel'
import { resolveThemeFontStack, resolveThemeFontWeight, resolveThemeTranslationFontStack } from '../../theme/fontStacks'
import { buildScrollableRailEntries, buildPositionedEntries, type MonetLayoutCache } from './monetRailLayout'
import MonetLyricLine from './MonetLyricLine.vue'
const props = defineProps<VisualizerSharedProps & { fontScale: number; keywordColoring: boolean }>()
const host = useTemplateRef<HTMLElement>('host')
const { width, height } = useElementSize(host)
const manualAnchor = shallowRef<number | null>(null)
const gapAnchor = shallowRef(0)
const fontsEpoch = shallowRef(0)
const cache: MonetLayoutCache = new Map()
const lineRefs = new Map<number, InstanceType<typeof MonetLyricLine>>()
const state = reactive({ browsing: false })
const { start: scheduleReturn, stop: cancelReturn } = useTimeoutFn(() => { manualAnchor.value = null; state.browsing = false }, 1800, { immediate: false })
const { stiffness, damping, mass } = { stiffness: 142, damping: 28, mass: 0.82 }
const scrollSpring = springStep(stiffness, damping, mass, 1)
const fontStack = computed(() => resolveThemeFontStack(props.theme))
const fontWeight = computed(() => resolveThemeFontWeight(props.theme, 600))
const subtitleTheme = computed(() => props.subtitleTheme ?? props.theme)
const fontPx = computed(() => Math.min(36.48, Math.max(21.44, (host.value?.closest('.visualizer-shell')?.clientWidth ?? 1280) * 0.0275)) * props.fontScale * (props.lyricsFontScale ?? 1) * resolveMonetLargeScreenScale(width.value))
const glow = computed(() => Math.round(fontPx.value * 1.2))
const visibleEntries = computed(() => {
  void gapAnchor.value
  if (manualAnchor.value !== null) return buildScrollableRailEntries(props.lines, manualAnchor.value, props.currentLineIndex)
  const time = props.currentTime.get()
  return buildMonetVisibleLineEntries({ lines: props.lines, currentLineIndex: props.currentLineIndex, activeLine: props.lines[props.currentLineIndex] ?? null, recentCompletedLine: getRecentCompletedLine({ lines: props.lines, currentLineIndex: props.currentLineIndex, currentTime: time }), upcomingLine: getUpcomingLine(props.lines, props.currentLineIndex, time), currentTime: time, before: 4, after: 4 })
})
function prepare(entries: typeof visibleEntries.value) {
  return buildPositionedEntries(entries, { width: width.value, height: height.value }, props.theme, fontPx.value, fontPx.value * 0.72, { translationFontPx: fontPx.value * 0.51 * (props.subtitleFontScale ?? 1), fontStack: fontStack.value, translationFontStack: resolveThemeTranslationFontStack(subtitleTheme.value), fontWeight: fontWeight.value, translationFontWeight: resolveThemeFontWeight(subtitleTheme.value, 500), secondaryTranslationFontWeight: resolveThemeFontWeight(subtitleTheme.value, 400), subtitleContentMode: props.hideTranslationSubtitle ? 'none' : props.subtitleContentMode ?? 'translation' }, glow.value, cache)
}
const entries = computed(() => { void fontsEpoch.value; return prepare(visibleEntries.value) })
const previousEntries = computed(() => {
  if (props.currentLineIndex <= 0 || manualAnchor.value !== null) return new Map()
  const previous = props.currentLineIndex - 1
  return new Map(prepare(buildScrollableRailEntries(props.lines, previous, previous)).map(entry => [entry.index, entry]))
})
function paint() {
  const time = props.currentTime.get()
  const active = props.lines[props.currentLineIndex]
  const blend = props.staticMode || manualAnchor.value !== null || !active || active.endTime - active.startTime < 0.45 ? 1 : scrollSpring(Math.max(0, time - active.startTime))
  for (const entry of entries.value) {
    const row = lineRefs.get(entry.index)
    if (!row) continue
    const previous = previousEntries.value.get(entry.index) ?? entry
    const mix = (from: number, to: number) => from + (to - from) * blend
    row.position(mix(previous.y, entry.y), mix(previous.tone.scale, entry.tone.scale), mix(previous.tone.opacity, entry.tone.opacity), mix(previous.tone.blurPx, entry.tone.blurPx))
    row.paint(time)
  }
}
function moveAnchor(steps: number) {
  const automatic = visibleEntries.value.find(entry => entry.offset === 0)?.index ?? 0
  manualAnchor.value = Math.max(0, Math.min(props.lines.length - 1, (manualAnchor.value ?? automatic) + steps))
  state.browsing = true; scheduleReturn()
}
let wheelTotal = 0, touchY: number | null = null
function wheel(event: WheelEvent) {
  if (Math.sign(event.deltaY) !== Math.sign(wheelTotal)) wheelTotal = 0
  wheelTotal += event.deltaY
  if (Math.abs(wheelTotal) >= 72) { moveAnchor(Math.sign(wheelTotal)); wheelTotal = 0 }
}
function touch(event: TouchEvent) {
  const y = event.touches[0]?.clientY
  if (y === undefined) return
  if (touchY !== null && Math.abs(touchY - y) >= 52) { moveAnchor(Math.sign(touchY - y)); touchY = y }
  else if (touchY === null) touchY = y
}
watch(() => props.currentTime, (clock, _previous, onCleanup) => {
  const update = () => { if (props.currentLineIndex < 0) gapAnchor.value = props.lines.findIndex(line => line.startTime > clock.get()) }
  const stop = clock.subscribe?.(update); if (stop) onCleanup(stop); update()
}, { immediate: true })
watch([entries, previousEntries], () => { void nextTick(paint) }, { flush: 'post' })
watch(() => props.lines, () => { manualAnchor.value = null; cache.clear(); lineRefs.clear(); cancelReturn() })
function fontsLoaded() { clearMonetMeasurementCaches(); cache.clear(); fontsEpoch.value += 1 }
useEventListener(typeof document === 'undefined' ? undefined : document.fonts, 'loadingdone', fontsLoaded)
useVisualizerFrame({ source: () => props.currentTime, running: () => !props.paused && !props.staticMode, frameRate: () => props.frameRate ?? 30, paint })
onScopeDispose(() => { cache.clear(); lineRefs.clear() })
</script>
<template>
  <div ref="host" class="monet-rail" :class="{ 'is-static': staticMode }" role="region" aria-label="印象歌词轨道" @wheel.prevent.stop="wheel" @touchstart.stop="touchY = $event.touches[0]?.clientY ?? null" @touchmove.prevent.stop="touch" @touchend="touchY = null" @keydown.up.prevent="moveAnchor(-1)" @keydown.down.prevent="moveAnchor(1)">
    <div class="absolute inset-y-0" :style="{ left: glow + 'px', right: glow + 'px' }">
      <MonetLyricLine v-for="entry in entries" :key="entry.key" :ref="element => { if (element) lineRefs.set(entry.index, element as InstanceType<typeof MonetLyricLine>); else lineRefs.delete(entry.index) }" :entry="entry" :theme="theme" :font-px="fontPx" :font-stack="fontStack" :font-weight="fontWeight" :fonts-epoch="fontsEpoch" :keyword-coloring="keywordColoring" :reduced-motion="staticMode" :current-time="currentTime" :can-seek="Boolean(onLyricLineSeek) && !isPreviewMode" @seek="onLyricLineSeek?.($event)" />
    </div>
    <button v-if="state.browsing" class="monet-return" @click="manualAnchor = null; state.browsing = false; cancelReturn()">回到当前歌词</button>
    <p v-if="!entries.length" class="absolute inset-0 flex items-center justify-center text-caption text-muted">暂无歌词</p>
  </div>
</template>
<style scoped>
.monet-rail { position: relative; width: 100%; height: clamp(260px, 44vh, 520px); overflow: hidden; touch-action: none; mask-image: linear-gradient(transparent, #000 10%, #000 86%, transparent); }
.monet-return { position: absolute; bottom: 10%; right: 1rem; z-index: 10; padding: 8px 12px; border: 1px solid currentColor; border-radius: 18px; background: var(--color-panel); font-size: 11px; }
</style>
