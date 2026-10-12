<script setup lang="ts">
import {
  computed,
  nextTick,
  onScopeDispose,
  reactive,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue'
import { useEventListener, useResizeObserver } from '@vueuse/core'
import type { LyricLine } from '../../types/music'
import { toFoliaLine } from '../lyrics/adapter'
import {
  buildMonetVisibleLineEntries,
  buildMonetLayoutCacheKey,
  clearMonetMeasurementCaches,
  measureMonetLineLayout,
  type MonetMeasuredLineLayout,
  type MonetVisibleLineEntry,
} from '../lyrics/folia/monetLyricsModel'
import TimedLyricText from './TimedLyricText.vue'
import LyricAnnotations from './LyricAnnotations.vue'

// A bounded, measured lyric window. Only timing styles change on each clock tick.
const props = defineProps<{
  lines: LyricLine[]
  index: number
  positionMs: number
  durationMs?: number
  reducedMotion: boolean
  showcase?: boolean
  agents?: Record<string, { name?: string }>
}>()
const emit = defineEmits<{ seek: [positionMs: number] }>()
const root = useTemplateRef<HTMLElement>('root')
const geometry = reactive({
  width: 680,
  height: 340,
  fontPx: 36,
  fontStack: 'serif',
  ready: false,
})
const fontEpoch = shallowRef(0)
const rowHeights = shallowRef<Record<string, number>>({})
const rowWidths = shallowRef<Record<string, number>>({})
const cache = new Map<string, MonetMeasuredLineLayout>()
const rowNodes = shallowRef<HTMLElement[]>([])
let disposed = false
const browseIndex = shallowRef<number | null>(null)
let browseTimer: ReturnType<typeof setTimeout> | undefined
function browse(direction: number) {
  browseIndex.value = Math.max(
    0,
    Math.min(
      props.lines.length - 1,
      (browseIndex.value ?? Math.max(0, props.index)) + direction
    )
  )
  clearTimeout(browseTimer)
  browseTimer = setTimeout(() => {
    browseIndex.value = null
  }, 1800)
}
const source = computed(() =>
  props.lines.map((line, index) =>
    toFoliaLine(
      line,
      props.lines[index + 1]?.startMs ?? props.durationMs ?? line.startMs + 5000
    )
  )
)
const entries = computed<MonetVisibleLineEntry[]>(previous => {
  const lines = source.value
  const current = lines[props.index] ?? null
  const active =
    current &&
    props.positionMs / 1000 <=
      (current.renderHints?.renderEndTime ?? current.endTime)
      ? current
      : null
  const next = lines[Math.max(0, props.index + 1)] ?? null
  const result = buildMonetVisibleLineEntries({
    lines,
    currentLineIndex: browseIndex.value === null ? props.index : -1,
    activeLine: browseIndex.value === null ? active : null,
    recentCompletedLine: active ? (lines[props.index - 1] ?? null) : current,
    upcomingLine:
      browseIndex.value === null ? next : (lines[browseIndex.value] ?? null),
    currentTime: props.positionMs / 1000,
    before: 2,
    after: 2,
  })
  return previous &&
    previous.length === result.length &&
    result.every(
      (entry, index) =>
        entry.line === previous[index]!.line &&
        entry.status === previous[index]!.status &&
        entry.offset === previous[index]!.offset
    )
    ? previous
    : result
})
const positioned = computed(() => {
  void fontEpoch.value
  const inputs = {
    fontPx: geometry.fontPx,
    translationFontPx: geometry.fontPx * 0.46,
    fontStack: geometry.fontStack,
    translationFontStack: geometry.fontStack,
    fontWeight: 600,
    translationFontWeight: 400,
    secondaryTranslationFontWeight: 400,
    maxWidthPx: Math.max(180, geometry.width - 24),
    subtitleContentMode: 'both' as const,
  }
  const rows = entries.value.map(entry => {
    const key = buildMonetLayoutCacheKey(entry, inputs)
    let layout = cache.get(key)
    if (!layout && geometry.ready) {
      layout = measureMonetLineLayout({
        line: entry.line,
        status: entry.status,
        ...inputs,
      })
      if (cache.size >= 240) cache.delete(cache.keys().next().value!)
      cache.set(key, layout)
    }
    const rawHeight =
      rowHeights.value[key] ?? layout?.visualHeightPx ?? geometry.fontPx * 1.8
    const scale = Math.min(
      1,
      (geometry.width - 24) /
        Math.max(1, rowWidths.value[key] ?? geometry.width - 24),
      entry.status === 'active'
        ? (geometry.height * 0.86) / Math.max(1, rawHeight)
        : 1
    )
    return {
      ...entry,
      line: props.lines[entry.index]!,
      key,
      height: rawHeight * scale,
      scale,
      y: 0,
    }
  })
  const anchor = Math.max(
    0,
    rows.findIndex(entry => entry.offset === 0)
  )
  if (!rows[anchor]) return rows
  rows[anchor]!.y = geometry.height / 2 - rows[anchor]!.height / 2
  const gap = geometry.fontPx * 0.55
  for (let index = anchor - 1; index >= 0; index--)
    rows[index]!.y = rows[index + 1]!.y - rows[index]!.height - gap
  for (let index = anchor + 1; index < rows.length; index++)
    rows[index]!.y = rows[index - 1]!.y + rows[index - 1]!.height + gap
  return rows
})
async function measure() {
  await nextTick()
  if (disposed || !root.value) return
  const style = getComputedStyle(root.value)
  geometry.width = root.value.clientWidth || 680
  geometry.height = root.value.clientHeight || 340
  geometry.fontPx = parseFloat(style.fontSize) || 36
  geometry.fontStack = style.fontFamily
  geometry.ready = true
  let next = rowHeights.value
  for (const row of root.value.querySelectorAll<HTMLElement>(
    '[data-row-key]'
  )) {
    const key = row.dataset.rowKey!
    if (next[key] === row.offsetHeight) continue
    if (next === rowHeights.value) next = { ...next }
    next[key] = row.offsetHeight
  }
  if (Object.keys(next).length > 240)
    next = Object.fromEntries(Object.entries(next).slice(-120))
  rowHeights.value = next
  let widths = rowWidths.value
  for (const row of root.value.querySelectorAll<HTMLElement>(
    '[data-row-key]'
  )) {
    const key = row.dataset.rowKey!
    if (widths[key] === row.scrollWidth) continue
    if (widths === rowWidths.value) widths = { ...widths }
    widths[key] = row.scrollWidth
  }
  if (Object.keys(widths).length > 240)
    widths = Object.fromEntries(Object.entries(widths).slice(-120))
  rowWidths.value = widths
  const nodes = Array.from(
    root.value.querySelectorAll<HTMLElement>('[data-row-key]')
  )
  if (
    nodes.length !== rowNodes.value.length ||
    nodes.some((node, index) => node !== rowNodes.value[index])
  )
    rowNodes.value = nodes
}
useResizeObserver(root, measure)
useResizeObserver(rowNodes, measure)
watch(entries, measure, { immediate: true, flush: 'post' })
watch(
  () => props.lines,
  () => {
    cache.clear()
    rowHeights.value = {}
    rowWidths.value = {}
    browseIndex.value = null
    clearTimeout(browseTimer)
  }
)
if (typeof document !== 'undefined') {
  useEventListener(document.fonts, 'loadingdone', () => {
    cache.clear()
    rowHeights.value = {}
    rowWidths.value = {}
    clearMonetMeasurementCaches()
    fontEpoch.value++
    void measure()
  })
}
onScopeDispose(() => {
  disposed = true
  cache.clear()
  clearTimeout(browseTimer)
})
</script>

<template>
  <div
    ref="root"
    class="lyric-rail relative h-full w-full overflow-hidden font-display"
    :class="{ 'reduced-motion': reducedMotion }"
    :style="{
      fontSize: showcase ? '26px' : 'clamp(25px,4vw,var(--lyric-size,42px))',
    }"
    aria-label="同步歌词"
    tabindex="0"
    @wheel.prevent="
      event => {
        if (event.deltaY) browse(Math.sign(event.deltaY))
      }
    "
    @keydown.up.prevent="browse(-1)"
    @keydown.down.prevent="browse(1)"
    @keydown.escape="browseIndex = null"
  >
    <div
      v-for="entry in positioned"
      :key="entry.line.id"
      class="rail-row absolute inset-x-3"
      :class="`is-${entry.status}`"
      :data-row-key="entry.key"
      :data-row-index="entry.index"
      :style="{
        transform: `translateY(${entry.y}px) scale(${entry.scale})`,
        opacity:
          entry.status === 'active'
            ? 1
            : Math.max(0.22, 0.6 - Math.abs(entry.offset) * 0.13),
      }"
      :aria-current="entry.status === 'active' ? 'true' : undefined"
    >
      <button
        type="button"
        class="block w-full cursor-pointer text-left leading-[1.4] font-semibold wrap-anywhere"
        :aria-label="`跳到歌词：${entry.line.text}`"
        @click="emit('seek', entry.line.startMs)"
      >
        <TimedLyricText
          :line="entry.line"
          :position-ms="positionMs"
          :end-ms="entry.line.endMs ?? durationMs ?? entry.line.startMs + 5000"
          :reduced-motion="reducedMotion"
          :active="entry.status === 'active'"
        />
      </button>
      <LyricAnnotations
        v-if="entry.status === 'active'"
        :line="entry.line"
        :position-ms="positionMs"
        :reduced-motion="reducedMotion"
        :agent-name="
          entry.line.agentId
            ? (agents?.[entry.line.agentId]?.name ?? entry.line.agentId)
            : undefined
        "
      />
    </div>
    <button
      v-if="browseIndex !== null"
      type="button"
      class="absolute right-3 bottom-4 z-10 rounded border border-stage-muted/30 bg-stage px-3 py-1 text-sm text-stage-muted"
      @click="browseIndex = null"
    >
      返回当前歌词
    </button>
  </div>
</template>

<style scoped>
.lyric-rail {
  mask-image: linear-gradient(
    to bottom,
    transparent,
    #000 8%,
    #000 92%,
    transparent
  );
}
.rail-row {
  transform-origin: top left;
  padding-block: 0.2em 0.34em;
  transition:
    transform 0.35s ease,
    opacity 0.22s ease;
}
.is-active {
  color: var(--color-ink);
}
.is-waiting,
.is-passed {
  color: var(--color-stage-muted);
}
.reduced-motion .rail-row {
  transition: none;
}
</style>
