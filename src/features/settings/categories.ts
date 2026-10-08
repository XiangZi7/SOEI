const categories = new Set([
  'general',
  'playback',
  'lyrics',
  'visual',
  'performance',
  'shortcuts',
  'about',
])

export function settingsCategory(value?: string | null): string {
  return value && categories.has(value) ? value : 'general'
}
