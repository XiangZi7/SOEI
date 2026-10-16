<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { UiInput, UiButton } from '../../../../components/ui'
import { sanitizeBackgroundUrl } from '../tuning'
const props = defineProps<{ value: string }>()
const emit = defineEmits<{ 'update:value': [value: string] }>()
const state = reactive({ draft: props.value })
watch(
  () => props.value,
  value => {
    state.draft = value
  }
)
const valid = computed(() => sanitizeBackgroundUrl(state.draft))
function apply() {
  if (valid.value) emit('update:value', valid.value)
}
</script>
<template>
  <div class="flex min-w-0 flex-wrap items-center gap-2">
    <UiInput
      v-model="state.draft"
      class="min-w-0 flex-1"
      label="网页地址"
      placeholder="https://"
      @keydown.enter.prevent="apply"
    />
    <UiButton
      variant="ghost"
      class="border border-line"
      :disabled="!valid"
      @click="apply"
      >应用网址</UiButton
    >
  </div>
</template>
