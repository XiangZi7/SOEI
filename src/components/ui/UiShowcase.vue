<script setup lang="ts">
import { reactive, toRefs } from 'vue'
import {
  AppIcon,
  UiBadge,
  UiButton,
  UiDialog,
  UiIconButton,
  UiInput,
  UiPanel,
  UiSelect,
  UiSlider,
  UiSwitch,
} from './index'

const state = reactive({
  // 文本输入示例
  name: '',
  // 布局选择示例
  layout: 'artistic',
  // 开关示例
  reducedMotion: false,
  // 滑块示例
  volume: 65,
  // 模态弹窗示例
  dialogOpen: false,
  // 交互反馈示例
  notice: '',
})
const { name, layout, reducedMotion, volume, dialogOpen, notice } =
  toRefs(state)
function completeDialog() {
  state.dialogOpen = false
  state.notice = '弹窗已关闭'
}
const colors = [
  'canvas',
  'space',
  'surface',
  'panel',
  'ink',
  'muted',
  'accent',
  'danger',
] as const
</script>
<template>
  <main
    class="mx-auto max-w-6xl safe-page py-12 text-ink"
    :class="{ 'reduced-motion': reducedMotion }"
  >
    <header class="mb-12 flex-between gap-6">
      <div>
        <p class="eyebrow">SOEI / DESIGN SYSTEM</p>
        <h1 class="mt-3 font-display text-4xl">UI 组件库</h1>
        <p class="mt-3 text-sm text-muted">
          Vue 3 · Tailwind CSS v4 · 共享主题与状态
        </p>
      </div>
      <RouterLink
        to="/"
        class="flex-center gap-2 rounded-input border border-line px-4 py-2 text-label hover:bg-hover"
        ><AppIcon
          name="arrow-left"
          :size="16"
        />音乐空间</RouterLink
      >
    </header>
    <div class="grid gap-6 md:grid-cols-2">
      <UiPanel
        padding
        :glass="false"
        class="md:col-span-2"
        ><h2 class="mb-5 font-display text-xl">主题变量</h2>
        <div class="grid grid-cols-4 gap-4 sm:grid-cols-8">
          <div
            v-for="color in colors"
            :key="color"
          >
            <div
              class="mb-2 aspect-square rounded-input border border-line"
              :style="{ background: `var(--color-${color})` }"
            />
            <code class="text-caption text-muted">{{ color }}</code>
          </div>
        </div></UiPanel
      >
      <UiPanel
        padding
        :glass="false"
        ><h2 class="mb-5 font-display text-xl">按钮与状态</h2>
        <div class="flex flex-wrap gap-3">
          <UiButton
            variant="solid"
            @click="notice = '按钮响应正常'"
            ><AppIcon
              name="plus"
              :size="15"
            />主要操作</UiButton
          ><UiButton @click="dialogOpen = true">打开弹窗</UiButton
          ><UiButton variant="ghost">轻量操作</UiButton
          ><UiButton variant="text">文字操作</UiButton
          ><UiButton disabled>不可用</UiButton
          ><UiButton loading>加载中</UiButton
          ><UiIconButton
            icon="heart"
            label="收藏示例"
            active
          />
        </div>
        <div class="mt-6 flex gap-3">
          <UiBadge>预览</UiBadge><UiBadge tone="accent">已保存</UiBadge
          ><UiBadge tone="danger">读取失败</UiBadge>
        </div>
        <p
          class="mt-4 min-h-5 text-label text-muted"
          role="status"
        >
          {{ notice }}
        </p></UiPanel
      >
      <UiPanel
        padding
        :glass="false"
        ><h2 class="mb-5 font-display text-xl">表单控件</h2>
        <div class="flex flex-col gap-5">
          <label class="flex flex-col gap-2 text-label text-muted"
            >名称<UiInput
              v-model="name"
              label="示例名称"
              placeholder="输入一个名称" /></label
          ><label class="flex flex-col gap-2 text-label text-muted"
            >排版<UiSelect
              v-model="layout"
              label="示例排版"
              :options="[
                { value: 'artistic', label: '错位分层' },
                { value: 'readable', label: '留白易读' },
                { value: 'title', label: '标题与歌词' },
              ]"
          /></label>
          <div class="flex-between text-label">
            <span>减少动态效果</span
            ><UiSwitch
              v-model="reducedMotion"
              label="示例：减少动态效果"
            />
          </div>
          <div class="flex items-center gap-4 text-label">
            <span>音量</span
            ><UiSlider
              v-model="volume"
              label="示例音量"
              class="flex-1"
            /><output class="w-10 tabular-nums">{{ volume }}%</output>
          </div>
        </div></UiPanel
      >
      <UiPanel
        padding
        class="md:col-span-2"
        ><h2 class="mb-4 font-display text-xl">常用 class</h2>
        <p class="text-label leading-7 text-muted">
          <code
            >flex-center / flex-between / truncate-text / safe-page /
            touch-target</code
          ><br />颜色、字体、间距、圆角、阴影通过主题生成工具类；hover、focus-visible、disabled
          和响应式直接使用 Tailwind。业务页面复用组件，调用方 class
          可覆盖默认样式。
        </p></UiPanel
      >
    </div>
    <UiDialog
      v-if="dialogOpen"
      title="组件库弹窗示例"
      @close="dialogOpen = false"
      ><div class="p-8">
        <div class="mb-5 flex-between">
          <h2 class="font-display text-2xl">模态弹窗</h2>
          <UiIconButton
            icon="x"
            label="关闭示例弹窗"
            @click="dialogOpen = false"
          />
        </div>
        <p class="mb-8 text-sm leading-7 text-muted">
          支持 Esc、键盘焦点限制和关闭后焦点恢复，颜色与其他控件共用主题。
        </p>
        <UiButton
          variant="solid"
          @click="completeDialog"
          >完成</UiButton
        >
      </div></UiDialog
    >
  </main>
</template>
