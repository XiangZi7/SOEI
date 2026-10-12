<script setup lang="ts">
import { computed } from 'vue'
import type { LyricLine, SubtitleContentMode } from '../../types/music'
import { resolveSubtitleTracks } from '../lyrics/renderModel'
import TimedLyricText from './TimedLyricText.vue'

// Alternate text and harmony keep independent timing and never replace the main words.
const props = withDefaults(defineProps<{
  line: LyricLine
  positionMs: number
  reducedMotion?: boolean
  mode?: SubtitleContentMode
  agentName?: string
}>(), { mode: 'both', reducedMotion: false })
const tracks = computed(() => resolveSubtitleTracks(props.line, props.mode))
const vocals = computed(() => (props.line.backgroundVocals ?? []).map((vocal, index) => ({
  ...vocal, id: `${props.line.id}-vocal-${index}`,
})))
</script>

<template>
  <div v-if="tracks.length || vocals.length || agentName || line.isChorus" class="lyric-annotations mt-3 space-y-2 leading-relaxed">
    <p v-if="agentName || line.isChorus" class="text-[.35em] tracking-widest text-stage-muted"><span v-if="agentName">{{ agentName }}</span><span v-if="line.isChorus" class="ml-2">副歌</span></p>
    <p v-for="track in tracks" :key="track.role" class="text-[.46em] text-stage-muted" :lang="track.language" :data-subtitle-role="track.role">{{ track.text }}</p>
    <p v-for="vocal in vocals" :key="vocal.id" class="text-[.5em] text-stage-gold/80" :data-vocal-state="positionMs < vocal.startMs ? 'waiting' : positionMs < vocal.endMs ? 'active' : 'passed'">
      <span class="mr-2 text-[.7em] text-stage-muted">和声</span><TimedLyricText :line="vocal" :end-ms="vocal.endMs" :position-ms="positionMs" :reduced-motion="reducedMotion" :active="positionMs >= vocal.startMs && positionMs < vocal.endMs" />
      <span v-if="vocal.translation" class="ml-2 text-[.8em] text-stage-muted">{{ vocal.translation }}</span>
    </p>
  </div>
</template>
