import { onBeforeUnmount, onMounted, watch, type Ref } from 'vue'
import {
  useDocumentVisibility,
  useElementVisibility,
  useResizeObserver,
} from '@vueuse/core'
import type { Preferences, SceneLayout } from '../../types/music'

interface StageOptions {
  color: string
  animated: boolean
  reducedMotion: boolean
  quality: Preferences['quality']
  energy: number
  layout: SceneLayout
  variant: number
}

// Three.js 按需加载；暂停、页面隐藏和画面离屏时停止渲染。
export function useStageRenderer(
  canvas: Ref<HTMLCanvasElement | null>,
  options: () => StageOptions
) {
  const visibility = useDocumentVisibility()
  const inView = useElementVisibility(canvas, { initialValue: true })
  let dispose: (() => void) | undefined
  let update: (() => void) | undefined
  let destroyed = false
  onMounted(async () => {
    const three = await import('./stageEngine')
    if (destroyed || !canvas.value) return
    const element = canvas.value
    let renderer: InstanceType<typeof three.WebGLRenderer>
    try {
      renderer = new three.WebGLRenderer({
        canvas: element,
        alpha: true,
        antialias: false,
        powerPreference: 'low-power',
      })
    } catch {
      // CSS 光场始终位于画布下方，不支持 WebGL 时仍可正常展示。
      return
    }
    const scene = new three.Scene()
    const camera = new three.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const geometry = new three.PlaneGeometry(2, 2)
    const uniforms = {
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uEnergy: { value: 0 },
      uColor: { value: new three.Color(options().color) },
      uVariant: { value: options().variant },
      uMood: { value: 0 },
    }
    const material = new three.ShaderMaterial({
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        uniform float uAspect;
        uniform float uEnergy;
        uniform vec3 uColor;
        uniform float uVariant;
        uniform float uMood;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
          vec2 p = vUv;
          float t = uTime * .12;
          vec2 center = vec2(.48 + sin(t + uVariant) * .18, .52 + cos(t * .7 + uVariant * .5) * .14);
          vec2 d = (p - center) * vec2(uAspect * .7, 1.);
          float glow = exp(-dot(d, d) * 4.5);
          float ribbon = exp(-pow((p.y - .48 - sin(p.x * 4. + t) * .15) * 12., 2.));
          vec3 color = uColor * (glow * .18 + ribbon * .035) * (1. + uEnergy * .3);
          float halo = exp(-pow((length(d) - .3 - uEnergy * .025) * 24., 2.));
          color += uColor * halo * uMood * .06;
          vec2 starUv = p * vec2(45. * uAspect, 45.);
          vec2 cell = floor(starUv);
          float seed = hash(cell);
          vec2 point = fract(starUv) - vec2(hash(cell + 1.), hash(cell + 2.));
          float star = (1. - smoothstep(.012, .06, length(point))) * step(.978, seed);
          color += vec3(.54, .64, .78) * star * (.2 + .1 * sin(t * 3. + seed * 60.));
          gl_FragColor = vec4(color, .85);
        }
      `,
    })
    scene.add(new three.Mesh(geometry, material))
    let lastFrame = 0
    let previousTime = 0
    let running = false
    let contextLost = false
    const render = () => {
      if (!contextLost) renderer.render(scene, camera)
    }
    const frame = (time: number) => {
      const interval = options().quality === 'high' ? 1000 / 60 : 1000 / 30
      if (time - lastFrame < interval) return
      uniforms.uTime.value += previousTime
        ? Math.min((time - previousTime) / 1000, 0.1)
        : 0
      previousTime = time
      lastFrame = time
      uniforms.uEnergy.value = options().energy
      render()
    }
    const sync = () => {
      const current = options()
      uniforms.uColor.value.set(current.color)
      uniforms.uEnergy.value = current.energy
      uniforms.uVariant.value = current.variant
      uniforms.uMood.value = current.layout === 'echo' ? 1 : 0
      const animate =
        current.animated &&
        !current.reducedMotion &&
        current.quality !== 'power' &&
        visibility.value === 'visible' &&
        inView.value &&
        !contextLost
      if (animate !== running) {
        running = animate
        previousTime = 0
        renderer.setAnimationLoop(animate ? frame : null)
      }
      if (!running && inView.value && visibility.value === 'visible') render()
    }
    const resize = () => {
      const width = element.clientWidth
      const height = element.clientHeight
      if (!width || !height) return
      renderer.setPixelRatio(
        Math.min(
          window.devicePixelRatio,
          options().quality === 'high' ? 1.5 : 1
        )
      )
      renderer.setSize(width, height, false)
      uniforms.uAspect.value = width / height
      sync()
    }
    const lost = (event: Event) => {
      event.preventDefault()
      contextLost = true
      sync()
    }
    const restored = () => {
      contextLost = false
      resize()
    }
    element.addEventListener('webglcontextlost', lost)
    element.addEventListener('webglcontextrestored', restored)
    update = resize
    dispose = () => {
      renderer.setAnimationLoop(null)
      element.removeEventListener('webglcontextlost', lost)
      element.removeEventListener('webglcontextrestored', restored)
      geometry.dispose()
      material.dispose()
      renderer.dispose()
    }
    resize()
  })
  // 能量只在渲染帧读取，避免音频更新触发尺寸或调度操作。
  watch(
    () => {
      const value = options()
      return [
        value.color,
        value.layout,
        value.variant,
        value.animated,
        value.reducedMotion,
        value.quality,
        visibility.value,
        inView.value,
      ]
    },
    () => update?.()
  )
  useResizeObserver(canvas, () => update?.())
  onBeforeUnmount(() => {
    destroyed = true
    dispose?.()
  })
}
