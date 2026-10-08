<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { useUiAttrs } from './classes'
defineOptions({ inheritAttrs: false })
const { forwardedAttrs, classes } = useUiAttrs()
withDefaults(
  defineProps<{
    label: string
    type?: 'text' | 'number' | 'search'
    placeholder?: string
    disabled?: boolean
  }>(),
  { type: 'text' }
)
const model = defineModel<string | number>({ default: '' })
const inputElement = useTemplateRef<HTMLInputElement>('inputElement')
defineExpose({ focus: () => inputElement.value?.focus() })
function input(event: Event) {
  const target = event.target as HTMLInputElement
  model.value = target.type === 'number' ? Number(target.value) : target.value
}
</script>
<template>
  <input
    ref="inputElement"
    v-bind="forwardedAttrs()"
    :type="type"
    :aria-label="label"
    :placeholder="placeholder"
    :disabled="disabled"
    :value="model"
    :class="
      classes(
        'min-h-9 min-w-0 rounded-input border border-line bg-surface px-3 py-2 text-label text-ink placeholder:text-muted focus-visible:border-accent disabled:opacity-35'
      )
    "
    @input="input"
  />
</template>
