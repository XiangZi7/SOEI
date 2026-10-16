<script setup lang="ts">
import { computed } from 'vue'
import { UiSlider, UiSwitch, UiSelect, UiButton } from '../../../components/ui'
import SettingRow from '../../settings/SettingRow.vue'
import { resolveMonetTuning, DEFAULT_MONET_TUNING } from './tuning'
import type { MonetTuning } from '../backgrounds/model'
const props = defineProps<{ tuning?: unknown }>()
const emit = defineEmits<{ 'update:tuning': [value: MonetTuning] }>()
const tuning = computed(() => resolveMonetTuning(props.tuning))
function update(value: Partial<MonetTuning>) {
  emit('update:tuning', { ...tuning.value, ...value })
}
</script>
<template>
  <SettingRow title="印象字号"
    ><UiSlider
      :model-value="tuning.fontScale"
      :min="0.6"
      :max="2"
      :step="0.05"
      label="印象字号"
      @input="
        update({ fontScale: Number(($event.target as HTMLInputElement).value) })
      "
  /></SettingRow>
  <SettingRow title="关键词配色"
    ><UiSwitch
      :model-value="tuning.keywordColoringEnabled"
      label="印象关键词配色"
      @update:model-value="update({ keywordColoringEnabled: $event })"
  /></SettingRow>
  <SettingRow title="主题描述"
    ><UiSwitch
      :model-value="tuning.showDescription"
      label="印象主题描述"
      @update:model-value="update({ showDescription: $event })"
  /></SettingRow>
  <SettingRow title="音频图形"
    ><UiSwitch
      :model-value="tuning.showAudioVisualization"
      label="印象音频图形"
      @update:model-value="update({ showAudioVisualization: $event })"
  /></SettingRow>
  <SettingRow title="音频样式"
    ><UiSelect
      :model-value="tuning.audioStyle"
      label="印象音频样式"
      @change="
        update({
          audioStyle: ($event.target as HTMLSelectElement)
            .value as MonetTuning['audioStyle'],
        })
      "
      ><option value="bar">频段柱</option>
      <option value="line">响应曲线</option></UiSelect
    ></SettingRow
  >
  <SettingRow title="封面形状"
    ><UiSelect
      :model-value="tuning.portraitStyle"
      label="印象封面形状"
      @change="
        update({
          portraitStyle: ($event.target as HTMLSelectElement)
            .value as MonetTuning['portraitStyle'],
        })
      "
      ><option value="square">方形</option>
      <option value="rectangular">竖幅</option></UiSelect
    ></SettingRow
  >
  <SettingRow title="封面横向位置"
    ><UiSlider
      :model-value="tuning.portraitOffsetX"
      :min="-150"
      :max="0"
      :step="1"
      label="印象封面横向位置"
      @input="
        update({
          portraitOffsetX: Number(($event.target as HTMLInputElement).value),
        })
      "
  /></SettingRow>
  <UiButton
    variant="ghost"
    @click="emit('update:tuning', { ...DEFAULT_MONET_TUNING })"
    >重置印象参数</UiButton
  >
</template>
