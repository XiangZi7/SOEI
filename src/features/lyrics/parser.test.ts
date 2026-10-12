import { describe, expect, it } from 'vitest'
import { parseLyrics, detectLyricFormat, isLyricFilename } from './parser'
import { buildGlyphTimings } from './glyphTiming'
import { toFoliaLine } from './adapter'
import type { LyricFormat } from '../../types/music'

const ttml = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" itunes:timing="Word"><body><div><p begin="00:01.000" end="00:03.000"><span begin="00:01.000" end="00:02.000">你</span><span begin="00:02.000" end="00:03.000">好</span></p></div></body></tt>`
const fixtures: [LyricFormat, string][] = [
  ['lrc', '[00:01.00]你好\n[00:03.00]世界'],
  ['enhanced-lrc', '[00:01.00]<00:01.00>你<00:02.00>好<00:03.00>'],
  ['vtt', 'WEBVTT\n\n00:01.000 --> 00:03.000\n你好'],
  ['ttml', ttml],
  ['yrc', '[1000,2000](1000,1000,0)你(2000,1000,0)好'],
  ['qrc', '[1000,2000]你(1000,1000)好(2000,1000)'],
  ['krc', '[1000,2000]<0,1000,0>你<1000,1000,0>好'],
  ['awlrc', '[00:01.000]<0,1000>你<1000,1000>好'],
]

describe('富歌词公开接口', () => {
  it.each(fixtures)('%s 从内容检测到毫秒模型', (format, content) => {
    expect(detectLyricFormat(content)).toBe(format)
    const document = parseLyrics(content)
    expect(document.format).toBe(format)
    expect(document.lines[0]).toMatchObject({
      startMs: 1000,
      endMs: 3000,
      text: '你好',
    })
    expect(document.lines[0]!.renderHints?.rawDurationMs).toBe(2000)
    expect(JSON.stringify(document)).not.toMatch(
      /"(?:startTime|endTime|fullText|renderEndTime)"/
    )
    if (['lrc', 'vtt'].includes(format)) {
      expect(document.lines[0]!.words).toBeUndefined()
      expect(document.isWordByWord).toBe(false)
    } else {
      expect(document.lines[0]!.words?.map(word => word.startMs)).toEqual([
        1000, 2000,
      ])
      expect(document.isWordByWord).toBe(true)
    }
  })
  it('扩展名优先、重复时间标签与 offset 保持既有行为', () => {
    expect(isLyricFilename('SONG.TTML')).toBe(true)
    expect(isLyricFilename('song.wav')).toBe(false)
    expect(detectLyricFormat('', 'music.awlrc')).toBe('awlrc')
    const lines = parseLyrics(
      '[offset:-100]\n[00:01][00:03]<00:01>你<00:02>好<00:03>'
    ).lines
    expect(lines.map(line => line.startMs)).toEqual([900, 2900])
    expect(lines[1]!.words?.map(word => word.startMs)).toEqual([2900, 3900])
  })
  it('方括号逐词格式和 QRC XML 容器保留时间', () => {
    expect(
      parseLyrics('[00:01.00]你[00:02.00]好[00:03.00]').lines[0]
    ).toMatchObject({
      text: '你好',
      startMs: 1000,
      endMs: 3000,
    })
    const qrc =
      '<QrcInfos><LyricInfo><Lyric_1 LyricContent="[1000,2000]你(1000,1000)好(2000,1000)"/></LyricInfo></QrcInfos>'
    expect(parseLyrics(qrc).lines[0]).toMatchObject({
      text: '你好',
      startMs: 1000,
      endMs: 3000,
    })
  })
  it('翻译和罗马音按最近的一对一时间匹配，不借用相邻歌词', () => {
    const document = parseLyrics('[00:01.00]第一句\n[00:01.40]第二句', {
      translation: '[00:01.40]second',
      romanization: '[00:01.00]diyi',
    })
    expect(document.lines[0]!.translation).toBeUndefined()
    expect(document.lines[1]!.translation).toBe('second')
    expect(document.lines[0]!.romanization).toBe('diyi')
  })
  it('混合精确和普通歌词时，不给普通行添加估计演唱时间', () => {
    const document = parseLyrics(
      '[00:01.00]你[00:02.00]好[00:03.00]\n[00:04.00]普通歌词'
    )
    expect(document.lines[0]!.timing).toBe('word')
    expect(document.lines[1]!.timing).toBe('line')
    expect(document.lines[1]!.words).toBeUndefined()
  })
  it('音节、ruby、和声、演唱者、副歌及语言元数据完整跨越时间边界', () => {
    const rich = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" xmlns:tts="http://www.w3.org/ns/ttml#styling" itunes:timing="Word"><head><metadata><ttm:agent type="person" xml:id="v1"><ttm:name>Alice</ttm:name></ttm:agent></metadata></head><body><div itunes:songPart="Chorus"><p begin="00:01.000" end="00:05.000" ttm:agent="v1"><span begin="00:01.000" end="00:01.200">hurri</span><span begin="00:01.200" end="00:02.000">cane</span> <span tts:ruby="container"><span tts:ruby="base">風</span><span tts:ruby="textContainer"><span tts:ruby="text" begin="00:02.000" end="00:03.000">かぜ</span></span></span><span ttm:role="x-bg" begin="00:03.000" end="00:04.000"><span begin="00:03.000" end="00:04.000">echo</span></span><span ttm:role="x-translation" xml:lang="zh-CN">风</span><span ttm:role="x-roman" xml:lang="ja-Latn">kaze</span></p></div></body></tt>`
    const document = parseLyrics(rich)
    const line = document.lines[0]!
    expect(document.ttml?.agents?.v1?.name).toBe('Alice')
    expect(line).toMatchObject({
      startMs: 1000,
      endMs: 5000,
      agentId: 'v1',
      isChorus: true,
      translation: '风',
      romanization: 'kaze',
    })
    expect(line.words?.[0]?.syllables?.map(syllable => syllable.endMs)).toEqual(
      [1200, 2000]
    )
    expect(line.words?.[1]?.syllables?.[0]?.ruby?.[0]).toMatchObject({
      text: 'かぜ',
      startMs: 2000,
      endMs: 3000,
    })
    expect(line.backgroundVocals?.[0]).toMatchObject({
      startMs: 3000,
      endMs: 4000,
      text: 'echo',
    })
    expect(line.alternateTexts?.[0]?.language).toBe('zh-CN')
    const restored = toFoliaLine(line)
    expect(restored.words[0]!.syllables?.[0]?.endTime).toBe(1.2)
    const timings = buildGlyphTimings(line, 5000, Array.from(line.text))!
    expect(timings[4]?.endMs).toBe(1200)
    expect(timings[5]?.startMs).toBe(1200)
  })
  it('普通 TTML 行保持整行同步', () => {
    const document = parseLyrics(
      '<tt xmlns="http://www.w3.org/ns/ttml"><body><div><p begin="00:01.000" end="00:03.000">你好</p></div></body></tt>'
    )
    expect(document.lines[0]!.words).toBeUndefined()
    expect(document.lines[0]!.timing).toBe('line')
  })
  it('标准 TTML 命名空间前缀和自动行标识可以直接导入', () => {
    const document = parseLyrics(
      '<t:tt xmlns:t="http://www.w3.org/ns/ttml"><t:body><t:div><t:p xml:id="plain" begin="1s" end="3s">你好</t:p></t:div></t:body></t:tt>'
    )
    expect(document.lines[0]).toMatchObject({
      startMs: 1000,
      endMs: 3000,
      text: '你好',
    })
    expect(() =>
      parseLyrics('<tt><body><p></body></tt>', { format: 'ttml' })
    ).toThrow()
  })
  it('同时间的合并字幕可拆出翻译，间奏是显式选项', () => {
    const document = parseLyrics(
      '[00:05.00]Hello\n[00:05.00]你好\n[00:10.00]World\n[00:10.00]世界'
    )
    expect(document.lines.map(line => line.text)).toEqual(['Hello', 'World'])
    expect(document.lines.map(line => line.translation)).toEqual([
      '你好',
      '世界',
    ])
    expect(
      parseLyrics('[00:05.00]Hello', { includeInterludes: true }).lines[0]?.text
    ).toBe('......')
    expect(parseLyrics('[00:05.00]Hello').lines).toHaveLength(1)
  })
})
