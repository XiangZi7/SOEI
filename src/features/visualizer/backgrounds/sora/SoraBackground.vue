<script setup lang="ts">
// Folia's GL_POINTS shaders, hosted without twgl or a second animation clock.
import {
  computed,
  onBeforeUnmount,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue'
import { useEventListener, useResizeObserver } from '@vueuse/core'
import type { VisualizerBackgroundProps } from '../definition'
import { resolveBackgroundTuning } from '../tuning'
import { parseColorChannels } from '../../../theme/colorMath'
import { useVisualizerFrame } from '../../useVisualizerFrame'
import { VERTEX_SHADER, FRAGMENT_SHADER } from './shaders'
const props = defineProps<VisualizerBackgroundProps>()
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const available = shallowRef(false)
const tuning = computed(() =>
  resolveBackgroundTuning('sora', props.tunings?.sora)
)
let gl: WebGLRenderingContext | null = null
let program: WebGLProgram | null = null
let buffer: WebGLBuffer | null = null
let elapsed = 0
let previous: number | null = null
const shaders: WebGLShader[] = []
function dispose() {
  available.value = false
  if (gl) {
    if (program) gl.deleteProgram(program)
    if (buffer) gl.deleteBuffer(buffer)
    shaders.splice(0).forEach(shader => gl?.deleteShader(shader))
  }
  program = null
  buffer = null
}
function initialize() {
  dispose()
  gl =
    canvas.value?.getContext('webgl', {
      alpha: false,
      depth: false,
      antialias: false,
    }) ?? null
  if (!gl) return
  try {
    program = gl.createProgram()
    if (!program) throw Error('WebGL program unavailable')
    for (const [type, source] of [
      [gl.VERTEX_SHADER, VERTEX_SHADER],
      [gl.FRAGMENT_SHADER, FRAGMENT_SHADER],
    ] as const) {
      const shader = gl.createShader(type)
      if (!shader) throw Error('WebGL shader unavailable')
      shaders.push(shader)
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw Error('Starfield shader compilation failed')
      gl.attachShader(program, shader)
    }
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw Error('Starfield link failed')
    gl.useProgram(program)
    buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      Float32Array.from({ length: 150 }, (_, index) => index),
      gl.STATIC_DRAW
    )
    const location = gl.getAttribLocation(program, 'a_index')
    gl.enableVertexAttribArray(location)
    gl.vertexAttribPointer(location, 1, gl.FLOAT, false, 0, 0)
    available.value = true
    previous = null
    paint()
  } catch {
    dispose()
  }
}
function rgb(color: string) {
  const parsed = parseColorChannels(color) ?? { r: 255, g: 255, b: 255 }
  return [parsed.r / 255, parsed.g / 255, parsed.b / 255]
}
function paint() {
  if (
    !available.value ||
    !gl ||
    !program ||
    !canvas.value ||
    gl.isContextLost()
  )
    return
  const now = performance.now()
  if (
    !props.paused &&
    !props.staticMode &&
    !tuning.value.blank &&
    previous !== null
  )
    elapsed += Math.min((now - previous) / 1000, 0.1)
  previous = now
  const element = canvas.value
  const ratio = Math.min(devicePixelRatio || 1, 1.5)
  const width = Math.max(1, Math.round(element.clientWidth * ratio))
  const height = Math.max(1, Math.round(element.clientHeight * ratio))
  if (element.width !== width || element.height !== height) {
    element.width = width
    element.height = height
  }
  gl.viewport(0, 0, width, height)
  const bg = props.isDaylight ? 1 : 0
  gl.clearColor(bg, bg, bg, 1)
  gl.clear(gl.COLOR_BUFFER_BIT)
  if (tuning.value.blank) return
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  gl.useProgram(program)
  gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), width, height)
  gl.uniform1f(gl.getUniformLocation(program, 'u_time'), elapsed)
  gl.uniform3fv(
    gl.getUniformLocation(program, 'u_particle_color'),
    rgb(props.theme.primaryColor)
  )
  gl.uniform3fv(
    gl.getUniformLocation(program, 'u_particle_accent_color'),
    rgb(props.theme.accentColor)
  )
  gl.drawArrays(gl.POINTS, 0, 150)
}
watch(canvas, initialize, { immediate: true, flush: 'post' })
onBeforeUnmount(dispose)
useEventListener(canvas, 'webglcontextlost', event => {
  event.preventDefault()
  available.value = false
})
useEventListener(canvas, 'webglcontextrestored', initialize)
useResizeObserver(canvas, paint)
watch(
  [() => props.paused, () => props.staticMode, () => props.theme, tuning],
  () => {
    previous = null
    paint()
  },
  { deep: true }
)
useVisualizerFrame({
  source: () => props.audioPower,
  running: () =>
    available.value &&
    !props.paused &&
    !props.staticMode &&
    !tuning.value.blank,
  frameRate: () => props.frameRate ?? 30,
  paint,
})
</script>
<template>
  <div
    class="pointer-events-none absolute inset-0"
    :style="{ backgroundColor: isDaylight ? '#ffffff' : '#000000' }"
  >
    <canvas
      v-if="!tuning.blank"
      ref="canvas"
      class="absolute inset-0 block size-full"
    />
  </div>
</template>
