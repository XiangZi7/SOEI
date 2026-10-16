<script setup lang="ts">
// Adapted from Folia backgrounds/common/GeometricBackground.tsx (AGPL-3.0);
// see third_party/Folia-NOTICE.md.
import { computed, onBeforeUnmount, reactive, useTemplateRef, watch } from 'vue'
import type { Theme } from '../../../theme/model'
import type { AudioBands } from '../../audioBands'
import type { ReadableValue } from '../../timeSource'
import { createSpringFollower } from '../../easing'
import { useVisualizerFrame } from '../../useVisualizerFrame'
import { AppIcon } from '../../../../components/ui'
import iconCatalog from '../../../../components/ui/icons.json'
import {
  buildGeometricScene,
  geometricClipPath,
  geometricShapeScale,
  type GeometricBandKey,
} from './geometricScene'

const props = defineProps<{
  theme: Theme
  audioPower: ReadableValue<number>
  audioBands: AudioBands
  seed?: string | number
  hideShapes?: boolean
  disableVignette?: boolean
  staticMode?: boolean
  paused?: boolean
  frameRate?: number
}>()

type IconName = keyof typeof iconCatalog
const iconNames = Object.keys(iconCatalog) as IconName[]

/**
 * 上游从 lucide 里按名字取图标，SOEI 只打包了 41 个离线图标。
 * 这里先把主题给的名字与实际能渲染的集合求交，取不到的名字直接退回几何形状 ——
 * 和上游 `IconComponent` 解析失败时的处理一致。
 */
const availableIcons = computed(() =>
  (props.theme.lyricsIcons ?? []).filter((name): name is IconName =>
    (iconNames as string[]).includes(name)
  )
)

const scene = computed(() =>
  buildGeometricScene(props.seed, availableIcons.value)
)

const host = useTemplateRef<HTMLElement>('host')
// 六个频段各一条跟随链。上游用 useSpring(stiffness 300, damping 30)，
// ζ≈0.87 略欠阻尼，所以鼓点会让形状轻微过冲 —— 这个回弹是观感的一部分。
const followers = {
  bass: createSpringFollower(300, 30),
  lowMid: createSpringFollower(300, 30),
  mid: createSpringFollower(300, 30),
  vocal: createSpringFollower(300, 30),
  treble: createSpringFollower(300, 30),
  power: createSpringFollower(300, 30),
} satisfies Record<GeometricBandKey, ReturnType<typeof createSpringFollower>>

const state = reactive({ frozen: false })
let previousStamp: number | null = null

function readBand(key: GeometricBandKey): number {
  if (props.paused || props.staticMode) return 0
  if (key === 'power') return props.audioPower.get()
  return props.audioBands[key].get()
}

/**
 * 缩放通过 CSS 变量下发：35 个元素的位移/旋转全部交给 CSS 动画，
 * 这条帧循环只写六个变量，不碰任何单独的元素样式。
 */
function paint() {
  const element = host.value
  if (!element) return
  const now = performance.now()
  const delta =
    previousStamp === null ? 1 / 60 : Math.min((now - previousStamp) / 1000, 0.25)
  previousStamp = now
  for (const key of Object.keys(followers) as GeometricBandKey[]) {
    const value = followers[key].step(readBand(key), delta)
    element.style.setProperty(
      `--geo-scale-${key}`,
      geometricShapeScale(value).toFixed(4)
    )
  }
}

function snapAll() {
  previousStamp = null
  for (const key of Object.keys(followers) as GeometricBandKey[]) {
    followers[key].snap(readBand(key))
    host.value?.style.setProperty(
      `--geo-scale-${key}`,
      geometricShapeScale(followers[key].get()).toFixed(4)
    )
  }
}

useVisualizerFrame({
  running: () => !props.paused && !props.staticMode && Boolean(host.value),
  frameRate: () => props.frameRate ?? 30,
  paint,
})

watch(
  [host, () => props.staticMode, () => props.paused],
  () => {
    // 暂停与静态模式下形状停在当前位置；CSS 动画整体 paused，不需要帧循环。
    state.frozen = Boolean(props.paused || props.staticMode)
    snapAll()
  },
  { immediate: true, flush: 'post' }
)
onBeforeUnmount(() => {
  previousStamp = null
})
</script>

<template>
  <div
    ref="host"
    class="geometric-layer"
    :class="{ 'is-frozen': state.frozen }"
    aria-hidden="true"
  >
    <template v-if="!hideShapes">
      <div
        v-for="shape in scene.shapes"
        :key="shape.id"
        class="geo-shape"
        :class="[`geo-shape--${shape.type}`, { 'is-reverse': shape.reverse }]"
        :style="{
          left: `${shape.x}%`,
          top: `${shape.y}%`,
          width: `${shape.size}px`,
          height: `${shape.size}px`,
          opacity: shape.opacity,
          color: theme.secondaryColor,
          border:
            (shape.type === 'circle' || shape.type === 'square') && !shape.filled
              ? `1px solid ${theme.secondaryColor}`
              : 'none',
          backgroundColor:
            shape.type === 'icon' ||
            ((shape.type === 'circle' || shape.type === 'square') &&
              !shape.filled)
              ? 'transparent'
              : theme.secondaryColor,
          borderRadius: shape.type === 'circle' ? '50%' : '0',
          clipPath: geometricClipPath(shape.type),
          '--geo-duration': `${shape.durationSec}s`,
          '--geo-delay': `${shape.delaySec}s`,
          '--geo-rotation': `${shape.rotation}deg`,
          '--geo-opacity': shape.opacity,
          '--geo-scale': `var(--geo-scale-${shape.band}, 1)`,
        }"
      >
        <AppIcon
          v-if="shape.type === 'icon' && shape.iconName"
          :name="shape.iconName as IconName"
          :size="shape.size"
        />
      </div>
      <div
        v-for="particle in scene.particles"
        :key="`p-${particle.id}`"
        class="geo-particle"
        :style="{
          left: `${particle.x}%`,
          top: `${particle.y}%`,
          width: `${particle.size}px`,
          height: `${particle.size}px`,
          backgroundColor: theme.accentColor,
          '--geo-duration': `${particle.durationSec}s`,
          '--geo-delay': `${particle.delaySec}s`,
          '--geo-opacity': particle.opacity,
        }"
      />
    </template>
    <div
      v-if="!disableVignette"
      class="geo-vignette"
    />
  </div>
</template>

<style scoped>
.geometric-layer {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  animation: geo-fade-in 600ms ease-in-out both;
}
/*
 * 位移与旋转全部走 CSS 动画：35 个元素若每帧由 JS 写 transform，
 * 光是样式重算就吃掉一帧的预算。音频缩放通过 --geo-scale-* 变量进来，
 * 由合成器与关键帧相乘，JS 每帧只写六个变量。
 */
.geo-shape,
.geo-particle {
  position: absolute;
  will-change: transform, opacity;
}
.geo-shape {
  display: grid;
  place-items: center;
  animation: geo-drift var(--geo-duration) linear var(--geo-delay) infinite;
}
.geo-shape.is-reverse {
  animation-name: geo-drift-reverse;
}
/* 图标额外叠一条独立时长的呼吸，与上游 opacity 轨道的 duration*0.5 对应。 */
.geo-shape--icon {
  animation:
    geo-drift var(--geo-duration) linear var(--geo-delay) infinite,
    geo-breathe calc(var(--geo-duration) * 0.5) ease-in-out var(--geo-delay)
      infinite;
}
.geo-shape--icon.is-reverse {
  animation-name: geo-drift-reverse, geo-breathe;
}
.geo-particle {
  border-radius: 50%;
  animation: geo-rise var(--geo-duration) linear var(--geo-delay) infinite;
}
.geo-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle, transparent 40%, rgb(0 0 0 / 0.6) 100%);
  pointer-events: none;
}
/* 暂停与静态模式：动画停在当前位置，而不是重置回起点。 */
.geometric-layer.is-frozen .geo-shape,
.geometric-layer.is-frozen .geo-particle {
  animation-play-state: paused;
}

@keyframes geo-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes geo-drift {
  0% {
    transform: translate(-15px, 30px) rotate(var(--geo-rotation))
      scale(var(--geo-scale));
  }
  50% {
    transform: translate(15px, -30px)
      rotate(calc(var(--geo-rotation) + 180deg)) scale(var(--geo-scale));
  }
  100% {
    transform: translate(-15px, 30px)
      rotate(calc(var(--geo-rotation) + 360deg)) scale(var(--geo-scale));
  }
}
@keyframes geo-drift-reverse {
  0% {
    transform: translate(15px, -30px) rotate(var(--geo-rotation))
      scale(var(--geo-scale));
  }
  50% {
    transform: translate(-15px, 30px)
      rotate(calc(var(--geo-rotation) + 180deg)) scale(var(--geo-scale));
  }
  100% {
    transform: translate(15px, -30px)
      rotate(calc(var(--geo-rotation) + 360deg)) scale(var(--geo-scale));
  }
}
@keyframes geo-breathe {
  0%,
  100% {
    opacity: 0;
  }
  50% {
    /* 上游峰值是基础透明度的三倍。 */
    opacity: calc(var(--geo-opacity) * 3);
  }
}
@keyframes geo-rise {
  0% {
    transform: translateY(0);
    opacity: 0;
  }
  50% {
    opacity: var(--geo-opacity);
  }
  100% {
    transform: translateY(-100px);
    opacity: 0;
  }
}
</style>
