<script setup lang="ts">
import { computed } from 'vue'
import { UiButton, UiSlider, UiSwitch } from '../../../components/ui'
import SettingRow from '../../settings/SettingRow.vue'
import {
  DEFAULT_CLADDAGH_TUNING,
  resolveCladdaghTuning,
  type CladdaghTuning,
} from './claddaghGeometry'

const props = defineProps<{ tuning?: unknown }>()
const emit = defineEmits<{ 'update:tuning': [value: CladdaghTuning] }>()
const tuning = computed(() => resolveCladdaghTuning(props.tuning))
function update(patch: Partial<CladdaghTuning>) {
  emit('update:tuning', { ...tuning.value, ...patch })
}
const sliderValue = (event: Event) =>
  Number((event.target as HTMLInputElement).value)
</script>

<template>
  <SettingRow
    title="环场聚焦放大"
    hint="转到正前方的字额外放大多少；同时影响字间距。"
  >
    <UiSlider
      :min="0"
      :max="2"
      :step="0.05"
      :model-value="tuning.focusScaleRatio"
      label="环场聚焦放大"
      @input="update({ focusScaleRatio: sliderValue($event) })"
    />
  </SettingRow>
  <SettingRow
    title="环场半径"
    hint="椭圆环相对舞台宽度的大小。"
  >
    <UiSlider
      :min="0.4"
      :max="2"
      :step="0.05"
      :model-value="tuning.radiusScale"
      label="环场半径"
      @input="update({ radiusScale: sliderValue($event) })"
    />
  </SettingRow>
  <SettingRow
    title="环场倾角"
    hint="长轴相对屏幕的角度；45° 对齐反对角线。"
  >
    <UiSlider
      :min="0"
      :max="90"
      :step="1"
      :model-value="tuning.ellipseTiltDeg"
      label="环场倾角"
      @input="update({ ellipseTiltDeg: sliderValue($event) })"
    />
  </SettingRow>
  <SettingRow
    title="环场字间距"
    hint="在测量宽度之外逐字累加的额外间隙。"
  >
    <UiSlider
      :min="-20"
      :max="60"
      :step="1"
      :model-value="tuning.letterSpacingOffset"
      label="环场字间距"
      @input="update({ letterSpacingOffset: sliderValue($event) })"
    />
  </SettingRow>
  <SettingRow
    title="环场中轴线"
    hint="随低频与人声搏动的中心短线；副歌时发光。"
  >
    <UiSwitch
      :model-value="tuning.showAxisLine"
      label="环场中轴线"
      @update:model-value="update({ showAxisLine: $event })"
    />
  </SettingRow>
  <UiButton
    variant="ghost"
    class="mt-2 border border-line"
    @click="emit('update:tuning', { ...DEFAULT_CLADDAGH_TUNING })"
    >重置环场设置</UiButton
  >
</template>
