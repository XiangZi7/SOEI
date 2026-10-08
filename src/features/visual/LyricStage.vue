<script setup lang="ts">
import { computed } from 'vue'
import KineticLyrics from './KineticLyrics.vue'
import type { LyricLine, SceneLayout, Track } from '../../types/music'
import Artwork from '../../components/ui/Artwork.vue'
import { isKineticLayout } from './lyricStoryboard'
import { useLyricTransitions } from './useLyricTransitions'

const props = defineProps<{
  track: Track | null
  lines: LyricLine[]
  index: number
  layout: SceneLayout
  seed: number
  animated: boolean
  reducedMotion: boolean
  showcase?: boolean
}>()
const current = computed(() => props.lines[props.index]?.text ?? '')
const previous = computed(() => props.lines[props.index - 1]?.text ?? '')
const next = computed(() => props.lines[props.index + 1]?.text ?? '')
const kinetic = computed(() => isKineticLayout(props.layout))
const readingLines = computed(() =>
  props.lines.slice(
    Math.max(0, props.index - 1),
    Math.max(0, props.index - 1) + 4
  )
)
const transitionKey = computed(
  () =>
    `${props.track?.id}-${props.layout}-${props.seed}-${props.layout === 'title' ? '' : props.index}`
)
const { enter, leave, cancel } = useLyricTransitions(() => ({
  animated: props.animated,
  reducedMotion: props.reducedMotion,
  durationMs: props.lines[props.index + 1]
    ? Math.max(
        250,
        props.lines[props.index + 1]!.startMs -
          (props.lines[props.index]?.startMs ?? 0)
      )
    : 4000,
}))
</script>

<template>
  <div
    class="lyric-stage absolute grid items-center"
    :class="
      showcase
        ? 'inset-x-[13%] top-[23%] bottom-[26%] max-sm:inset-x-[7%]'
        : 'inset-x-[10%] top-[23%] bottom-[26%] max-sm:inset-x-[7%] max-sm:top-[24%] max-sm:bottom-[30%]'
    "
  >
    <template v-if="lines.length && (current || layout === 'readable')">
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
                此刻正在听
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
                class="font-display leading-relaxed wrap-anywhere text-stage-gold"
                :class="
                  showcase
                    ? 'mt-5 text-lg max-sm:mt-2 max-sm:text-sm'
                    : 'mt-9 text-xl max-sm:mt-4 max-sm:text-base'
                "
              >
                {{ current }}
              </p>
              <p
                v-if="!showcase"
                class="mt-2.5 text-label text-stage-muted max-sm:hidden"
              >
                {{ next }}
              </p>
            </div>
          </div>
          <div
            v-else-if="layout === 'readable'"
            class="mx-auto w-full max-w-240"
          >
            <p
              v-for="line in readingLines"
              :key="line.id"
              class="reading-line leading-normal font-semibold wrap-anywhere"
              :class="[
                showcase ? 'my-3' : 'my-4.5 max-sm:my-4',
                line.id === lines[index]?.id
                  ? showcase
                    ? 'text-[28px] text-ink max-sm:text-xl'
                    : 'text-[clamp(25px,4vw,calc(var(--lyric-size)*1.15))] text-ink max-sm:text-2xl'
                  : showcase
                    ? 'text-xl text-stage-muted/55 max-sm:text-base'
                    : 'text-[clamp(20px,3.2vw,calc(var(--lyric-size)*.85))] text-stage-muted/55 max-sm:text-lg',
              ]"
            >
              {{ line.text }}
            </p>
          </div>
          <KineticLyrics
            v-else-if="isKineticLayout(layout)"
            :text="current"
            :track-id="track?.id ?? 'empty'"
            :index="index"
            :layout="layout"
            :seed="seed"
            :showcase="showcase"
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
        class="aspect-square w-[min(30vw,330px)] shrink-0 overflow-hidden rounded-lg shadow-panel max-sm:w-[min(38vw,170px)]"
      >
        <Artwork
          :artwork="track.artwork"
          :src="track.coverRef"
          :title="track.title"
        />
      </div>
      <div class="max-w-140 min-w-0">
        <p class="mb-4.5 text-caption tracking-[.24em] text-stage-muted">
          {{ lines.length ? '前奏 · 故事即将开始' : '让音乐慢慢发生' }}
        </p>
        <h1
          class="font-display text-[clamp(28px,4vw,62px)] leading-tight font-normal wrap-anywhere max-sm:text-[26px]"
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
