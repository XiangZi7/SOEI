// 加权中位切分（median cut）：让封面上面积大的区域比面积小但高饱和的细节更重要。
// 从 Folia colorPalette.ts 移植，纯函数、可直接单测。
interface WeightedColor {
  r: number
  g: number
  b: number
  weight: number
}

interface ColorBucket {
  colors: WeightedColor[]
  weight: number
}

const QUANTIZATION_SHIFT = 4
const MIN_ALPHA = 128

type Channel = 'r' | 'g' | 'b'

function getChannelRange(colors: WeightedColor[], channel: Channel): number {
  let min = 255
  let max = 0
  for (const color of colors) {
    min = Math.min(min, color[channel])
    max = Math.max(max, color[channel])
  }
  return max - min
}

function splitBucket(bucket: ColorBucket): [ColorBucket, ColorBucket] | null {
  if (bucket.colors.length < 2) return null
  const ranges: Record<Channel, number> = {
    r: getChannelRange(bucket.colors, 'r'),
    g: getChannelRange(bucket.colors, 'g'),
    b: getChannelRange(bucket.colors, 'b'),
  }
  const channel = (Object.keys(ranges) as Channel[]).reduce(
    (widest, candidate) =>
      ranges[candidate] > ranges[widest] ? candidate : widest,
    'r' as Channel
  )
  const sorted = [...bucket.colors].sort((a, b) => a[channel] - b[channel])
  const midpoint = bucket.weight / 2
  let accumulatedWeight = 0
  let splitIndex = 1
  for (let index = 0; index < sorted.length - 1; index += 1) {
    accumulatedWeight += sorted[index].weight
    splitIndex = index + 1
    if (accumulatedWeight >= midpoint) break
  }
  const left = sorted.slice(0, splitIndex)
  const right = sorted.slice(splitIndex)
  const sumWeight = (colors: WeightedColor[]) =>
    colors.reduce((sum, color) => sum + color.weight, 0)
  return [
    { colors: left, weight: sumWeight(left) },
    { colors: right, weight: sumWeight(right) },
  ]
}

function averageBucket(bucket: ColorBucket): WeightedColor {
  const totals = bucket.colors.reduce(
    (result, color) => ({
      r: result.r + color.r * color.weight,
      g: result.g + color.g * color.weight,
      b: result.b + color.b * color.weight,
    }),
    { r: 0, g: 0, b: 0 }
  )
  return {
    r: Math.round(totals.r / bucket.weight),
    g: Math.round(totals.g / bucket.weight),
    b: Math.round(totals.b / bucket.weight),
    weight: bucket.weight,
  }
}

const toHex = ({ r, g, b }: WeightedColor) =>
  `#${[r, g, b].map(channel => channel.toString(16).padStart(2, '0')).join('')}`

export function extractRepresentativeColorsFromPixels(
  pixels: Uint8ClampedArray,
  count = 5
): string[] {
  if (count <= 0) return []
  const histogram = new Map<number, WeightedColor>()
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] < MIN_ALPHA) continue
    const r = pixels[index]
    const g = pixels[index + 1]
    const b = pixels[index + 2]
    const key =
      ((r >> QUANTIZATION_SHIFT) << 8) |
      ((g >> QUANTIZATION_SHIFT) << 4) |
      (b >> QUANTIZATION_SHIFT)
    const existing = histogram.get(key)
    if (existing) {
      existing.r += r
      existing.g += g
      existing.b += b
      existing.weight += 1
    } else histogram.set(key, { r, g, b, weight: 1 })
  }
  const colors = [...histogram.values()].map(color => ({
    r: Math.round(color.r / color.weight),
    g: Math.round(color.g / color.weight),
    b: Math.round(color.b / color.weight),
    weight: color.weight,
  }))
  if (colors.length === 0) return []
  const buckets: ColorBucket[] = [
    { colors, weight: colors.reduce((sum, color) => sum + color.weight, 0) },
  ]
  while (buckets.length < Math.min(count, colors.length)) {
    let bucketIndex = -1
    let bestScore = -1
    for (let index = 0; index < buckets.length; index += 1) {
      const bucket = buckets[index]
      if (bucket.colors.length < 2) continue
      const widestRange = Math.max(
        getChannelRange(bucket.colors, 'r'),
        getChannelRange(bucket.colors, 'g'),
        getChannelRange(bucket.colors, 'b')
      )
      const score = widestRange * Math.sqrt(bucket.weight)
      if (score > bestScore) {
        bestScore = score
        bucketIndex = index
      }
    }
    if (bucketIndex < 0) break
    const split = splitBucket(buckets[bucketIndex])
    if (!split) break
    buckets.splice(bucketIndex, 1, ...split)
  }
  return buckets
    .map(averageBucket)
    .sort((a, b) => b.weight - a.weight)
    .map(toHex)
}
