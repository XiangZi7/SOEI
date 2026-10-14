<script setup lang="ts">
import { computed } from 'vue'
import { UiButton, UiSlider, UiSwitch } from '../../../components/ui'
import SettingRow from '../../settings/SettingRow.vue'
import {
  DEFAULT_CLASSIC_TUNING,
  resolveClassicTuning,
  type ClassicTuning,
} from './classicLayout'

const props = defineProps<{ tuning?: unknown }>()
const emit = defineEmits<{ 'update:tuning': [value: ClassicTuning] }>()
const tuning = computed(() => resolveClassicTuning(props.tuning))
function update(patch: Partial<ClassicTuning>) {
  emit('update:tuning', { ...tuning.value, ...patch })
}
const sliderValue = (event: Event) =>
  Number((event.target as HTMLInputElement).value)
</script>

<template>
  <SettingRow
    title="辉光词旋转"
    hint="随歌词入场轻转，唱过后保留余韵。"
  >
    <UiSwitch
      :model-value="tuning.enableWordRotation"
      label="辉光词旋转"
      @update:model-value="update({ enableWordRotation: $event })"
    />
  </SettingRow>
  <SettingRow
    title="辉光呼吸幅度"
    hint="设为 0 停止整句浮动；减少动态效果时自动静止。"
  >
    <UiSlider
      :min="0"
      :max="2"
      :step="0.1"
      :model-value="tuning.breathingFloatMultiplier"
      label="辉光呼吸幅度"
      @input="update({ breathingFloatMultiplier: sliderValue($event) })"
    />
  </SettingRow>
  <SettingRow
    title="辉光词距"
    hint="缩放与位移后的词间留白。"
  >
    <UiSlider
      :min="0"
      :max="2"
      :step="0.1"
      :model-value="tuning.wordSpacing"
      label="辉光词距"
      :disabled="tuning.useLegacyLayout"
      @input="update({ wordSpacing: sliderValue($event) })"
    />
  </SettingRow>
  <SettingRow
    title="辉光旧版排版"
    hint="使用原歌词分词和固定词距。"
  >
    <UiSwitch
      :model-value="tuning.useLegacyLayout"
      label="辉光旧版排版"
      @update:model-value="update({ useLegacyLayout: $event })"
    />
  </SettingRow>
  <UiButton
    variant="ghost"
    class="mt-2 border border-line"
    @click="emit('update:tuning', { ...DEFAULT_CLASSIC_TUNING })"
    >重置辉光设置</UiButton
  >
</template>
