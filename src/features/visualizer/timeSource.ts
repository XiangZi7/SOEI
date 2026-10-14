/**
 * 上游用 framer-motion 的 `MotionValue<number>` 承载连续播放时间：它是订阅式的，
 * 读写都不触发 React 渲染。Vue 侧不需要 framer-motion，但**必须保持 `.get()` 的调用形态**——
 * 移植过来的 Pixi runtime 里有成千处 `currentTime.get()`，换成 `.value` 就得逐处改写。
 *
 * 所以这里是一个刻意**非响应式**的最小容器。它不是 ref：绘制循环每帧都要读写它，
 * 任何响应式包装都会把帧循环接进依赖追踪，正是上游 runtime guardrail 明确禁止的
 * 「不要每帧写 state/store」。离散变化（当前行、播放状态）才走 Vue 的响应式。
 */
export interface ReadableValue<T> {
  get(): T
  /** 离散重绘通知；暂停时 Seek 不需要启动持续帧循环。 */
  subscribe?(listener: (value: T) => void): () => void
}

export interface MutableValue<T> extends ReadableValue<T> {
  set(value: T): void
}

export function mutableValue<T>(initial: T): MutableValue<T> {
  let current = initial
  const listeners = new Set<(value: T) => void>()
  return {
    get: () => current,
    set(value: T) {
      if (Object.is(value, current)) return
      current = value
      for (const listener of listeners) listener(value)
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/** 只读视图，交给渲染层时用它表明这一侧不该写入。 */
export const readOnlyValue = <T>(
  value: ReadableValue<T>
): ReadableValue<T> => ({
  get: () => value.get(),
  ...(value.subscribe ? { subscribe: value.subscribe.bind(value) } : {}),
})
