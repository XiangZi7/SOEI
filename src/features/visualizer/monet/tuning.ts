import { DEFAULT_MONET_TUNING, type MonetTuning } from '../backgrounds/model'
export { DEFAULT_MONET_TUNING }
export function resolveMonetTuning(input?: unknown): MonetTuning {
  const value = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  return {
    ...DEFAULT_MONET_TUNING,
    keywordColoringEnabled: typeof value.keywordColoringEnabled === 'boolean' ? value.keywordColoringEnabled : true,
    showDescription: typeof value.showDescription === 'boolean' ? value.showDescription : true,
    showAudioVisualization: typeof value.showAudioVisualization === 'boolean' ? value.showAudioVisualization : true,
    audioStyle: value.audioStyle === 'line' ? 'line' : 'bar',
    fontScale: typeof value.fontScale === 'number' && Number.isFinite(value.fontScale) ? Math.max(0.6, Math.min(2, value.fontScale)) : 1.2,
    portraitStyle: value.portraitStyle === 'rectangular' ? 'rectangular' : 'square',
    portraitOffsetX: typeof value.portraitOffsetX === 'number' && Number.isFinite(value.portraitOffsetX) ? Math.max(-150, Math.min(0, value.portraitOffsetX)) : 0,
  }
}
