<script setup lang="ts">
import { computed } from 'vue'
import { desktop } from '../../../bridge/native'
import { UiSelect, UiSlider, UiSwitch, UiButton } from '../../../components/ui'
import SettingRow from '../../settings/SettingRow.vue'
import UrlBackgroundSettings from './url/UrlBackgroundSettings.vue'
import {
  visualizerBackgroundEntries,
  visualizerBackgroundEntry,
} from './registry'
import {
  backgroundControls,
  backgroundDefaults,
  isBackgroundMode,
  resolveBackgroundTuning,
  sanitizeBackgroundUrl,
} from './tuning'
const props = defineProps<{
  mode?: string
  tunings?: Record<string, unknown>
}>()
const emit = defineEmits<{
  'update:mode': [value: string]
  'update:tunings': [value: Record<string, unknown>]
}>()
const mode = computed(
  () => visualizerBackgroundEntry(props.mode)?.mode ?? 'common'
)
const selected = computed(() =>
  isBackgroundMode(mode.value) ? mode.value : 'common'
)
const tuning = computed<Record<string, unknown>>(() => ({
  ...resolveBackgroundTuning(selected.value, props.tunings?.[selected.value]),
}))
const controls = computed(() =>
  backgroundControls[selected.value].filter(
    control =>
      !control.when || tuning.value[control.when.key] === control.when.value
  )
)
function update(key: string, value: unknown) {
  emit('update:tunings', {
    ...props.tunings,
    [selected.value]: { ...tuning.value, [key]: value },
  })
}
const caption: Record<string, string> = {
  'full-overlay': '全屏叠加',
  'half-pane-gradient': '半幅渐变',
  both: '渐变与像素',
  mesh: '流动渐变',
  dithering: '像素抖动',
  'cover-theme': '封面与主题',
  'cover-only': '封面原色',
  'fluted-glass': '条纹玻璃',
  'paper-texture': '纸张纹理',
  'halftone-dots': '半调网点',
  'lens-distortion': '镜头畸变',
}
</script>
<template>
  <div class="mt-5 border-t border-line pt-3">
    <SettingRow
      title="舞台背景"
      hint="Folia 场景可独立选择背景；静止场景保持纯色。自定义图片或视频优先显示。"
    >
      <UiSelect
        :model-value="mode"
        label="舞台背景"
        @change="
          emit('update:mode', ($event.target as HTMLSelectElement).value)
        "
      >
        <option
          v-for="entry in visualizerBackgroundEntries()"
          :key="entry.mode"
          :value="entry.mode"
        >
          {{ entry.label }} · {{ entry.description }}
        </option>
      </UiSelect>
    </SettingRow>
    <SettingRow
      v-for="control in controls"
      :key="selected + control.key"
      :title="control.label"
    >
      <UiSwitch
        v-if="typeof tuning[control.key] === 'boolean'"
        :model-value="Boolean(tuning[control.key])"
        :label="control.label"
        @update:model-value="update(control.key, $event)"
      />
      <UiSelect
        v-else-if="control.options"
        :model-value="String(tuning[control.key])"
        :label="control.label"
        @change="
          update(control.key, ($event.target as HTMLSelectElement).value)
        "
      >
        <option
          v-for="option in control.options"
          :key="option"
          :value="option"
        >
          {{ caption[option] ?? option }}
        </option>
      </UiSelect>
      <template v-else-if="typeof tuning[control.key] === 'number'">
        <UiSlider
          :model-value="Number(tuning[control.key])"
          :min="control.min"
          :max="control.max"
          :step="control.step"
          :label="control.label"
          @input="
            update(
              control.key,
              Number(($event.target as HTMLInputElement).value)
            )
          "
        />
        <span class="w-10 text-right text-caption">{{
          Number(tuning[control.key]).toFixed(2)
        }}</span>
      </template>
      <UrlBackgroundSettings
        v-else
        :value="String(tuning[control.key] ?? '')"
        @update:value="update(control.key, $event)"
      />
    </SettingRow>
    <p
      v-if="selected === 'url'"
      class="my-3 text-caption text-muted"
      role="status"
    >
      {{
        tuning.url && !sanitizeBackgroundUrl(tuning.url)
          ? '请输入有效的 HTTP 或 HTTPS 地址。'
          : desktop
            ? '桌面版当前只允许应用同源页面；外部网页尚未启用。暂停或省电时显示主题底色。'
            : '部分网站不允许嵌入。暂停或省电时显示主题底色。'
      }}
    </p>
    <UiButton
      variant="ghost"
      @click="
        emit('update:tunings', {
          ...tunings,
          [selected]: { ...backgroundDefaults[selected] },
        })
      "
      >重置当前背景</UiButton
    >
  </div>
</template>
