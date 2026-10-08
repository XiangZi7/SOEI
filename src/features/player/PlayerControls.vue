<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useMusicStore } from '../../stores/music'
import { UiButton, UiIconButton } from '../../components/ui'
import Artwork from '../../components/ui/Artwork.vue'
import PlaybackSeekBar from './PlaybackSeekBar.vue'
import PlaybackTransport from './PlaybackTransport.vue'

const props = defineProps<{ preview?: boolean }>()
defineEmits<{ scene: []; queue: []; fullscreen: [] }>()
const store = useMusicStore()
const { activeTrack, previewTrack, snapshot } = storeToRefs(store)
const track = computed(() =>
  props.preview ? previewTrack.value : activeTrack.value
)
const seek = (positionMs: number) =>
  store.command('seek', { value: positionMs })
function volume(event: Event) {
  void store.command('volume', {
    value: Number((event.target as HTMLInputElement).value),
  })
}
</script>

<template>
  <div
    class="player-bar"
    role="region"
    aria-label="播放控制"
  >
    <div class="player-record">
      <UiButton
        variant="ghost"
        class="player-song"
        :disabled="!track"
        aria-label="打开当前歌曲场景"
        @click="$emit('scene')"
      >
        <Transition
          name="song-change"
          mode="out-in"
          ><span
            :key="track?.id ?? 'empty'"
            class="player-song-content"
            ><span class="player-artwork"
              ><Artwork
                eager
                :artwork="track?.artwork"
                :src="track?.coverRef"
                :title="track?.title"
            /></span>
            <span class="player-label"
              ><span class="player-title">{{
                track?.title ?? '还没有开始聆听'
              }}</span
              ><span class="player-artist">{{
                track?.artist ?? '导入音乐，打开你的空间'
              }}</span></span
            ></span
          ></Transition
        >
      </UiButton>
      <PlaybackSeekBar
        class="player-seek"
        rail
        :snapshot="snapshot"
        :disabled="preview || !track || !snapshot.durationMs"
        :preview="preview"
        :seek="seek"
      />
    </div>
    <PlaybackTransport
      :preview="preview"
      @queue="$emit('queue')"
    />
    <div class="player-volume">
      <UiButton
        variant="icon"
        class="volume-button"
        :disabled="preview"
        :aria-label="snapshot.volume ? '静音' : '取消静音'"
        :title="snapshot.volume ? '静音' : '取消静音'"
        @click="store.command('volume', { value: snapshot.volume ? 0 : 0.65 })"
      >
        <svg
          viewBox="0 0 20 20"
          width="16"
          height="16"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M2 7h3l5-4v14l-5-4H2z"
          />
          <g
            fill="none"
            stroke="currentColor"
            stroke-width="1.2"
          >
            <path
              v-if="snapshot.volume"
              d="M12 6a6 6 0 0 1 0 8m2-10a9 9 0 0 1 0 12"
            />
            <path
              v-else
              d="m13 7 5 6m0-6-5 6"
            />
          </g>
        </svg>
      </UiButton>
      <input
        class="volume-slider"
        type="range"
        aria-label="音量"
        min="0"
        max="1"
        step="0.01"
        :value="snapshot.volume"
        :disabled="preview"
        :style="{ '--volume': snapshot.volume * 100 + '%' }"
        @input="volume"
      />
    </div>
    <UiIconButton
      class="player-fullscreen"
      icon="maximize"
      :icon-size="15"
      label="切换全屏"
      @click="$emit('fullscreen')"
    />
  </div>
</template>

<style scoped>
.player-bar {
  position: relative;
  display: grid;
  grid-template-columns:
    minmax(0, 1.45fr) minmax(150px, 1.1fr) minmax(120px, 1fr)
    36px;
  align-items: center;
  gap: clamp(12px, 2.8%, 30px);
  width: 100%;
  max-width: 840px;
  min-height: 90px;
  margin-inline: auto;
  padding: 9px 35px 9px 8px;
  border: 1px solid #d1d4c62e;
  border-radius: 7px;
  color: #edece5;
  background: linear-gradient(105deg, #1b25224f, #080d0c8a 48%, #0b100d8a);
  backdrop-filter: blur(18px);
  box-shadow:
    inset 0 1px #ffffff04,
    0 8px 32px #0003;
}
.player-record {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 0;
}
.player-song {
  flex: 1;
  justify-content: flex-start;
  min-width: 0;
  padding: 0;
  gap: 18px;
  border: 0;
  background: transparent;
  text-align: left;
}
.player-song-content {
  display: flex;
  min-width: 0;
  width: 100%;
  align-items: center;
  gap: 18px;
}
.player-song:hover {
  background: transparent;
}
.player-artwork {
  display: block;
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  overflow: hidden;
  border: 1px solid #ffffff26;
  border-radius: 3px;
}
.player-label {
  display: block;
  min-width: 0;
}
.player-title {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 500;
  line-height: 1.15;
  letter-spacing: 0.015em;
}
.player-artist {
  display: block;
  margin-top: 4px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 10px;
  line-height: 1.4;
  letter-spacing: 0.08em;
  color: #c6c7bb;
}
.player-seek {
  flex: 0 0 0;
  width: 0;
}
.player-volume {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding-left: 24px;
}
.volume-button {
  width: 28px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 3px;
}
.volume-button:disabled {
  opacity: 0.55;
}
.volume-slider {
  width: min(100%, 120px);
  min-width: 38px;
  height: 24px;
  margin: 0;
  appearance: none;
  background: transparent;
}
.volume-slider::-webkit-slider-runnable-track {
  height: 1px;
  background: linear-gradient(
    to right,
    #eeede3 var(--volume),
    #c9ccbe38 var(--volume)
  );
}
.volume-slider::-webkit-slider-thumb {
  width: 4px;
  height: 4px;
  margin-top: -1.5px;
  appearance: none;
  border: 0;
  border-radius: 50%;
  background: #eeede3;
}
.volume-slider::-moz-range-track {
  height: 1px;
  background: #c9ccbe38;
}
.volume-slider::-moz-range-progress {
  height: 1px;
  background: #eeede3;
}
.volume-slider::-moz-range-thumb {
  width: 4px;
  height: 4px;
  border: 0;
  background: #eeede3;
}
.player-fullscreen {
  width: 32px;
  height: 36px;
  border-radius: 3px;
}
@media (max-width: 740px) {
  .player-volume {
    padding-left: 0;
  }
  .player-bar {
    grid-template-columns: minmax(0, 1.5fr) 100px minmax(55px, 0.65fr) 28px;
    gap: 7px;
    min-height: 58px;
    padding: 6px 30px 6px 6px;
  }
  .player-song {
    gap: 8px;
  }
  .player-song-content {
    gap: 8px;
  }
  .player-artwork {
    width: 40px;
    height: 40px;
  }
  .player-title {
    font-size: 14px;
  }
  .player-artist {
    font-size: 8px;
  }
  .player-fullscreen {
    width: 28px;
  }
}
@media (max-width: 560px) {
  .player-bar {
    grid-template-columns: minmax(0, 1fr) 86px 27px;
    gap: 6px;
    min-height: 62px;
  }
  .player-song {
    gap: 7px;
  }
  .player-song-content {
    gap: 7px;
  }
  .player-label {
    padding-bottom: 0;
  }
  .player-title {
    font-size: 13px;
  }
  .player-artist {
    margin-top: 2px;
    font-size: 8px;
  }
  .player-volume {
    display: none;
  }
}
</style>
