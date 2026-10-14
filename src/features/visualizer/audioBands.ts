import type { ReadableValue } from './timeSource'
import { mutableValue } from './timeSource'

/**
 * 上游 visualizer 消费的音频契约（folia src/types.ts 的 `AudioBands`）。
 * 上游用 framer-motion 的 MotionValue，这里换成同形状的非响应式容器，
 * 所以渲染层照旧 `audioBands.bass.get()`。
 */
export interface AudioBands {
  /** 20-150Hz */
  bass: ReadableValue<number>
  /** 150-400Hz */
  lowMid: ReadableValue<number>
  /** 400-1200Hz */
  mid: ReadableValue<number>
  /** 1000-3500Hz，与 mid 刻意重叠 */
  vocal: ReadableValue<number>
  /** 3500Hz 以上 */
  treble: ReadableValue<number>
  /**
   * 原始 FFT 幅度分箱。上游从 WebAudio 的 AnalyserNode 以帧率取样；
   * SOEI 的原生快照来自 Rust 线程，节流在约 8Hz，用它驱动频谱柱会明显卡顿，
   * 所以这里保持 undefined —— 上游也把它标为可选，只有少数模式需要。
   */
  spectrum?: ReadableValue<Uint8Array>
}

/** 可写的音频源：帧循环只读 `bands`，播放状态更新时调用 `apply`。 */
export interface AudioSource {
  /** 总能量，对应上游的 `audioPower`。 */
  power: ReadableValue<number>
  bands: AudioBands
  /** 用一帧 snapshot.energy 更新全部槽位。 */
  apply(energy: readonly number[] | undefined): void
}

const SLOT_COUNT = 6

const clamp01 = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0

/**
 * 建立音频源。槽位顺序与 src-tauri/src/audio.rs 的 ENERGY_SLOTS 一致：
 * [总能量, bass, lowMid, mid, vocal, treble]。
 *
 * 槽位缺失时按 0 处理而不是猜测：没有真实测量值的频段不应该被编造出来，
 * 否则音频响应的模式会对着假数据起舞。
 */
export function createAudioSource(): AudioSource {
  const slots = Array.from({ length: SLOT_COUNT }, () => mutableValue(0))
  return {
    power: slots[0]!,
    bands: {
      bass: slots[1]!,
      lowMid: slots[2]!,
      mid: slots[3]!,
      vocal: slots[4]!,
      treble: slots[5]!,
    },
    apply(energy) {
      for (let index = 0; index < SLOT_COUNT; index += 1)
        slots[index]!.set(clamp01(energy?.[index] ?? 0))
    },
  }
}
