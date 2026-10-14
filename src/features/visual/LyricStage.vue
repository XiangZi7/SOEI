<script setup lang="ts">
import { computed } from 'vue'
import KineticLyrics from './KineticLyrics.vue'
import CoverComposition from './CoverComposition.vue'
import type { LyricLine, LegacySceneLayout, Track } from '../../types/music'
import Artwork from '../../components/ui/Artwork.vue'
import { isKineticLayout, shotVariant } from './lyricStoryboard'
import { useLyricTransitions } from './useLyricTransitions'
import LyricRail from './LyricRail.vue'
import LyricAnnotations from './LyricAnnotations.vue'
import TimedLyricText from './TimedLyricText.vue'

const props = defineProps<{
  track: Track | null
  lines: LyricLine[]
  index: number
  positionMs?: number
  durationMs?: number
  layout: LegacySceneLayout
  seed: number
  animated: boolean
  reducedMotion: boolean
  wallpaperCover?: boolean
  energy?: number[]
  showcase?: boolean
  agents?: Record<string, { name?: string }>
}>()
const emit = defineEmits<{ seek: [positionMs: number] }>()
const currentLine = computed(
  () => props.lines[props.index] ?? { id: 'empty', startMs: 0, text: '' }
)
const current = computed(() => currentLine.value.text)
const previous = computed(() => props.lines[props.index - 1]?.text ?? '')
const next = computed(() => props.lines[props.index + 1]?.text ?? '')
const kinetic = computed(() => isKineticLayout(props.layout))
const lineEndMs = computed(() =>
  Math.max(
    currentLine.value.startMs + 1,
    currentLine.value.endMs ??
      props.lines[props.index + 1]?.startMs ??
      (props.durationMs && props.durationMs > currentLine.value.startMs
        ? props.durationMs
        : currentLine.value.startMs + 4000)
  )
)
const transitionKey = computed(() =>
  JSON.stringify([
    props.track?.id,
    props.layout,
    props.seed,
    props.layout === 'title' ? 'cover' : [currentLine.value, lineEndMs.value],
  ])
)
const motionVariant = computed(() =>
  shotVariant(props.track?.id ?? 'empty', props.index, props.seed)
)
const { enter, leave, cancel } = useLyricTransitions(() => ({
  animated: props.animated,
  reducedMotion: props.reducedMotion,
  positionMs: props.positionMs ?? currentLine.value.startMs,
  endMs: lineEndMs.value,
  line: currentLine.value,
  layout: props.layout,
  variant: motionVariant.value,
  trackId: props.track?.id ?? 'empty',
}))
</script>

<template>
  <div
    class="lyric-stage absolute grid items-center"
    :class="
      wallpaperCover && layout === 'title'
        ? 'cover-stage inset-x-[10%] top-[20%] bottom-[22%] max-sm:inset-x-[4%] max-sm:top-[24%] max-sm:bottom-[26%]'
        : showcase
          ? 'inset-x-[13%] top-[23%] bottom-[26%] max-sm:inset-x-[7%]'
          : 'inset-x-[10%] top-[23%] bottom-[26%] max-sm:inset-x-[7%] max-sm:top-[24%] max-sm:bottom-[30%]'
    "
  >
    <Transition
      v-if="wallpaperCover && layout === 'title'"
      name="song-change"
      mode="out-in"
      ><CoverComposition
        :key="track?.id ?? 'empty'"
        :track="track"
        :lines="lines"
        :index="index"
        :energy="energy"
      >
        <template
          v-if="$slots['cover-progress']"
          #progress
          ><slot name="cover-progress"
        /></template>
        <template
          v-if="$slots['cover-controls']"
          #controls
          ><slot name="cover-controls"
        /></template>
        <template
          v-if="$slots['cover-window']"
          #window
          ><slot name="cover-window"
        /></template> </CoverComposition
    ></Transition>
    <LyricRail
      v-else-if="layout === 'readable' && lines.length"
      :lines="lines"
      :index="index"
      :position-ms="positionMs ?? currentLine.startMs"
      :duration-ms="durationMs"
      :reduced-motion="reducedMotion || !animated"
      :showcase="showcase"
      :agents="agents"
      @seek="emit('seek', $event)"
    />
    <template
      v-else-if="
        layout === 'title' ||
        (lines.length && (current || layout === 'readable'))
      "
    >
      <p
        v-if="kinetic"
        class="absolute left-[3%] max-w-[88%] -rotate-3 font-display tracking-wider wrap-anywhere text-stage-muted/25"
        :class="
          showcase
            ? '-top-[13%] text-xl max-sm:text-sm'
            : '-top-[2%] text-[clamp(16px,2.4vw,35px)] max-sm:text-base'
        "
        aria-hidden="true"
      >
        {{ previous }}
      </p>
      <Transition
        :css="false"
        appear
        @enter="enter"
        @leave="leave"
        @enter-cancelled="cancel"
        @leave-cancelled="cancel"
      >
        <div
          :key="transitionKey"
          class="col-start-1 row-start-1 min-w-0"
          :class="{ 'h-full': kinetic }"
        >
          <div
            v-if="layout === 'title'"
            class="cover-composition flex min-w-0 items-center justify-center gap-[clamp(25px,6vw,90px)] max-sm:flex-col max-sm:gap-4 max-sm:text-center"
          >
            <div
              class="aspect-square shrink-0 overflow-hidden rounded-lg shadow-[0_22px_75px_#00000066]"
              :class="
                showcase
                  ? 'w-40 max-sm:w-24'
                  : 'w-[min(30vw,330px)] max-sm:w-[min(38vw,170px)]'
              "
            >
              <Artwork
                :artwork="track?.artwork"
                :src="track?.coverRef"
                :title="track?.title"
              />
            </div>
            <div class="max-w-140 min-w-0">
              <p
                class="mb-4.5 text-caption tracking-[.24em] text-stage-muted max-sm:hidden"
              >
                {{ track?.demo ? '视觉预览' : '此刻正在听' }}
              </p>
              <h1
                class="font-display leading-tight font-normal wrap-anywhere"
                :class="
                  showcase
                    ? 'text-4xl max-sm:text-2xl'
                    : 'text-[clamp(28px,4vw,62px)] max-sm:text-[26px]'
                "
              >
                {{ track?.title }}
              </h1>
              <p class="mt-4 text-sm text-stage-muted max-sm:mt-2">
                {{ track?.artist }}
              </p>
              <p
                v-if="current"
                class="font-display leading-relaxed wrap-anywhere text-stage-gold"
                :class="
                  showcase
                    ? 'mt-5 text-lg max-sm:mt-2 max-sm:text-sm'
                    : 'mt-9 text-xl max-sm:mt-4 max-sm:text-base'
                "
              >
                <TimedLyricText
                  :line="currentLine"
                  :end-ms="lineEndMs"
                  :position-ms="positionMs ?? currentLine.startMs"
                  :reduced-motion="reducedMotion"
                />
              </p>
              <LyricAnnotations
                v-if="current"
                :line="currentLine"
                :position-ms="positionMs ?? currentLine.startMs"
                :reduced-motion="reducedMotion"
                class="text-[clamp(24px,4vw,42px)]"
                :agent-name="
                  currentLine.agentId
                    ? (agents?.[currentLine.agentId]?.name ??
                      currentLine.agentId)
                    : undefined
                "
              />
              <p
                v-if="!showcase"
                class="mt-2.5 text-label text-stage-muted max-sm:hidden"
              >
                {{ next }}
              </p>
            </div>
          </div>
          <KineticLyrics
            v-else-if="isKineticLayout(layout)"
            :text="current"
            :track-id="track?.id ?? 'empty'"
            :index="index"
            :layout="layout"
            :seed="seed"
            :showcase="showcase"
            :line="currentLine"
            :position-ms="positionMs ?? currentLine.startMs"
            :reduced-motion="reducedMotion"
            :agent-name="
              currentLine.agentId
                ? (agents?.[currentLine.agentId]?.name ?? currentLine.agentId)
                : undefined
            "
          />
        </div>
      </Transition>
      <p
        v-if="kinetic"
        class="absolute right-[2%] max-w-[88%] rotate-2 text-right font-display tracking-wider wrap-anywhere text-stage-muted/25"
        :class="
          showcase
            ? '-bottom-[17%] text-xl max-sm:text-sm'
            : 'bottom-0 text-[clamp(16px,2.4vw,35px)] max-sm:text-base'
        "
        aria-hidden="true"
      >
        {{ next }}
      </p>
    </template>
    <div
      v-else
      class="flex min-w-0 items-center justify-center gap-[clamp(25px,6vw,90px)] max-sm:flex-col max-sm:gap-5 max-sm:text-center"
    >
      <div
        v-if="track"
        class="aspect-square shrink-0 overflow-hidden rounded-lg shadow-panel"
        :class="
          showcase
            ? 'w-40 max-sm:w-24'
            : 'w-[min(30vw,330px)] max-sm:w-[min(38vw,170px)]'
        "
      >
        <Artwork
          :artwork="track.artwork"
          :src="track.coverRef"
          :title="track.title"
        />
      </div>
      <div class="max-w-140 min-w-0">
        <p class="mb-4.5 text-caption tracking-[.24em] text-stage-muted">
          {{
            track?.demo
              ? '视觉预览'
              : lines.length
                ? '前奏 · 故事即将开始'
                : '此刻正在听'
          }}
        </p>
        <h1
          class="font-display leading-tight font-normal wrap-anywhere"
          :class="
            showcase
              ? 'text-4xl max-sm:text-2xl'
              : 'text-[clamp(28px,4vw,62px)] max-sm:text-[26px]'
          "
        >
          {{ track?.title ?? '你的音乐，另一片风景' }}
        </h1>
        <p class="mt-4 text-sm text-stage-muted">
          {{ track?.artist ?? '选择一首音乐，进入歌词舞台' }}
        </p>
      </div>
    </div>
  </div>
</template>
