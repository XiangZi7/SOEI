<script setup lang="ts">
import { computed, useTemplateRef, watch } from 'vue'
import type { PositionedMonetLineEntry } from './monetRailLayout'
import type { Theme } from '../../theme/model'
import type { ReadableValue } from '../timeSource'
import {
  buildMonetDisplayTokens,
  measureMonetGraphemeOffsets,
} from '../../lyrics/folia/monetLyricsModel'
import {
  prepareWordColorMatchers,
  buildWordColorRangesFromMatchers,
  resolveTokenColorMap,
} from '../../lyrics/folia/wordColoring'
import { getLineRenderEndTime } from '../../lyrics/folia/renderHints'
import { colorWithAlpha } from '../../theme/colorMath'
import { hasMeasuredMonetTiming, monetSweepFrame } from './monetFrame'
const props = defineProps<{
  entry: PositionedMonetLineEntry
  theme: Theme
  fontPx: number
  fontStack: string
  fontWeight: number
  keywordColoring: boolean
  reducedMotion?: boolean
  fontsEpoch: number
  canSeek?: boolean
  currentTime: ReadableValue<number>
}>()
const emit = defineEmits<{ seek: [time: number] }>()
const host = useTemplateRef<HTMLElement>('host')
const tokens = computed(() => {
  void props.fontsEpoch
  const display = buildMonetDisplayTokens(props.entry.line)
  const colors = resolveTokenColorMap(
    display,
    buildWordColorRangesFromMatchers(
      props.entry.line.fullText,
      prepareWordColorMatchers(props.theme.wordColors, props.keywordColoring)
    )
  )
  return display.map(token => ({
    ...token,
    measured: hasMeasuredMonetTiming(props.entry.line, token),
    color: colors.get(token.key) ?? props.theme.primaryColor,
    offsets: measureMonetGraphemeOffsets(
      token.text,
      props.fontPx,
      props.fontWeight + ' ' + props.fontPx + 'px ' + props.fontStack
    ),
  }))
})
let nodes: {
  wrapper: HTMLElement
  base: HTMLElement
  fill: HTMLElement | null
}[] = []
watch(
  [host, tokens],
  () => {
    nodes = Array.from(
      host.value?.querySelectorAll<HTMLElement>('[data-monet-token]') ?? []
    ).map(wrapper => ({
      wrapper,
      base: wrapper.querySelector<HTMLElement>('[data-base]')!,
      fill: wrapper.querySelector<HTMLElement>('[data-fill]'),
    }))
    paint(props.currentTime.get())
  },
  { flush: 'post' }
)
function paint(time: number) {
  tokens.value.forEach((token, index) => {
    const node = nodes[index]
    if (!node) return
    if (!token.measured) {
      node.base.style.color = props.theme.primaryColor
      node.wrapper.style.filter = 'none'
      return
    }
    const frame = monetSweepFrame(
      time,
      token,
      token.offsets,
      props.fontPx,
      getLineRenderEndTime(props.entry.line),
      token.color,
      props.entry.line.isChorus,
      props.reducedMotion
    )
    node.base.style.color =
      frame.passed || props.entry.status === 'passed'
        ? token.color
        : props.entry.tone.baseColor
    if (node.fill) {
      node.fill.style.maskImage = frame.mask
      node.fill.style.webkitMaskImage = frame.mask
    }
    node.wrapper.style.filter =
      props.entry.status === 'waiting' ? 'none' : frame.glow
  })
}
function position(y: number, scale: number, opacity: number, blur: number) {
  if (!host.value) return
  host.value.style.transform =
    'translate3d(0,' + y.toFixed(3) + 'px,0) scale(' + scale.toFixed(4) + ')'
  host.value.style.opacity = String(opacity)
  host.value.style.filter =
    props.reducedMotion || blur < 0.05
      ? 'none'
      : 'blur(' + blur.toFixed(2) + 'px)'
}
defineExpose({ paint, position })
</script>
<template>
  <div
    ref="host"
    class="monet-line"
    :style="{
      height: entry.layout.visualHeightPx + 'px',
      zIndex: Math.max(0, entry.tone.zIndex),
      transform:
        'translateY(' + entry.y + 'px) scale(' + entry.tone.scale + ')',
      opacity: entry.tone.opacity,
    }"
  >
    <button
      type="button"
      class="monet-line-button"
      :disabled="!canSeek"
      :aria-label="'定位歌词：' + entry.line.fullText"
      :aria-current="entry.status === 'active' ? 'true' : undefined"
      @click="emit('seek', entry.line.startTime)"
    >
      <span
        class="monet-line-text"
        :style="{
          height: entry.layout.textHeightPx + fontPx * 2.4 + 'px',
          marginBlock: -fontPx * 1.2 + 'px',
          paddingTop: entry.layout.textPaddingTopPx + fontPx * 1.2 + 'px',
          paddingBottom: entry.layout.textPaddingBottomPx + fontPx * 1.2 + 'px',
          lineHeight: entry.layout.lineHeightPx + 'px',
          fontSize: fontPx + 'px',
          fontFamily: fontStack,
          fontWeight,
          maskImage: entry.layout.isTextClipped
            ? 'linear-gradient(#000 80%,transparent)'
            : undefined,
        }"
      >
        <span
          v-for="token in tokens"
          :key="token.key"
          data-monet-token
          class="monet-token"
        >
          <span
            data-base
            :style="{
              color: token.measured ? entry.tone.baseColor : theme.primaryColor,
            }"
            >{{ token.text }}</span
          >
          <span
            v-if="token.measured && entry.status === 'active'"
            data-fill
            aria-hidden="true"
            class="monet-token-fill"
            :style="{
              color: token.color,
              top: -fontPx * 0.5 + 'px',
              bottom: -fontPx * 0.5 + 'px',
              paddingBlock: fontPx * 0.5 + 'px',
            }"
            >{{ token.text }}</span
          >
        </span>
      </span>
      <span
        v-for="track in entry.layout.subtitleTracks"
        :key="track.role"
        class="monet-subtitle"
        :style="{
          fontSize: track.fontPx + 'px',
          height: track.heightPx + 'px',
          lineHeight: track.lineHeightPx + 'px',
          paddingTop: track.paddingTopPx + 'px',
          paddingBottom: track.paddingBottomPx + 'px',
          color: colorWithAlpha(theme.secondaryColor, 0.85),
          fontWeight: track.fontWeight,
        }"
        >{{ track.text }}</span
      >
    </button>
  </div>
</template>
<style scoped>
.monet-line {
  position: absolute;
  left: 0;
  right: 0;
  transform-origin: left top;
  will-change: transform;
}
.monet-line-button {
  display: block;
  width: 100%;
  text-align: left;
  cursor: pointer;
  border-radius: 8px;
}
.monet-line-button:disabled {
  cursor: default;
}
.monet-line-button:focus-visible {
  outline: 1px solid var(--color-focus);
  outline-offset: 6px;
}
.monet-line-text {
  pointer-events: none;
  display: block;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  overflow: hidden;
  margin-inline: -1.2em;
  padding-inline: 1.2em;
  box-sizing: border-box;
}
.monet-token {
  position: relative;
  display: inline-block;
  white-space: pre-wrap;
}
.monet-token-fill {
  position: absolute;
  left: 0;
  right: 0;
  pointer-events: none;
  mask-repeat: no-repeat;
}
.monet-subtitle {
  pointer-events: none;
  display: block;
  white-space: pre-wrap;
  overflow: hidden;
  box-sizing: border-box;
}
</style>
