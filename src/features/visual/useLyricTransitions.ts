import { onScopeDispose, watch } from 'vue'
import type { LyricLine, SceneLayout } from '../../types/music'
import {
  lyricCameraFrame,
  lyricGlyphFrame,
  lyricInkProgress,
  planLyricMotion,
  type LyricMotionPlan,
} from './lyricMotion'

interface MotionOptions {
  animated: boolean
  reducedMotion: boolean
  positionMs: number
  endMs: number
  line: LyricLine
  layout: SceneLayout
  variant: number
  trackId: string
}
interface LyricScene {
  plan: LyricMotionPlan
  trackId: string
  positionMs: number
  glyphs: { element: HTMLElement; direction: { x: number; y: number } }[]
  camera: HTMLElement | null
  ink: SVGElement[]
}

/** 字素、镜头和笔划共享媒体时钟；只有切换 DOM 的短暂淡出使用浏览器动画。 */
export function useLyricTransitions(options: () => MotionOptions) {
  const scenes = new Map<Element, LyricScene>()
  const leaving = new Map<
    Element,
    { animation: Animation; finish: () => void }
  >()

  function cancel(element: Element) {
    scenes.delete(element)
    const exit = leaving.get(element)
    if (exit) {
      exit.animation.onfinish = null
      exit.animation.oncancel = null
      exit.animation.cancel()
    }
    leaving.delete(element)
  }
  function paint(scene: LyricScene) {
    const current = options()
    const time = current.positionMs
    scene.positionMs = time
    for (const [index, { element, direction }] of scene.glyphs.entries()) {
      const frame = lyricGlyphFrame(
        scene.plan,
        index,
        time,
        direction,
        current.reducedMotion
      )
      const opacity = String(frame.opacity)
      const transform = `translate3d(${frame.x}px, ${frame.y}px, 0) scale(${frame.scale})`
      const clip = frame.clip ? `inset(0 ${frame.clip}% 0 0)` : ''
      if (element.style.opacity !== opacity) element.style.opacity = opacity
      if (element.style.transform !== transform)
        element.style.transform = transform
      if (element.style.clipPath !== clip) element.style.clipPath = clip
      if (frame.fill !== undefined) {
        const fill = `${frame.fill * 100}%`
        if (element.style.getPropertyValue('--lyric-fill') !== fill)
          element.style.setProperty('--lyric-fill', fill)
      }
    }
    if (scene.camera) {
      const frame = lyricCameraFrame(scene.plan, time, current.reducedMotion)
      scene.camera.style.transform = `translate3d(${frame.x}px, ${frame.y}px, 0) scale(${frame.scale})`
    }
    const ink = current.reducedMotion ? 1 : lyricInkProgress(scene.plan, time)
    for (const element of scene.ink) {
      element.style.strokeDasharray = '100'
      element.style.strokeDashoffset = String(100 * (1 - ink))
    }
  }

  function enter(element: Element, done: () => void) {
    cancel(element)
    const current = options()
    // DOM 查询、文字映射和分镜编译仅发生在内容变更时，逐帧不重新测量。
    const glyphs = Array.from(
      element.querySelectorAll<HTMLElement>('.lyric-glyph'),
      glyph => {
        const fragment = glyph.closest<HTMLElement>('.lyric-fragment')
        return {
          element: glyph,
          direction: {
            x: Number(fragment?.dataset.enterX) || 0,
            y: Number(fragment?.dataset.enterY) || 0,
          },
        }
      }
    )
    if (!glyphs.length) {
      done()
      return
    }
    const plan = planLyricMotion({
      line: current.line,
      endMs: current.endMs,
      glyphs: glyphs.map(glyph => glyph.element.textContent ?? ''),
      layout: current.layout,
      variant: current.variant,
    })
    if (plan.timings)
      for (const glyph of glyphs) glyph.element.dataset.timed = ''
    const scene: LyricScene = {
      plan,
      trackId: current.trackId,
      positionMs: current.positionMs,
      glyphs,
      camera: element.querySelector<HTMLElement>('.shot-camera'),
      ink: Array.from(element.querySelectorAll<SVGElement>('.lyric-ink')),
    }
    scenes.set(element, scene)
    paint(scene)
    // Vue 只负责节点生命周期，歌词时间轴不依赖 enter 回调何时完成。
    done()
  }

  function leave(element: Element, done: () => void) {
    const scene = scenes.get(element)
    cancel(element)
    // 快速连续切句最多保留一个旧画面，避免动画节点堆积。
    for (const exit of [...leaving.values()]) exit.finish()
    const current = options()
    if (
      !current.animated ||
      current.reducedMotion ||
      !scene ||
      scene.plan.durationMs < 450 ||
      scene.trackId !== current.trackId ||
      Math.abs(current.positionMs - scene.positionMs) > 600 ||
      typeof element.animate !== 'function'
    ) {
      done()
      return
    }
    const animation = element.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: Math.min(180, scene.plan.durationMs * 0.12),
      easing: 'ease-out',
      fill: 'forwards',
    })
    const finish = () => {
      if (!leaving.has(element)) return
      leaving.delete(element)
      animation.onfinish = null
      animation.oncancel = null
      animation.cancel()
      done()
    }
    leaving.set(element, { animation, finish })
    animation.onfinish = finish
    animation.oncancel = () => leaving.delete(element)
  }

  watch(
    () => {
      const current = options()
      return [current.positionMs, current.reducedMotion, current.animated]
    },
    () => {
      for (const scene of scenes.values()) paint(scene)
      if (!options().animated || options().reducedMotion)
        for (const exit of [...leaving.values()]) exit.finish()
    },
    { flush: 'post' }
  )
  onScopeDispose(() => {
    scenes.clear()
    // 销毁时结束 Vue 的 leave 生命周期，避免未调用 done 的旧节点残留。
    for (const exit of [...leaving.values()]) exit.finish()
  })
  return { enter, leave, cancel }
}
