import type { Line } from '../lyrics/folia/model'
import type { ReadableValue } from './timeSource'

// 所有 visualizer 共用的运行时辅助。从 Folia runtime.ts 移植。
// 这个文件刻意保持极小：它只回答「现在该关心哪一行」和「下一行该预热了吗」，
// 这样每个 renderer 都能对自己的布局保持主见。
//
// 与上游的唯一差别：`useVisualizerRuntime` 的 React useMemo 换成普通计算。
// 这些函数都很便宜，而 Vue 侧的记忆化由调用处的 computed 负责。
export interface VisualizerPreheatWindow {
  minLead: number
  maxLead: number
}

interface GetRecentCompletedLineOptions {
  lines: Line[]
  currentLineIndex: number
  currentTime: number
  getLineEndTime?: (line: Line) => number
}

interface PrepareActiveAndUpcomingOptions<TPreparedState> {
  activeLine: Line | null | undefined
  upcomingLine: Line | null | undefined
  prepareLine: (line: Line | null | undefined) => TPreparedState | null
}

interface VisualizerRuntimeOptions {
  currentTime: ReadableValue<number>
  currentLineIndex: number
  lines: Line[]
  getLineEndTime?: (line: Line) => number
}

// 只在没有活跃行时才有意义。
// 主要是为了让字幕层在短间隙里继续显示上一句的翻译。
export function getRecentCompletedLine({
  lines,
  currentLineIndex,
  currentTime,
  getLineEndTime = (line: Line) => line.endTime,
}: GetRecentCompletedLineOptions): Line | null {
  if (currentLineIndex !== -1 || lines.length === 0) return null
  for (let index = lines.length - 1; index >= 0; index -= 1)
    if (currentTime > getLineEndTime(lines[index]!)) return lines[index]!
  return null
}

// 有活跃行时，upcoming 就是数组里的下一行。
// 还没有任何行活跃时，upcoming 指「第一行 startTime 仍在我们前面的行」。
export function getUpcomingLine(
  lines: Line[],
  currentLineIndex: number,
  currentTime: number
): Line | null {
  if (lines[currentLineIndex]) return lines[currentLineIndex + 1] ?? null
  for (const line of lines) if (line.startTime > currentTime) return line
  return null
}

// 多数模式只需要前瞻 1-2 行用于字幕或预热，所以保持便宜且显式。
export function getUpcomingLines(
  lines: Line[],
  currentLineIndex: number,
  count = 2
): Line[] {
  if (currentLineIndex < 0) return []
  return lines.slice(currentLineIndex + 1, currentLineIndex + 1 + count)
}

// 预热窗口刻意用提前时间定义，而不是绝对时间戳。
// 这样每个 visualizer 调起来更容易，也不会和句子时长耦合。
export function shouldPreheatLine(
  line: Line | null | undefined,
  currentTime: number,
  window: VisualizerPreheatWindow
): boolean {
  if (!line) return false
  const leadTime = line.startTime - currentTime
  return leadTime >= window.minLead && leadTime <= window.maxLead
}

// 常见的准备流程：
// 1. 有活跃行就准备活跃行，
// 2. 总是顺带预热下一行，
// 3. 只把活跃行的准备结果返回给调用方。
export function prepareActiveAndUpcoming<TPreparedState>({
  activeLine,
  upcomingLine,
  prepareLine,
}: PrepareActiveAndUpcomingOptions<TPreparedState>): TPreparedState | null {
  if (!activeLine) {
    prepareLine(upcomingLine)
    return null
  }
  const currentState = prepareLine(activeLine)
  prepareLine(upcomingLine)
  return currentState
}

/**
 * 一小包运行时数据。重的布局/画布工作不要放进来，否则每个模式都要为同一层抽象付钱。
 */
export function visualizerRuntime({
  currentTime,
  currentLineIndex,
  lines,
  getLineEndTime,
}: VisualizerRuntimeOptions) {
  const currentTimeValue = currentTime.get()
  return {
    currentTimeValue,
    activeLine: lines[currentLineIndex] ?? null,
    recentCompletedLine: getRecentCompletedLine({
      lines,
      currentLineIndex,
      currentTime: currentTimeValue,
      getLineEndTime,
    }),
    upcomingLine: getUpcomingLine(lines, currentLineIndex, currentTimeValue),
    nextLines: getUpcomingLines(lines, currentLineIndex, 2),
  }
}
