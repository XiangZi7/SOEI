<script setup lang="ts">
import type { SceneLayout } from '../../types/music'
import { sceneModes } from './sceneModes'
import { AppIcon } from '../../components/ui'
import { nextTick, useTemplateRef, watch } from 'vue'
import { useResizeObserver } from '@vueuse/core'

defineProps<{ compact?: boolean }>()
const model = defineModel<SceneLayout>({ required: true })
const seed = defineModel<number>('seed', { required: true })
const choices = useTemplateRef<HTMLElement>('choices')
const buttons = useTemplateRef<HTMLButtonElement[]>('buttons')
function revealSelected() {
  const selected = buttons.value?.find(
    button => button.dataset.mode === model.value
  )
  if (choices.value && selected)
    choices.value.scrollLeft =
      selected.offsetLeft -
      (choices.value.clientWidth - selected.offsetWidth) / 2
}
watch(model, async () => {
  await nextTick()
  revealSelected()
})
useResizeObserver(choices, revealSelected)
</script>

<template>
  <div
    class="flex min-w-0 items-center gap-1.5 rounded-full border border-line bg-stage/70 p-1.5 backdrop-blur-xl"
    role="group"
    aria-label="歌词场景风格"
  >
    <div
      ref="choices"
      class="relative flex min-w-0 gap-1 overflow-x-auto"
      :class="compact ? 'max-w-[58vw] sm:max-w-[65vw]' : 'max-w-[78vw]'"
    >
      <button
        v-for="mode in sceneModes"
        :key="mode.id"
        ref="buttons"
        :data-mode="mode.id"
        class="flex min-h-11 shrink-0 items-center gap-2 rounded-full text-label transition-colors duration-200 hover:bg-hover hover:text-ink max-sm:gap-1.5"
        :class="[
          model === mode.id ? 'bg-white/7 text-ink' : 'text-stage-muted',
          compact ? 'px-3 max-sm:px-2.5' : 'px-3.5 max-sm:px-3',
        ]"
        :aria-pressed="model === mode.id"
        :title="mode.description"
        @click="model = mode.id"
      >
        <span
          class="text-[9px] tabular-nums"
          :class="{ 'max-sm:hidden': compact }"
          >{{ mode.number }}</span
        >
        <span>{{ mode.name }}</span>
        <span
          class="size-1 rounded-full"
          :class="[
            model === mode.id
              ? 'bg-stage-gold shadow-[0_0_9px_#e8c87970]'
              : 'bg-transparent',
            { 'max-sm:hidden': compact },
          ]"
          aria-hidden="true"
        />
      </button>
    </div>
    <button
      class="flex size-11 shrink-0 items-center justify-center rounded-full border-l border-line text-stage-gold transition-colors hover:bg-hover"
      title="重新组合当前歌曲的构图"
      aria-label="换个分镜"
      @click="seed = (seed ?? 0) + 1"
    >
      <AppIcon
        name="shuffle"
        :size="16"
      />
    </button>
  </div>
</template>
