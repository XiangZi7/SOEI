<script setup lang="ts">
import { computed } from 'vue'
import Artwork from '../../components/ui/Artwork.vue'
import type { LyricLine, Track } from '../../types/music'
import { formatTime } from '../lyrics/lrc'

const props = defineProps<{
  track: Track | null
  lines: LyricLine[]
  index: number
  energy?: number[]
}>()
const current = computed(() => props.lines[props.index]?.text ?? '')
const upcoming = computed(() =>
  props.index < 0 ? [] : props.lines.slice(props.index + 1, props.index + 5)
)
// 无音频时波形只作为封面装饰，真实播放时随频段能量变化。
const bars = Array.from(
  { length: 42 },
  (_, index) =>
    3 + Math.sin(index * 1.7) ** 2 * 9 + Math.sin(index * 0.24) ** 2 * 10
)
</script>

<template>
  <article class="cover-composition">
    <header class="cover-chrome">
      <span
        class="cover-marks"
        aria-hidden="true"
        ><i /><i
      /></span>
      <span
        class="cover-rule"
        aria-hidden="true"
      />
      <span class="cover-lyrics-label">Lyrics</span>
      <span
        class="cover-rule cover-rule-short"
        aria-hidden="true"
      />
      <slot name="window"
        ><span
          class="cover-window-marks"
          aria-hidden="true"
          ><svg viewBox="0 0 12 12"><path d="M2 6h8" /></svg
          ><svg viewBox="0 0 12 12">
            <rect
              x="3"
              y="3"
              width="6"
              height="6"
            /></svg
          ><svg viewBox="0 0 12 12"><path d="m3 3 6 6m0-6-6 6" /></svg></span
      ></slot>
    </header>
    <div class="cover-body">
      <div class="cover-player">
        <div class="cover-record">
          <div class="cover-artwork">
            <Artwork
              :artwork="track?.artwork"
              :src="track?.coverRef"
              :title="track?.title"
            />
          </div>
          <div class="cover-info">
            <h1>{{ track?.title ?? '你的音乐，另一片风景' }}</h1>
            <p class="cover-artist">{{ track?.artist ?? '选择一首音乐' }}</p>
            <div
              class="cover-waveform"
              aria-hidden="true"
            >
              <i
                v-for="(height, index) in bars"
                :key="index"
                :style="{
                  height:
                    (energy?.length
                      ? height * (0.45 + (energy[index % energy.length] ?? 0))
                      : height) + 'px',
                }"
              />
            </div>
            <slot name="progress"
              ><span class="cover-time">{{
                track?.demo
                  ? '视觉预览'
                  : '00:00 / ' + formatTime(track?.durationMs ?? 0)
              }}</span></slot
            >
            <span class="cover-status">{{
              track?.demo ? '视觉预览 · 无音频' : '此刻正在听'
            }}</span>
          </div>
        </div>
        <div class="cover-transport"><slot name="controls" /></div>
      </div>
      <div
        class="cover-lyrics"
        aria-label="当前歌曲歌词"
      >
        <p
          v-if="current"
          class="cover-current"
        >
          {{ current }}
        </p>
        <p
          v-else
          class="cover-empty"
        >
          {{ lines.length ? '前奏 · 故事即将开始' : '暂无歌词' }}
        </p>
        <div class="cover-upcoming">
          <p
            v-for="line in upcoming"
            :key="line.id"
          >
            {{ line.text }}
          </p>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.cover-composition {
  container-type: inline-size;
  width: min(840px, 100%, calc((100dvh - 210px) * 1.82));
  margin: auto;
  overflow: hidden;
  border: 1px solid #c8cec032;
  border-radius: 8px;
  color: #e9e8de;
  background:
    radial-gradient(ellipse at 0 0, #d1d8cf16, transparent 55%),
    linear-gradient(120deg, #111815c9, #050a08e8 64%, #0c1412d4);
  box-shadow:
    0 18px 60px #0006,
    inset 0 1px #ffffff07;
  backdrop-filter: blur(22px);
}
.cover-chrome {
  display: flex;
  align-items: center;
  gap: 2cqw;
  height: 7.4cqw;
  min-height: 27px;
  padding: 0 2.5cqw;
  color: #a4aaa0;
}
.cover-marks {
  display: flex;
  align-items: center;
  gap: 1cqw;
}
.cover-marks i {
  display: block;
  width: 4px;
  height: 4px;
  border: 1px solid #a4aaa0;
  border-radius: 50%;
}
.cover-marks i + i {
  width: 6px;
  height: 6px;
}
.cover-rule {
  height: 1px;
  flex: 1;
  background: linear-gradient(90deg, #c1c8bb33, #c1c8bb0b);
}
.cover-rule-short {
  flex: 0 0 13%;
}
.cover-lyrics-label {
  font-family: var(--font-display);
  font-size: max(8px, 1.65cqw);
  letter-spacing: 0.03em;
}
.cover-window-marks {
  display: flex;
  gap: 1.4cqw;
  color: #a4aaa0;
}
.cover-window-marks svg {
  width: max(10px, 1.6cqw);
  height: max(10px, 1.6cqw);
  fill: none;
  stroke: currentColor;
  stroke-width: 0.7;
}
.cover-body {
  display: grid;
  grid-template-columns: 63% 37%;
  height: 47.5cqw;
  padding: 2cqw 5cqw 5cqw;
}
.cover-player {
  display: flex;
  min-width: 0;
  flex-direction: column;
  padding-right: 5cqw;
}
.cover-record {
  display: grid;
  grid-template-columns: 53% minmax(0, 1fr);
  gap: 4cqw;
  align-items: start;
}
.cover-artwork {
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid #c7cdbc42;
  border-radius: 4px;
}
.cover-info {
  min-width: 0;
  padding-top: 2.3cqw;
}
.cover-info h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(16px, 3.4cqw, 30px);
  font-weight: 400;
  line-height: 1.05;
  overflow-wrap: anywhere;
}
.cover-artist {
  margin: 1.2cqw 0 0;
  color: #c0c4b7;
  font-size: clamp(8px, 1.65cqw, 13px);
  line-height: 1.55;
  letter-spacing: 0.08em;
  overflow-wrap: anywhere;
}
.cover-waveform {
  display: flex;
  align-items: center;
  gap: 1px;
  height: 10cqw;
  min-height: 28px;
  overflow: hidden;
  opacity: 0.32;
}
.cover-waveform i {
  display: block;
  flex: 1;
  min-width: 1px;
  background: #b1bcb0;
}
.cover-time {
  font-size: max(8px, 1.55cqw);
  color: #b1b7aa;
}
.cover-status {
  display: block;
  margin-top: 1cqw;
  font-size: max(7px, 1.25cqw);
  color: #788276;
  letter-spacing: 0.04em;
}
.cover-transport {
  margin-top: auto;
  padding-top: 3cqw;
  transform: translateY(-3cqw);
}
.cover-lyrics {
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  padding: 0.7cqw 0 0 7cqw;
  border-left: 1px solid #c6ccbd22;
  font-family: 'SOEI Mincho', serif;
  scrollbar-width: thin;
}
.cover-current {
  margin: 0;
  white-space: pre-line;
  font-size: clamp(13px, 2.8cqw, 24px);
  font-weight: 400;
  line-height: 1.85;
  letter-spacing: 0.12em;
  overflow-wrap: anywhere;
}
.cover-upcoming {
  margin-top: 4.3cqw;
  color: #9fa89a5c;
  font-size: clamp(10px, 2.2cqw, 18px);
  line-height: 1.8;
  letter-spacing: 0.08em;
}
.cover-upcoming p {
  margin: 0 0 1cqw;
  overflow-wrap: anywhere;
}
.cover-empty {
  margin: 0;
  font-size: max(10px, 2cqw);
  color: #abb4a1;
  line-height: 1.8;
}
@media (max-width: 520px) {
  .cover-body {
    height: 67cqw;
    grid-template-columns: 62% 38%;
    padding: 3cqw 4cqw 5cqw;
  }
  .cover-player {
    padding-right: 3cqw;
  }
  .cover-record {
    grid-template-columns: 53% minmax(0, 1fr);
    gap: 3cqw;
  }
  .cover-info h1 {
    font-size: 16px;
  }
  .cover-waveform {
    height: 6cqw;
  }
  .cover-lyrics {
    padding-left: 4cqw;
  }
  .cover-transport {
    margin-left: -5px;
    margin-right: -5px;
  }
}
</style>
