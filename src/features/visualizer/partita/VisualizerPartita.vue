<script setup lang="ts">
// Adapted from Folia partita/VisualizerPartita.tsx (AGPL-3.0); see third_party/Folia-NOTICE.md.
import { computed } from 'vue'
import { getLineRenderEndTime } from '../../lyrics/folia/renderHints'
import type { VisualizerSharedProps } from '../definition'
import { visualizerRuntime } from '../runtime'
import VisualizerSubtitleOverlay from '../VisualizerSubtitleOverlay.vue'
import PartitaLine from './PartitaLine.vue'
import { resolvePartitaTuning } from './partitaLayout'

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
const tuning = computed(() => resolvePartitaTuning(props.tunings?.partita))

// partita 的呼吸幅度没有调参开关（与 classic 不同），直接按强度取值。
const BREATHING = {
  calm: { distancePx: 10, durationSec: 8.5, scaleAmount: 0.01 },
  normal: { distancePx: 14, durationSec: 7, scaleAmount: 0.01 },
  chaotic: { distancePx: 18, durationSec: 5.8, scaleAmount: 0.01 },
} as const
const breathing = computed(() => BREATHING[props.theme.animationIntensity])
</script>

<template>
  <PartitaLine
    v-if="showText && runtime.activeLine"
    :key="runtime.activeLine.id ?? runtime.activeLine.startTime"
    :line="runtime.activeLine"
    :current-time="currentTime"
    :theme="theme"
    :tuning="tuning"
    :lyrics-font-scale="lyricsFontScale"
    :breathing="breathing"
    :paused="paused"
    :static-mode="staticMode"
    :frame-rate="frameRate"
  />
  <div
    v-else-if="showText"
    class="partita-waiting"
    :style="{ color: theme.secondaryColor }"
  >
    {{ lines.length ? '等待下一句' : '等待歌词' }}
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
.partita-waiting {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: clamp(1.2rem, 2.8vw, 1.9rem);
  opacity: 0.5;
  pointer-events: none;
}
</style>
