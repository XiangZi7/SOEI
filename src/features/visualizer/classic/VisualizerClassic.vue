<script setup lang="ts">
// Adapted from Folia classic/Visualizer.tsx (AGPL-3.0); see third_party/Folia-NOTICE.md.
import { computed } from 'vue'
import { getLineRenderEndTime } from '../../lyrics/folia/renderHints'
import type { VisualizerSharedProps } from '../definition'
import { visualizerRuntime } from '../runtime'
import VisualizerSubtitleOverlay from '../VisualizerSubtitleOverlay.vue'
import { resolveClassicTuning } from './classicLayout'
import ClassicLine from './ClassicLine.vue'

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
const tuning = computed(() => resolveClassicTuning(props.tunings?.classic))
</script>

<template>
  <ClassicLine
    v-if="showText && runtime.activeLine"
    :key="runtime.activeLine.id ?? runtime.activeLine.startTime"
    :line="runtime.activeLine"
    :current-time="currentTime"
    :theme="theme"
    :tuning="tuning"
    :lyrics-font-scale="lyricsFontScale"
    :paused="paused"
    :static-mode="staticMode"
    :frame-rate="frameRate"
    :seed="seed"
  />
  <div
    v-else-if="showText"
    class="classic-waiting"
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
.classic-waiting {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: clamp(1.5rem, 3.5vw, 2.25rem);
  opacity: 0.5;
  pointer-events: none;
}
</style>
