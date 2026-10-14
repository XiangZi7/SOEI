// Adapted from Folia VisualizerSubtitleOverlay.tsx (AGPL-3.0).
import type { Line, SubtitleContentMode } from '../lyrics/folia/model'
import {
  resolveLyricSubtitleTracks,
  resolveSubtitleContentMode,
} from '../lyrics/folia/alternateText'

const hasReadableText = (text: string) => /[\p{L}\p{N}]/u.test(text)

export function resolveVisualizerSubtitleOverlayContent(input: {
  showText: boolean
  activeLine: Line | null
  recentCompletedLine: Line | null
  nextLines: Line[]
  hideTranslationSubtitle?: boolean
  showSubtitleTranslation?: boolean
  subtitleContentMode?: SubtitleContentMode
}) {
  const { activeLine, recentCompletedLine, nextLines } = input
  const mode = resolveSubtitleContentMode(
    input.subtitleContentMode,
    input.showSubtitleTranslation
  )
  const hidden = !input.showText || input.hideTranslationSubtitle
  const subtitleTracks = hidden
    ? []
    : ([activeLine, recentCompletedLine]
        .map(line => resolveLyricSubtitleTracks(line, mode, hasReadableText))
        .find(tracks => tracks.length > 0) ?? [])
  return {
    shouldRenderOverlay: !hidden,
    subtitleTracks,
    upcomingLines:
      hidden || subtitleTracks.length || !activeLine
        ? []
        : nextLines.filter(line => hasReadableText(line.fullText)),
  }
}
