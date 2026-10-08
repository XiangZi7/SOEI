<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useMusicStore } from '../../stores/music'
import { AppIcon, UiButton } from '../../components/ui'
import ImmersiveScene from '../visual/ImmersiveScene.vue'
import SceneModePicker from '../visual/SceneModePicker.vue'

defineProps<{ testLoading?: boolean }>()
defineEmits<{ test: []; preview: [] }>()
const { preferences } = storeToRefs(useMusicStore())
</script>

<template>
  <section
    class="mb-10 overflow-hidden rounded-2xl border border-line bg-stage"
    aria-label="歌词舞台预览"
  >
    <div class="relative h-100 overflow-hidden max-sm:h-90">
      <ImmersiveScene
        preview
        showcase
      />
      <UiButton
        variant="ghost"
        class="absolute top-7 right-[5%] gap-2 rounded-full border border-line bg-stage/50 px-4 text-label text-stage-muted backdrop-blur-md hover:text-ink max-sm:top-6"
        @click="$emit('preview')"
        ><span>进入舞台</span
        ><AppIcon
          name="arrow-up-right"
          :size="14"
      /></UiButton>
      <p
        class="pointer-events-none absolute bottom-8 left-[5%] text-[9px] tracking-[.24em] text-stage-muted"
      >
        LYRICS BECOME A WORLD
      </p>
    </div>
    <div
      class="flex flex-wrap items-center justify-between gap-5 border-t border-line bg-white/2 px-[5%] py-5 max-sm:gap-4"
    >
      <div>
        <h2 class="font-display text-xl">让歌词，成为风景。</h2>
        <p class="mt-2 text-label text-stage-muted">
          逐字写下，让画面随每一句流动。
        </p>
      </div>
      <SceneModePicker
        v-model="preferences.layout"
        v-model:seed="preferences.sceneSeed"
      />
      <UiButton
        variant="ghost"
        class="min-h-11 shrink-0 gap-2.5 rounded-full bg-stage-gold px-5 text-stage hover:bg-stage-gold/90 max-sm:w-full"
        :disabled="testLoading"
        :aria-busy="testLoading"
        @click="$emit('test')"
        ><AppIcon
          :name="testLoading ? 'loader-circle' : 'play'"
          :size="16"
          :class="{ 'animate-spin': testLoading }"
        />{{ testLoading ? '正在准备…' : '播放测试'
        }}<span class="ml-1 text-[9px] opacity-70">36s</span></UiButton
      >
    </div>
  </section>
</template>
