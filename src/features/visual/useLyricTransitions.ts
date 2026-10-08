import { onBeforeUnmount, watch } from 'vue'
import { gsap } from 'gsap'

interface MotionOptions {
  animated: boolean
  reducedMotion: boolean
  durationMs: number
}

// 外层只承担构图角度，内层字素承担动画；GSAP 不改写外层 rotate。
export function useLyricTransitions(options: () => MotionOptions) {
  const animations = new Map<
    Element,
    { timeline: gsap.core.Timeline; leaving: boolean; revealedAt: number }
  >()
  function cancel(element: Element) {
    animations.get(element)?.timeline.kill()
    animations.delete(element)
  }
  function enter(element: Element, done: () => void) {
    cancel(element)
    if (options().reducedMotion || !options().animated) {
      done()
      return
    }
    const duration = Math.max(0.25, Math.min(0.7, options().durationMs / 4500))
    const fragments = [
      ...element.querySelectorAll<HTMLElement>('.lyric-fragment'),
    ]
    const basic = element.querySelectorAll('.reading-line, .cover-composition')
    const glyphs = element.querySelectorAll('.lyric-glyph')
    const camera = element.querySelector('.shot-camera')
    const ink = element.querySelectorAll('.lyric-ink')
    const targets = [...glyphs, ...basic, ...(camera ? [camera] : [])]
    const timeline = gsap.timeline({
      onComplete: () => {
        gsap.set(targets, { clearProps: 'opacity,transform' })
        animations.delete(element)
      },
    })
    const stagger = Math.min(
      0.028,
      Math.max(
        0.004,
        ((options().durationMs / 1000) * 0.2) / Math.max(1, glyphs.length)
      )
    )
    fragments.forEach((fragment, index) => {
      timeline.fromTo(
        fragment.querySelectorAll('.lyric-glyph'),
        {
          opacity: 0,
          x: Number(fragment.dataset.enterX),
          y: Number(fragment.dataset.enterY),
        },
        { opacity: 1, x: 0, y: 0, duration, stagger, ease: 'power3.out' },
        index * Math.min(0.12, stagger * 4)
      )
    })
    if (basic.length)
      timeline.fromTo(
        basic,
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration, stagger: 0.06, ease: 'power3.out' },
        0
      )
    if (ink.length)
      timeline.fromTo(
        ink,
        { strokeDasharray: 100, strokeDashoffset: 100 },
        { strokeDashoffset: 0, duration: duration * 1.4, ease: 'power2.out' },
        duration * 0.5
      )
    const revealedAt = timeline.duration()
    timeline.call(done, [], revealedAt)
    if (camera)
      timeline.fromTo(
        camera,
        { y: 7, scale: 1.018 },
        {
          y: 0,
          scale: 1,
          duration: Math.max(
            revealedAt,
            Math.min(8, options().durationMs / 1000)
          ),
          ease: 'none',
        },
        0
      )
    animations.set(element, { timeline, leaving: false, revealedAt })
  }
  function leave(element: Element, done: () => void) {
    cancel(element)
    if (options().reducedMotion || !options().animated) {
      done()
      return
    }
    const timeline = gsap.timeline({
      onComplete: () => {
        animations.delete(element)
        done()
      },
    })
    timeline.to(element, {
      opacity: 0,
      y: -18,
      duration: 0.24,
      ease: 'power2.in',
    })
    animations.set(element, { timeline, leaving: true, revealedAt: 0 })
  }
  watch(
    () => options().animated,
    playing => {
      for (const { timeline, leaving, revealedAt } of [
        ...animations.values(),
      ]) {
        if (playing) timeline.resume()
        else if (leaving) timeline.progress(1)
        // 暂停时文字立即落位可读，仅冻结缓移镜头。
        else timeline.time(Math.max(timeline.time(), revealedAt)).pause()
      }
    }
  )
  watch(
    () => options().reducedMotion,
    reduced => {
      if (reduced)
        for (const { timeline } of [...animations.values()])
          timeline.progress(1)
    }
  )
  onBeforeUnmount(() => {
    for (const { timeline } of animations.values()) timeline.kill()
    animations.clear()
  })
  return { enter, leave, cancel }
}
