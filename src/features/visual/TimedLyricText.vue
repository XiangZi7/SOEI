<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import type { LyricLine } from '../../types/music'
import { buildLyricDisplayTokens } from '../lyrics/renderModel'
import { useLyricSweep } from './useLyricSweep'

// A single rich lyric row; timing is painted directly from the shared media clock.
const props = withDefaults(defineProps<{
  line: LyricLine
  endMs: number
  positionMs: number
  reducedMotion?: boolean
  active?: boolean
}>(), { reducedMotion: false, active: true })
const root = useTemplateRef<HTMLElement>('root')
const tokens = computed(() => buildLyricDisplayTokens(props.line, props.endMs))
useLyricSweep(root, () => tokens.value, () => props)
</script>

<template>
  <span ref="root" class="timed-lyric-text whitespace-pre-wrap" :aria-label="line.text">
    <span v-for="(token, index) in tokens" :key="token.key" :data-sweep-token="index"
      :class="{ 'sweep-token': token.timed, 'is-active': active }" aria-hidden="true">
      <span :class="{ 'sweep-base': token.timed }"><template v-for="(part, partIndex) in token.parts" :key="partIndex"><ruby v-if="part.ruby">{{ part.text }}<rt>{{ part.ruby }}</rt></ruby><template v-else>{{ part.text }}</template></template></span>
      <span v-if="token.timed" class="sweep-fill"><template v-for="(part, partIndex) in token.parts" :key="partIndex"><ruby v-if="part.ruby">{{ part.text }}<rt>{{ part.ruby }}</rt></ruby><template v-else>{{ part.text }}</template></template></span>
    </span>
  </span>
</template>

<style scoped>
.sweep-token { position: relative; display: inline-block; --sweep: 0px; --sweep-edge: 10px; --glow: 0; }
.sweep-base { opacity: .42; }
.sweep-fill { position: absolute; inset: 0; color: var(--color-stage-gold); pointer-events: none; mask-image: linear-gradient(to right, #000 calc(var(--sweep) - var(--sweep-edge)), transparent var(--sweep)); }
.is-active .sweep-fill { text-shadow: 0 0 calc(var(--glow) * 1px) color-mix(in srgb, var(--color-stage-gold) 65%, transparent); }
rt { font-size: .42em; font-weight: 400; line-height: 1.2; }
</style>
