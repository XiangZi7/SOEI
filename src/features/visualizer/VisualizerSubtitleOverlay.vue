<script setup lang="ts">
import { computed } from 'vue'
import type { Line, SubtitleContentMode } from '../lyrics/folia/model'
import type { Theme } from '../theme/model'
import {
  resolveThemeFontWeight,
  resolveThemeTranslationFontStack,
} from '../theme/fontStacks'
import { colorWithAlpha } from '../theme/colorMath'
import {
  SECONDARY_TRACK_SIZE_FACTOR,
  SECONDARY_TRACK_OPACITY,
  SECONDARY_TRACK_FONT_WEIGHT_FALLBACK,
  SECONDARY_TRACK_GAP_EM,
} from '../lyrics/folia/subtitleTrackStyle'
import { resolveSubtitleFontSizes } from './subtitleFontSizes'
import { resolveVisualizerSubtitleOverlayContent } from './subtitleOverlay'

const props = withDefaults(
  defineProps<{
    showText: boolean
    activeLine: Line | null
    recentCompletedLine: Line | null
    nextLines: Line[]
    theme: Theme
    subtitleTheme?: Theme
    lyricsFontScale?: number
    subtitleFontScale?: number
    subtitleOverlayOpacity?: number
    subtitleOverlayBackground?: boolean
    subtitleUpcomingLyricsBlur?: boolean
    hideTranslationSubtitle?: boolean
    showSubtitleTranslation?: boolean
    subtitleContentMode?: SubtitleContentMode
  }>(),
  {
    lyricsFontScale: 1,
    subtitleFontScale: 1,
    subtitleOverlayOpacity: 0.6,
    subtitleOverlayBackground: true,
    subtitleUpcomingLyricsBlur: true,
  }
)
const content = computed(() => resolveVisualizerSubtitleOverlayContent(props))
const subtitleTheme = computed(() => props.subtitleTheme ?? props.theme)
const fontSizes = computed(() =>
  resolveSubtitleFontSizes(props.lyricsFontScale * props.subtitleFontScale)
)
const overlayStyle = computed(() => ({
  color: subtitleTheme.value.secondaryColor,
  fontFamily: resolveThemeTranslationFontStack(subtitleTheme.value),
  opacity: props.subtitleOverlayOpacity,
  '--subtitle-backdrop': colorWithAlpha(props.theme.backgroundColor, 0.8),
}))
function trackStyle(index: number) {
  return {
    fontSize:
      index === 0
        ? fontSizes.value.translationFontSize
        : 'calc(' +
          fontSizes.value.translationFontSize +
          ' * ' +
          SECONDARY_TRACK_SIZE_FACTOR +
          ')',
    opacity: index === 0 ? 1 : SECONDARY_TRACK_OPACITY,
    marginTop: index === 0 ? '0' : SECONDARY_TRACK_GAP_EM + 'em',
    fontWeight: resolveThemeFontWeight(
      subtitleTheme.value,
      index === 0 ? 500 : SECONDARY_TRACK_FONT_WEIGHT_FALLBACK
    ),
  }
}
</script>

<template>
  <div
    v-if="content.shouldRenderOverlay"
    class="subtitle-overlay"
    :style="overlayStyle"
  >
    <div
      :class="{ 'with-background': subtitleOverlayBackground }"
      class="subtitle-content"
    >
      <div
        v-for="(track, index) in content.subtitleTracks"
        :key="track.role"
        class="subtitle-track"
        :style="trackStyle(index)"
      >
        {{ track.text }}
      </div>
      <div
        v-for="line in content.upcomingLines"
        :key="line.id ?? line.startTime"
        class="subtitle-upcoming"
        :class="{ 'is-blurred': subtitleUpcomingLyricsBlur }"
        :style="{ fontSize: fontSizes.upcomingFontSize }"
      >
        {{ line.fullText }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.subtitle-overlay {
  position: absolute;
  right: 8%;
  bottom: 7%;
  left: 8%;
  z-index: 10;
  text-align: center;
  pointer-events: none;
}
.subtitle-content {
  position: relative;
  display: inline-block;
  max-width: 100%;
}
.subtitle-content.with-background::before {
  position: absolute;
  z-index: -1;
  inset: -1rem -2rem;
  content: '';
  background: radial-gradient(
    ellipse at center,
    var(--subtitle-backdrop),
    transparent 75%
  );
  filter: blur(16px);
}
.subtitle-track {
  line-height: 1.45;
  overflow-wrap: anywhere;
}
.subtitle-upcoming {
  max-width: 42rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.7;
}
.subtitle-upcoming.is-blurred {
  filter: blur(1px);
}
</style>
