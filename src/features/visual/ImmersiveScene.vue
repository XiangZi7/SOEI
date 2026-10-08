<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useMusicStore } from '../../stores/music'
import { lyricIndexAt } from '../lyrics/lrc'
import { assetUrl } from '../../bridge/native'
import Artwork from '../../components/ui/Artwork.vue'
const props = defineProps<{ preview?: boolean; wallpaper?: boolean }>()
const store = useMusicStore()
const { activeTrack, previewTrack, lyrics, snapshot, preferences } =
  storeToRefs(store)
const track = computed(() =>
  props.preview ? previewTrack.value : activeTrack.value
)
const background = computed(
  () =>
    (track.value && preferences.value.trackBackgrounds[track.value.id]) ||
    preferences.value.background
)
const video = computed(() => /\.(mp4|webm)$/i.test(background.value))
const lyricIndex = computed(() =>
  lyricIndexAt(
    lyrics.value,
    snapshot.value.positionMs +
      preferences.value.lyricOffset +
      (track.value ? (preferences.value.trackOffsets[track.value.id] ?? 0) : 0)
  )
)
const currentText = computed(() => lyrics.value[lyricIndex.value]?.text ?? '')
const nextText = computed(() => lyrics.value[lyricIndex.value + 1]?.text ?? '')
const chunks = computed(() => {
  if (props.preview)
    return ['日々が', '優しくして', 'いる時までは', '知らなかった']
  const text = currentText.value
  if (text.length > 80) return [text]
  const segments = text.split(/(?<=[，。、,;])|\s+(?=\S)/).filter(Boolean)
  return segments.length > 1 && segments.length <= 4 ? segments : [text]
})
const longLine = computed(() => currentText.value.length > 50)
const light = computed(() =>
  preferences.value.quality === 'power' || preferences.value.reducedMotion
    ? 0
    : Math.min(0.22, (snapshot.value.energy[0] ?? 0) * 0.22)
)
function backgroundFailed() {
  store.report('视频背景无法播放，已回退到静态封面')
  if (track.value) delete preferences.value.trackBackgrounds[track.value.id]
  preferences.value.background = ''
}
</script>
<template>
  <section
    class="immersive-scene"
    :class="[
      `layout-${preferences.layout}`,
      { 'wallpaper-scene': wallpaper, 'long-line': longLine },
    ]"
    :style="{
      '--lyric-size': `${preferences.lyricSize}px`,
      '--energy-light': light,
    }"
    aria-label="沉浸式音乐场景"
  >
    <Transition name="scene">
      <div
        :key="`${track?.id ?? 'empty'}-${background}`"
        class="scene-background"
      >
        <video
          v-if="video"
          class="background-media"
          :src="assetUrl(background)"
          autoplay
          muted
          loop
          playsinline
          @error="backgroundFailed"
        />
        <Artwork
          v-else-if="background"
          :src="background"
          title="场景背景"
        />
        <Artwork
          v-else-if="preview"
          :artwork="previewTrack.artwork"
          title="示例场景"
        />
        <Artwork
          v-else
          :src="track?.coverRef"
          :title="track?.title"
        />
      </div>
    </Transition>
    <div class="scene-shade" />
    <div class="scene-energy" />
    <div class="scene-caption">
      <span class="eyebrow">{{
        preview ? 'VISUAL PREVIEW' : 'A MOMENT, ANOTHER WORLD'
      }}</span
      ><span class="scene-caption-line" />
    </div>
    <div class="scene-composition">
      <template v-if="preferences.layout === 'title'">
        <p class="title-artist">{{ track?.artist }}</p>
        <h1 class="cinematic-title">{{ track?.title ?? 'Music Space' }}</h1>
        <p class="title-lyric">
          {{ preview ? '日々が 優しくして いる時までは' : currentText }}
        </p>
      </template>
      <template v-else-if="preview || currentText">
        <Transition
          name="fade"
          mode="out-in"
          ><div
            :key="currentText || track?.id"
            class="artistic-lyrics"
            :class="{ 'preview-lyrics': preview }"
            lang="ja"
          >
            <p
              v-for="(chunk, index) in chunks"
              :key="index"
              class="lyric-fragment"
              :class="`fragment-${index}`"
            >
              {{ chunk }}
            </p>
          </div></Transition
        >
        <p class="next-lyric">
          {{ preview ? 'あの温もりを、忘れない。' : nextText }}
        </p>
      </template>
      <template v-else>
        <div class="no-lyrics">
          <p class="eyebrow">
            {{
              lyrics.length
                ? 'THE STORY IS ABOUT TO BEGIN'
                : 'LET THE MUSIC SPEAK'
            }}
          </p>
          <h1>{{ track?.title ?? '你的音乐，即将成为风景' }}</h1>
          <p>{{ track?.artist ?? '选择一首音乐，进入沉浸空间' }}</p>
        </div>
      </template>
    </div>
    <div class="scene-side-poem">
      <span>Every song<br />becomes<br />a visual world.</span>
    </div>
    <div
      v-if="!wallpaper"
      class="scene-track-caption"
    >
      <span>{{ track?.title }}</span
      ><small>{{ track?.artist }}</small>
    </div>
  </section>
</template>
<style scoped>
.immersive-scene {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--color-canvas);
}
.scene-background {
  position: absolute;
  inset: 0;
}
.scene-background :deep(.artwork) {
  opacity: 0.75;
}
.background-media {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.scene-shade {
  position: absolute;
  inset: 0;
  background: var(--gradient-scene);
}
.scene-energy {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: var(--gradient-energy);
  opacity: var(--energy-light);
  transition: opacity 120ms linear;
}
.scene-caption {
  position: absolute;
  top: 40px;
  left: 5.5%;
  display: flex;
  align-items: center;
  gap: 22px;
}
.scene-caption .eyebrow {
  font-size: 8px;
}
.scene-caption-line {
  width: 80px;
  height: 1px;
  background: var(--line);
}
.scene-composition {
  position: absolute;
  inset: 16% 8% 22%;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.artistic-lyrics {
  width: min(750px, 85%);
  margin: 0 auto;
  font-family: var(--font-serif);
  text-shadow: 0 2px 20px var(--color-shadow);
}
.lyric-fragment {
  font-size: clamp(24px, 4vw, var(--lyric-size));
  font-weight: 400;
  line-height: 1.6;
  letter-spacing: 0.12em;
  margin: 4px 0;
  overflow-wrap: anywhere;
}
.fragment-0 {
  margin-left: 0;
}
.fragment-1 {
  margin-left: 9%;
  font-size: calc(var(--lyric-size) * 1.14);
}
.fragment-2 {
  margin-left: 27%;
  font-size: calc(var(--lyric-size) * 0.8);
}
.fragment-3 {
  margin-left: 17%;
}
.next-lyric {
  text-align: center;
  color: var(--color-muted);
  font: 13px var(--font-serif);
  letter-spacing: 0.13em;
  margin-top: 26px;
}
.scene-side-poem {
  position: absolute;
  right: 5.5%;
  bottom: 24%;
  font: 9px/1.7 var(--font-serif);
  letter-spacing: 0.09em;
  color: var(--color-muted);
}
.scene-track-caption {
  position: absolute;
  left: 5.5%;
  bottom: 23%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font: 22px var(--font-serif);
}
.scene-track-caption small {
  font: 10px var(--font-serif);
  letter-spacing: 0.12em;
  color: var(--color-muted);
}
.cinematic-title {
  font: clamp(50px, 13vw, 170px)/1.1 var(--font-serif);
  text-align: center;
  margin: 10px 0;
  overflow-wrap: anywhere;
}
.title-artist {
  text-align: center;
  font: 18px var(--font-serif);
  letter-spacing: 0.22em;
}
.title-lyric {
  text-align: center;
  font: 21px var(--font-serif);
  margin-top: 25px;
}
.layout-readable .artistic-lyrics {
  width: 100%;
  text-align: center;
}
.layout-readable .lyric-fragment {
  margin-left: 0;
  font-size: var(--lyric-size);
  letter-spacing: 0.05em;
}
.long-line .artistic-lyrics {
  width: 100%;
}
.long-line .lyric-fragment {
  font-size: clamp(20px, 3vw, 36px);
  letter-spacing: 0.03em;
}
.no-lyrics {
  text-align: center;
}
.no-lyrics h1 {
  font: clamp(30px, 5vw, 76px) var(--font-serif);
  margin: 23px 0;
  overflow-wrap: anywhere;
}
.no-lyrics > p:last-child {
  font: 16px var(--font-serif);
  letter-spacing: 0.14em;
  color: var(--color-muted);
}
.wallpaper-scene .scene-composition {
  bottom: 12%;
}
.wallpaper-scene .scene-caption {
  display: none;
}
@media (max-width: 650px) {
  .scene-side-poem {
    display: none;
  }
  .scene-composition {
    inset: 15% 7% 25%;
  }
  .artistic-lyrics {
    width: 100%;
  }
  .lyric-fragment {
    font-size: 28px;
  }
  .fragment-1 {
    font-size: 32px;
  }
  .fragment-2 {
    font-size: 22px;
  }
  .scene-track-caption {
    bottom: 25%;
  }
  .scene-caption {
    top: 110px;
  }
}
</style>
