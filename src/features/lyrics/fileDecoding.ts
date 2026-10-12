import { unzlibSync } from 'fflate'
import type { LyricFileSource } from '../../types/music'

// Adapted byte-decoding behavior from Folia; KRC uses the same XOR key and zlib format.
const MAX_LYRIC_BYTES = 2 * 1024 * 1024
const KRC_KEY = [64, 71, 97, 119, 94, 50, 116, 71, 81, 54, 49, 45, 206, 210, 110, 105]
const startsWith = (bytes: Uint8Array, prefix: number[]) =>
  prefix.every((value, index) => bytes[index] === value)

export function decodeLyricBytes(bytes: Uint8Array): string {
  if (bytes.length > MAX_LYRIC_BYTES) throw new Error('歌词文件超过 2 MB')
  if (startsWith(bytes, [0x6b, 0x72, 0x63, 0x31])) {
    const compressed = bytes.slice(4).map((value, index) => value ^ KRC_KEY[index % KRC_KEY.length]!)
    // A fixed output buffer bounds decompressed data as well as the imported file.
    const output = unzlibSync(compressed, { out: new Uint8Array(MAX_LYRIC_BYTES + 1) })
    if (output.length > MAX_LYRIC_BYTES) throw new Error('解压后的歌词文件超过 2 MB')
    bytes = output
  }
  let encoding = 'utf-8'
  if (startsWith(bytes, [0xff, 0xfe])) encoding = 'utf-16le'
  if (startsWith(bytes, [0xfe, 0xff])) encoding = 'utf-16be'
  let text: string
  try {
    text = new TextDecoder(encoding, { fatal: true }).decode(bytes)
  } catch {
    text = new TextDecoder('gb18030', { fatal: true }).decode(bytes)
  }
  return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
}

export function decodeLyricSource(source: LyricFileSource | null): string {
  return source === null ? '' : typeof source === 'string' ? source : decodeLyricBytes(Uint8Array.from(source.bytes))
}

export async function readLyricFile(file: File): Promise<string> {
  if (file.size > MAX_LYRIC_BYTES) throw new Error('歌词文件超过 2 MB')
  return decodeLyricBytes(new Uint8Array(await file.arrayBuffer()))
}
