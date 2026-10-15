<script setup lang="ts">
import { computed } from 'vue'
import { UiButton, UiSlider } from '../../../components/ui'
import SettingRow from '../../settings/SettingRow.vue'
import {
  DEFAULT_CADENZA_TUNING,
  resolveCadenzaTuning,
  type CadenzaTuning,
} from './cadenzaLayout'

const props = defineProps<{ tuning?: unknown }>()
const emit = defineEmits<{ 'update:tuning': [value: CadenzaTuning] }>()
const tuning = computed(() => resolveCadenzaTuning(props.tuning))
function update(patch: Partial<CadenzaTuning>) {
  emit('update:tuning', { ...tuning.value, ...patch })
}
const sliderValue = (event: Event) =>
  Number((event.target as HTMLInputElement).value)
</script>

<template>
  <SettingRow
    title="心景字号"
    hint="在自动字号之上再乘一个倍率。改它会触发整行重新排版。"
  >
    <UiSlider
      :min="0.5"
      :max="2"
      :step="0.02"
      :model-value="tuning.fontScale"
      label="心景字号"
      @input="update({ fontScale: sliderValue($event) })"
    />
  </SettingRow>
  <SettingRow
    title="心景换行宽度"
    hint="相对舞台宽度的换行上限。越窄则一句换成越多行、散点铺得越开。"
  >
    <UiSlider
      :min="0.3"
      :max="1"
      :step="0.02"
      :model-value="tuning.widthRatio"
      label="心景换行宽度"
      @input="update({ widthRatio: sliderValue($event) })"
    />
  </SettingRow>
  <SettingRow
    title="心景浮动幅度"
    hint="随音频能量起伏的漂浮与脉动强度；设为 0 则只保留入场与退场。"
  >
    <UiSlider
      :min="0"
      :max="2.5"
      :step="0.05"
      :model-value="tuning.motionAmount"
      label="心景浮动幅度"
      @input="update({ motionAmount: sliderValue($event) })"
    />
  </SettingRow>
  <SettingRow
    title="心景发光强度"
    hint="逐字光晕的整体倍率。"
  >
    <UiSlider
      :min="0"
      :max="2.5"
      :step="0.05"
      :model-value="tuning.glowIntensity"
      label="心景发光强度"
      @input="update({ glowIntensity: sliderValue($event) })"
    />
  </SettingRow>
  <UiButton
    variant="ghost"
    class="mt-2 border border-line"
    @click="emit('update:tuning', { ...DEFAULT_CADENZA_TUNING })"
    >重置心景设置</UiButton
  >
</template>
