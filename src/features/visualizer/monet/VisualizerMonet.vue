<script setup lang="ts">
import { computed } from 'vue'
import type { VisualizerSharedProps } from '../definition'
import { colorWithAlpha } from '../../theme/colorMath'
import { resolveMonetTuning } from './tuning'
import MonetLyricsRail from './MonetLyricsRail.vue'
import MonetPortrait from './MonetPortrait.vue'
import MonetAudio from './MonetAudio.vue'
const props = defineProps<VisualizerSharedProps>()
const tuning = computed(() => resolveMonetTuning(props.tunings?.monet))
</script>
<template>
  <div v-if="showText !== false" class="monet-poster" :style="{ color: theme.primaryColor }">
    <div class="monet-copy">
      <div class="monet-heading"><h2 class="font-display text-[clamp(1.45rem,3.3vw,2.8rem)] leading-tight">{{ songTitle || 'Monet' }}</h2><p class="mt-2 truncate text-caption" :style="{ color: theme.secondaryColor }">{{ songArtist }}<span v-if="songAlbum"> · {{ songAlbum }}</span></p></div>
      <MonetLyricsRail v-bind="props" :font-scale="tuning.fontScale" :keyword-coloring="tuning.keywordColoringEnabled" />
      <div v-if="tuning.showDescription" class="monet-capsule" :style="{ borderColor: colorWithAlpha(theme.primaryColor, 0.16), backgroundColor: colorWithAlpha(theme.backgroundColor, 0.18) }"><span class="size-2 rounded-full" :style="{ backgroundColor: theme.accentColor }" />{{ theme.description || theme.name }}</div>
    </div>
    <div class="monet-portrait-wrap" :style="{ transform: 'translateX(' + tuning.portraitOffsetX + 'px)' }">
      <div class="monet-portrait" :class="{ 'is-rectangular': tuning.portraitStyle === 'rectangular' }" :style="{ boxShadow: '0 36px 80px ' + colorWithAlpha(theme.backgroundColor, 0.45) + ', 0 20px 42px ' + colorWithAlpha(theme.accentColor, 0.22), backgroundColor: colorWithAlpha(theme.primaryColor, 0.08) }"><MonetPortrait :src="coverUrl" :reduced-motion="staticMode" /></div>
    </div>
    <MonetAudio v-if="tuning.showAudioVisualization" v-bind="props" :mode="tuning.audioStyle" class="monet-audio" />
  </div>
</template>
<style scoped>
.monet-poster { position: relative; display: flex; align-items: center; width: min(92%, 1520px); height: 90%; gap: clamp(16px, 3vw, 64px); }
.monet-copy { flex: 1 1 65%; min-width: 0; }
.monet-heading { padding-left: clamp(48px, 6vw, 86px); padding-top: 12px; }
.monet-capsule { display: inline-flex; align-items: center; gap: 10px; max-width: 90%; margin-left: clamp(48px, 6vw, 86px); padding: 8px 16px; border: 1px solid; border-radius: 24px; font-size: 11px; }
.monet-portrait-wrap { flex: 0 0 29%; max-width: 430px; }
.monet-portrait { position: relative; width: 100%; aspect-ratio: 1; overflow: hidden; border-radius: 2rem; }
.monet-portrait.is-rectangular { aspect-ratio: 0.74; border: 6px solid transparent; }
.monet-audio { position: absolute; left: 7%; right: 7%; bottom: 0; width: 86%; opacity: 0.6; }
@media (max-width: 760px) { .monet-portrait-wrap { display: none; } .monet-poster { width: 100%; height: 94%; } .monet-heading { padding-left: 10%; } .monet-capsule { margin-left: 10%; } }
@media (max-height: 580px) { .monet-heading { display: none; } .monet-capsule { display: none; } .monet-audio { height: 24px; } }
</style>
