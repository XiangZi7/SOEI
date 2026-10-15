<script setup lang="ts">
import { computed } from 'vue'
import { UiButton, UiSelect, UiSlider } from '../../../components/ui'
import SettingRow from '../../settings/SettingRow.vue'
import {
  DEFAULT_TILT_TUNING,
  resolveTiltTuning,
  type TiltColorScheme,
  type TiltTuning,
} from './tiltLayout'

const props = defineProps<{ tuning?: unknown }>()
const emit = defineEmits<{ 'update:tuning': [value: TiltTuning] }>()
const tuning = computed(() => resolveTiltTuning(props.tuning))
function update(patch: Partial<TiltTuning>) {
  emit('update:tuning', { ...tuning.value, ...patch })
}
const sliderValue = (event: Event) =>
  Number((event.target as HTMLInputElement).value)
const schemes: { value: TiltColorScheme; label: string }[] = [
  { value: 'default', label: '正文主色 · 斜体点缀色' },
  { value: 'swap', label: '正文点缀色 · 斜体主色' },
  { value: 'accentAll', label: '全部点缀色' },
  { value: 'primaryAll', label: '全部主色' },
]
</script>

<template>
  <SettingRow
    title="错落分行概率"
    hint="越高越容易把长句切成多行；设为 0 始终单行。"
  >
    <UiSlider
      :min="0"
      :max="1"
      :step="0.05"
      :model-value="tuning.splitProbability"
      label="错落分行概率"
      @input="update({ splitProbability: sliderValue($event) })"
    />
  </SettingRow>
  <SettingRow
    title="错落斜体概率"
    hint="整句最多一行走大号斜体；设为 0 全部横排。"
  >
    <UiSlider
      :min="0"
      :max="1"
      :step="0.05"
      :model-value="tuning.tiltStyleProbability"
      label="错落斜体概率"
      @input="update({ tiltStyleProbability: sliderValue($event) })"
    />
  </SettingRow>
  <SettingRow
    title="错落配色"
    hint="正文行与斜体行分别取主色或封面点缀色。"
  >
    <UiSelect
      label="错落配色"
      :model-value="tuning.colorScheme"
      @change="
        update({
          colorScheme: ($event.target as HTMLSelectElement)
            .value as TiltColorScheme,
        })
      "
      ><option
        v-for="scheme in schemes"
        :key="scheme.value"
        :value="scheme.value"
      >
        {{ scheme.label }}
      </option></UiSelect
    >
  </SettingRow>
  <UiButton
    variant="ghost"
    class="mt-2 border border-line"
    @click="emit('update:tuning', { ...DEFAULT_TILT_TUNING })"
    >重置错落设置</UiButton
  >
</template>
