import { computed, reactive, watch } from 'vue'
import { defineStore } from 'pinia'
import type { Track } from '../types/music'
import {
  applyThemeVariables,
  extractCoverColors,
  FALLBACK_DUAL_THEME,
  generateDualTheme,
  seededRandom,
  type DualTheme,
  type ThemeMode,
} from '../features/theme'

// 封面取色主题。每首歌按 id 做种子，所以同一首歌每次进入都是同一套配色；
// 取色结果按曲目缓存，换回已听过的歌不再重新解码封面。
const CACHE_LIMIT = 120

export const useThemeStore = defineStore('theme', () => {
  const state = reactive({
    // 当前生效的亮/暗主题对
    dual: FALLBACK_DUAL_THEME as DualTheme,
    // SOEI 目前是暗色界面；保留亮色侧供未来切换与 visualizer 的 isDaylight 使用
    mode: 'dark' as ThemeMode,
    // 已应用主题的曲目 id，空串代表兜底主题
    trackId: '',
  })
  const cache = new Map<string, DualTheme>()
  // 最后一次请求的曲目 id。取色是异步的，期间可能已经换歌，
  // 过期结果只进缓存、不写状态，否则会闪回上一首的配色。
  let requestedId = ''

  const theme = computed(() => state.dual[state.mode])
  const isDaylight = computed(() => state.mode === 'light')

  function remember(id: string, dual: DualTheme) {
    cache.set(id, dual)
    // Map 保持插入顺序，最早的键就是最久未用的。
    if (cache.size > CACHE_LIMIT) {
      const oldest = cache.keys().next().value
      if (oldest !== undefined) cache.delete(oldest)
    }
  }

  function applyDual(id: string, dual: DualTheme) {
    state.trackId = id
    state.dual = dual
  }

  /** 为曲目解析并应用主题。取色失败时按 id 种子生成，配色仍然稳定。 */
  async function resolve(track: Track | null) {
    requestedId = track?.id ?? ''
    if (!track) {
      applyDual('', FALLBACK_DUAL_THEME)
      return
    }
    const cached = cache.get(track.id)
    if (cached) {
      applyDual(track.id, cached)
      return
    }
    const coverColors = await extractCoverColors(track)
    const dual = generateDualTheme({
      coverColors,
      random: seededRandom(track.id),
    })
    remember(track.id, dual)
    if (requestedId === track.id) applyDual(track.id, dual)
  }

  function setMode(mode: ThemeMode) {
    state.mode = mode
  }

  watch(
    theme,
    current => {
      if (typeof document !== 'undefined')
        applyThemeVariables(document.documentElement, current)
    },
    { immediate: true }
  )

  return { state, theme, isDaylight, resolve, setMode }
})
