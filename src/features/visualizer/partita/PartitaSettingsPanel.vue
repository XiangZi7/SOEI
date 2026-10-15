<script setup lang="ts">
import { computed } from 'vue'
import { UiButton, UiSlider, UiSwitch } from '../../../components/ui'
import SettingRow from '../../settings/SettingRow.vue'
import {
  DEFAULT_PARTITA_TUNING,
  resolvePartitaTuning,
  type PartitaTuning,
} from './partitaLayout'

const props = defineProps<{ tuning?: unknown }>()
const emit = defineEmits<{ 'update:tuning': [value: PartitaTuning] }>()
const tuning = computed(() => resolvePartitaTuning(props.tuning))
function update(patch: Partial<PartitaTuning>) {
  emit('update:tuning', { ...tuning.value, ...patch })
}
const sliderValue = (event: Event) =>
  Number((event.target as HTMLInputElement).value)
</script>

<template>
  <SettingRow
    title="云阶导引线"
    hint="每行外侧的竖线与底边横线，唱到该行时点亮。"
  >
    <UiSwitch
      :model-value="tuning.showGuideLines"
      label="云阶导引线"
      @update:model-value="update({ showGuideLines: $event })"
    />
  </SettingRow>
  <SettingRow
    title="云阶语义分行"
    hint="按中日韩语义词组分行；关闭后按解析器的原始分词。"
  >
    <UiSwitch
      :model-value="tuning.useSemanticLayout"
      label="云阶语义分行"
      @update:model-value="update({ useSemanticLayout: $event })"
    />
  </SettingRow>
  <SettingRow
    title="云阶错落下限"
    hint="每行左右偏移的最小幅度。"
  >
    <UiSlider
      :min="0"
      :max="180"
      :step="5"
      :model-value="tuning.staggerMin"
      label="云阶错落下限"
      @input="update({ staggerMin: sliderValue($event) })"
    />
  </SettingRow>
  <SettingRow
    title="云阶错落上限"
    hint="每行左右偏移的最大幅度；与下限相等时各行对齐。"
  >
    <UiSlider
      :min="0"
      :max="180"
      :step="5"
      :model-value="tuning.staggerMax"
      label="云阶错落上限"
      @input="update({ staggerMax: sliderValue($event) })"
    />
  </SettingRow>
  <UiButton
    variant="ghost"
    class="mt-2 border border-line"
    @click="emit('update:tuning', { ...DEFAULT_PARTITA_TUNING })"
    >重置云阶设置</UiButton
  >
</template>
