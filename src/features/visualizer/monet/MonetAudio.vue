<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import type { VisualizerSharedProps } from '../definition'
import { useVisualizerFrame } from '../useVisualizerFrame'
import { sampleSpectrumProfile, sampleRawSpectrumProfile } from './monetAudio'
import { colorWithAlpha } from '../../theme/colorMath'
const props = defineProps<VisualizerSharedProps & { mode: 'bar' | 'line' }>()
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
function paint() {
  const element = canvas.value, context = element?.getContext('2d')
  if (!element || !context) return
  const ratio = Math.min(devicePixelRatio || 1, 1.5), width = element.clientWidth, height = element.clientHeight
  if (element.width !== Math.round(width * ratio) || element.height !== Math.round(height * ratio)) { element.width = Math.round(width * ratio); element.height = Math.round(height * ratio) }
  context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0,0,width,height)
  const bands = [props.audioBands.bass.get(), props.audioBands.lowMid.get(), props.audioBands.mid.get(), props.audioBands.vocal.get(), props.audioBands.treble.get()]
  const spectrum = props.audioBands.spectrum?.get()
  const values = Array.from({ length: 72 }, (_, index) => props.paused || props.staticMode ? 0 : spectrum ? sampleRawSpectrumProfile(spectrum, index / 71) : sampleSpectrumProfile(bands, index / 71))
  context.fillStyle = colorWithAlpha(props.theme.accentColor, 0.55); context.strokeStyle = colorWithAlpha(props.theme.primaryColor, 0.65); context.lineWidth = 1.5
  if (props.mode === 'line') { context.beginPath(); values.forEach((value, index) => { const x = index / 71 * width, y = height - 2 - value * (height - 4); if (index === 0) context.moveTo(x,y); else context.lineTo(x,y) }); context.stroke() }
  else values.forEach((value, index) => { const bar = Math.max(1, value * (height - 2)); context.fillRect(index / 72 * width, height - bar, Math.max(1, width / 72 - 3), bar) })
}
useResizeObserver(canvas, paint)
useVisualizerFrame({ source: () => props.audioPower, running: () => !props.paused && !props.staticMode, frameRate: () => props.frameRate ?? 30, paint })
</script>
<template><canvas ref="canvas" class="pointer-events-none block h-12 w-full" aria-hidden="true" /></template>
