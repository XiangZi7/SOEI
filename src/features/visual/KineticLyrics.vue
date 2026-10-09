<script setup lang="ts">
import { computed, nextTick, reactive, useTemplateRef, watch } from 'vue'
import { useEventListener, useResizeObserver } from '@vueuse/core'
import { buildLyricShot, type KineticLayout } from './lyricStoryboard'

const props = defineProps<{
  text: string
  trackId: string
  index: number
  layout: KineticLayout
  seed: number
  showcase?: boolean
}>()
const shot = computed(() =>
  buildLyricShot(
    props.layout,
    props.text,
    props.trackId,
    props.index,
    props.seed
  )
)
const container = useTemplateRef<HTMLElement>('container')
const composition = useTemplateRef<HTMLElement>('composition')
const state = reactive({
  // 容器和实际文字尺寸决定缩放，避免长句或小屏遮住控制层。
  fit: 1,
})
function fit() {
  if (!container.value || !composition.value) return
  const width = container.value.clientWidth
  const height = container.value.clientHeight
  if (!width || !height) return
  state.fit = Math.min(
    1,
    (width * 0.92) / Math.max(1, composition.value.scrollWidth),
    (height * 0.9) / Math.max(1, composition.value.scrollHeight)
  )
}
useResizeObserver([container, composition], fit)
useEventListener(document.fonts, 'loadingdone', fit)
watch(
  shot,
  async () => {
    await nextTick()
    fit()
  },
  { immediate: true }
)
</script>

<template>
  <div
    ref="container"
    class="kinetic-lyrics relative flex h-full w-full items-center justify-center"
    :data-variant="shot.variant"
    :data-mode="layout"
    :aria-label="text"
  >
    <div class="shot-camera relative w-full">
      <template v-if="layout === 'echo'">
        <p
          class="pointer-events-none absolute -top-[1.05em] -left-[6%] m-0 w-[112%] truncate font-display text-[clamp(55px,9vw,140px)] tracking-widest text-stage-muted/7"
          aria-hidden="true"
        >
          {{ text }}
        </p>
        <p
          class="pointer-events-none absolute -right-[6%] -bottom-[1.05em] m-0 w-[112%] truncate text-right font-display text-[clamp(55px,9vw,140px)] tracking-widest text-stage-muted/7"
          aria-hidden="true"
        >
          {{ text }}
        </p>
      </template>
      <div
        ref="composition"
        class="relative mx-auto flex w-full max-w-250 origin-center scale-(--shot-fit) flex-col"
        :class="[
          layout === 'manuscript' ? 'font-hand' : 'font-display',
          layout === 'collage' ? 'gap-3 max-sm:gap-2' : 'gap-1.5',
          showcase
            ? 'text-[clamp(28px,4vw,54px)]'
            : 'text-[clamp(28px,5.2vw,calc(var(--lyric-size)*1.6))] max-sm:text-[clamp(26px,7vw,calc(var(--lyric-size)*1.05))]',
          { 'text-[clamp(22px,3.2vw,38px)]!': shot.compact },
          shot.vertical
            ? 'flex-row! items-center justify-center gap-[.7em]!'
            : '',
          shot.frame ? 'border-y border-stage-gold/45 py-[.4em]' : '',
        ]"
        :style="{ '--shot-fit': state.fit }"
        aria-hidden="true"
      >
        <p
          v-for="(fragment, fragmentIndex) in shot.fragments"
          :key="fragmentIndex"
          class="lyric-fragment relative m-0 w-fit max-w-full leading-[1.35] font-normal tracking-[.04em] wrap-anywhere"
          :class="[
            fragment.placement,
            fragment.emphasis ? 'text-stage-gold' : 'text-ink',
            !shot.compact && !fragment.emphasis ? 'text-[.74em]' : '',
            fragment.card
              ? fragment.emphasis
                ? 'bg-stage-gold px-[.3em] py-[.07em] text-stage!'
                : 'border border-stage-muted/35 bg-stage/70 px-[.3em] py-[.07em]'
              : '',
            { 'text-[1.15em]': layout === 'echo' && fragment.emphasis },
            shot.vertical
              ? 'rotate-0! self-center! [text-orientation:upright] [writing-mode:vertical-rl]'
              : '',
            {
              'text-transparent! [-webkit-text-stroke:1px_var(--color-stage-gold)]':
                shot.outline && !fragment.emphasis,
            },
          ]"
          :data-enter-x="fragment.direction.x"
          :data-enter-y="fragment.direction.y"
          :style="
            fragment.card && fragment.emphasis
              ? {
                  '--lyric-fill-color': 'var(--color-stage)',
                  '--lyric-rest-color':
                    'color-mix(in srgb, var(--color-stage) 50%, transparent)',
                }
              : undefined
          "
        >
          <span
            v-for="(glyph, glyphIndex) in fragment.glyphs"
            :key="glyphIndex"
            class="relative inline-block"
            :class="
              layout === 'montage' && shot.variant === 0
                ? /[，。、!?！？]/u.test(glyph)
                  ? 'text-[.55em]'
                  : glyphIndex % 3 === 1
                    ? 'text-[.8em]'
                    : 'text-[1.1em]'
                : ''
            "
            ><span class="lyric-glyph inline-block whitespace-pre-wrap">{{
              glyph
            }}</span></span
          >
          <svg
            v-if="fragment.emphasis && layout === 'manuscript'"
            class="pointer-events-none absolute -bottom-[.18em] left-0 h-[.24em] w-full overflow-visible text-stage-gold/65"
            viewBox="0 0 400 22"
            preserveAspectRatio="none"
            fill="none"
          >
            <path
              class="lyric-ink"
              pathLength="100"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              d="M3 13C70 6 122 20 181 11S300 7 397 10M22 19C113 13 232 18 365 15"
            />
          </svg>
          <span
            v-if="fragment.card && fragmentIndex === 0"
            class="absolute -top-2.5 left-[13%] h-4 w-13 -rotate-6 bg-stage-muted/25"
          />
        </p>
      </div>
      <span
        v-if="layout === 'montage'"
        class="absolute -top-9 left-[3%] font-mono text-[10px] tracking-[.3em] text-stage-muted/65"
        aria-hidden="true"
        >{{ String(index + 1).padStart(2, '0') }} / LYRIC STUDY</span
      >
    </div>
  </div>
</template>

<style scoped>
.lyric-glyph[data-timed] {
  background-image: linear-gradient(
    90deg,
    var(--lyric-fill-color, var(--color-stage-gold)) var(--lyric-fill, 0%),
    var(--lyric-rest-color, var(--color-stage-muted)) var(--lyric-fill, 0%)
  );
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
</style>
