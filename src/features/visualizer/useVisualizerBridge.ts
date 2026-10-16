import { computed, watch, type ComputedRef } from 'vue'
import type { LyricLine, Track } from '../../types/music'
import type { Theme } from '../theme/model'
import { assetUrl } from '../../bridge/native'
import { toFoliaLine } from '../lyrics/adapter'
import type { Line } from '../lyrics/folia/model'
import { createAudioSource } from './audioBands'
import type { VisualizerSharedProps } from './definition'
import { mutableValue } from './timeSource'

/**
 * 把 SOEI 的响应式播放状态桥接成上游 visualizer 的共享契约。
 *
 * 两条边界在这里收口：
 *
 * 1. **单位**。上游 `Line` 与 `currentTime` 内部用秒，SOEI 的公开模型、播放状态和偏移都用毫秒。
 *    整首歌词的转换挂在 computed 上，只在歌词变化时跑一次 —— 绝不每帧转换整首
 *    （见 docs/LYRICS_ENGINE.md 的时间模型约定）。
 *
 * 2. **响应式**。`currentTime` 与音频槽位是刻意**非响应式**的容器：帧循环每帧都读它们，
 *    接进依赖追踪就违反了上游 runtime guardrail「不要每帧写 state/store」。
 *    这里用 watcher 把响应式的值写进去，容器实例本身保持稳定，
 *    所以 Pixi runtime 始终读的是同一个对象。
 */
export interface VisualizerBridgeInput {
  /** 已经叠加过全局与单曲偏移的歌词时间（毫秒）。 */
  positionMs: number
  /** SOEI 毫秒模型的歌词行。 */
  lines: LyricLine[]
  /** 当前行下标；-1 表示间隙。 */
  index: number
  /** 整首时长（毫秒），用于补最后一行的结束时间。 */
  durationMs?: number
  theme: Theme
  isDaylight?: boolean
  /** snapshot.energy，槽位见 src-tauri/src/audio.rs 的 ENERGY_SLOTS。 */
  energy?: number[]
  track: Track | null
  coverUrl?: string | null
  seed?: string | number
  paused?: boolean
  staticMode?: boolean
  isPreviewMode?: boolean
  lyricsFontScale?: number
  visualizerOpacity?: number
  frameRate?: number
  tunings?: Record<string, unknown>
}

/** 兜底的行时长：与 LyricStage.vue 的 lineEndMs 保持同一套规则。 */
const FALLBACK_LINE_MS = 4000

export function useVisualizerBridge(
  input: () => VisualizerBridgeInput,
  onLyricLineSeek?: (lyricTimeSec: number) => void
): { shared: ComputedRef<VisualizerSharedProps> } {
  // 稳定实例：整个生命周期内不重建，渲染层一直读同一个对象。
  const currentTime = mutableValue(0)
  const audio = createAudioSource()

  // 宿主 getter 会同时读取位置、主题等字段。先隔离真正决定转换的两个输入，
  // computed 的值相等检查才能挡住播放时每帧创建的新快照对象。
  const sourceLines = computed(() => input().lines)
  const sourceDuration = computed(() => input().durationMs)
  const foliaLines = computed<Line[]>(() => {
    const lines = sourceLines.value
    const durationMs = sourceDuration.value
    return lines.map((line, index) => {
      // 行结束时间优先取自身，其次下一行的开始，再其次整首时长，最后给固定兜底。
      const next = lines[index + 1]?.startMs
      const fallback =
        next ??
        (durationMs && durationMs > line.startMs
          ? durationMs
          : line.startMs + FALLBACK_LINE_MS)
      return toFoliaLine(line, fallback)
    })
  })

  watch(
    () => input().positionMs,
    positionMs => currentTime.set(positionMs / 1000),
    { immediate: true }
  )
  watch(
    () => input().energy,
    energy => audio.apply(energy),
    { immediate: true, deep: true }
  )

  const shared = computed<VisualizerSharedProps>(() => {
    const current = input()
    return {
      currentTime,
      currentLineIndex: current.index,
      lines: foliaLines.value,
      theme: current.theme,
      isDaylight: current.isDaylight,
      audioPower: audio.power,
      audioBands: audio.bands,
      showText: true,
      songTitle: current.track?.title ?? null,
      songArtist: current.track?.artist ?? null,
      songAlbum: current.track?.album ?? null,
      coverUrl:
        current.coverUrl ||
        current.track?.coverRef ||
        current.track?.artwork?.source
          ? assetUrl(
              current.coverUrl ||
                current.track?.coverRef ||
                current.track?.artwork?.source ||
                ''
            )
          : null,
      seed: current.seed,
      staticMode: current.staticMode,
      paused: current.paused,
      isPreviewMode: current.isPreviewMode,
      lyricsFontScale: current.lyricsFontScale,
      visualizerOpacity: current.visualizerOpacity,
      frameRate: current.frameRate,
      tunings: current.tunings,
      onLyricLineSeek,
    }
  })

  return { shared }
}
