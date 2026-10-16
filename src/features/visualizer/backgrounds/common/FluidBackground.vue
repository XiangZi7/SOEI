<script setup lang="ts">
// Adapted from Folia backgrounds/common/FluidBackground.tsx (AGPL-3.0);
// see third_party/Folia-NOTICE.md.
import { reactive, watch } from 'vue'
import type { Theme } from '../../../theme/model'
import { buildDownscaledCover } from './coverBlurSource'

const props = defineProps<{
  coverUrl?: string | null
  theme: Theme
}>()

interface CoverLayer {
  /** 实际贴图的 URL（通常是降采样后的 data URL）。 */
  url: string
  /** 产生它的原始封面 URL，用来判断是否已经是最新一张。 */
  source: string
  key: number
  /** 解码完成并空跑一帧之后才淡入。 */
  ready: boolean
}

const state = reactive({ layers: [] as CoverLayer[] })
let nextKey = 0

/*
 * 换歌时交叉淡入封面，而不是直接换 <img src>：旧封面淡出的同时新封面淡入
 * （切换过程中两张都挂着）。
 *
 * 透明度动画加在**外层 div** 上而不是那张模糊的 <img> 上 ——
 * 直接对 blur(40px) 的图层做透明度动画会让浏览器每帧重新栅格化那层模糊并产生瓦片闪烁。
 * 分开之后模糊只在静止的 img 上栅格化一次，淡入淡出只动廉价的合成层。
 */
watch(
  () => props.coverUrl,
  (coverUrl, _previous, onCleanup) => {
    if (!coverUrl) {
      state.layers = []
      return
    }
    let cancelled = false
    onCleanup(() => {
      cancelled = true
    })
    void buildDownscaledCover(coverUrl).then(smallUrl => {
      if (cancelled) return
      const top = state.layers[state.layers.length - 1]
      if (top?.source === coverUrl) return
      nextKey += 1
      // 只保留当前顶层（给它淡出）加上新来的这张。
      state.layers = [
        ...(top ? [top] : []),
        {
          url: smallUrl ?? coverUrl,
          source: coverUrl,
          key: nextKey,
          ready: false,
        },
      ]
    })
  },
  { immediate: true }
)

/**
 * 解码真实的 img 元素，再空跑一帧让它在仍然透明时完成合成，
 * 之后才淡入一张已经画好的图。解码失败也照常显示，不能卡住。
 */
function gateReveal(element: Element | null, layer: CoverLayer) {
  if (!(element instanceof HTMLImageElement) || layer.ready) return
  const reveal = () => {
    const live = state.layers.find(item => item.key === layer.key)
    if (live) live.ready = true
  }
  element
    .decode()
    .then(() => requestAnimationFrame(reveal))
    .catch(reveal)
}

/** 新封面完全淡入之后，丢掉它下面的图层。 */
function pruneBelow(layer: CoverLayer) {
  if (state.layers[state.layers.length - 1]?.key !== layer.key) return
  if (!layer.ready) return
  state.layers = state.layers.filter(item => item.key === layer.key)
}

/**
 * 加载途中被 revoke 的 object URL 会留下一张永远不出现的图层。
 * 让它干净地退场，但永远不丢掉最后一张 —— 否则背景会整个消失。
 */
function dropBroken(layer: CoverLayer) {
  if (state.layers.length <= 1) return
  state.layers = state.layers.filter(item => item.key !== layer.key)
}
</script>

<template>
  <div
    class="fluid-layer"
    aria-hidden="true"
  >
    <template v-if="coverUrl">
      <div
        v-for="layer in state.layers"
        :key="layer.key"
        class="fluid-cover-wrapper"
        :class="{
          'is-visible':
            layer.ready ||
            layer.key !== state.layers[state.layers.length - 1]?.key,
        }"
        @transitionend="pruneBelow(layer)"
      >
        <img
          :ref="element => gateReveal(element as Element | null, layer)"
          :src="layer.url"
          alt=""
          draggable="false"
          decoding="async"
          class="fluid-cover"
          @error="dropBroken(layer)"
        />
      </div>
    </template>
    <div
      v-else
      class="fluid-fallback"
      :style="{ backgroundColor: theme.backgroundColor }"
    />
    <!-- 让文字更可读、同时把封面与主题色揉在一起的叠加渐变。 -->
    <div
      class="fluid-tint"
      :style="{
        background: `linear-gradient(to bottom right, ${theme.primaryColor}, transparent, ${theme.secondaryColor})`,
      }"
    />
  </div>
</template>

<style scoped>
.fluid-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  /* contain: paint + 自成一层，避免模糊溢出到兄弟层上。 */
  isolation: isolate;
  contain: paint;
  transform: translateZ(0);
  pointer-events: none;
}
.fluid-cover-wrapper {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 1.5s ease-in-out;
  will-change: opacity;
}
.fluid-cover-wrapper.is-visible {
  opacity: 1;
}
.fluid-cover {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* 模糊只在这里栅格化一次；淡入淡出由上面的 wrapper 承担。 */
  filter: blur(40px);
  transform: scale(1.5) translateZ(0);
  backface-visibility: hidden;
}
.fluid-fallback {
  position: absolute;
  inset: 0;
  opacity: 0.8;
  transition: background-color 1s;
}
.fluid-tint {
  position: absolute;
  inset: 0;
  opacity: 0.4;
  mix-blend-mode: overlay;
}
</style>
