import { describe, expect, it } from 'vitest'
import { zlibSync } from 'fflate'
import { decodeLyricBytes, decodeLyricSource, readLyricFile } from './fileDecoding'

const encoder = new TextEncoder()
function encryptedKrc(text: string) {
  const key = [64, 71, 97, 119, 94, 50, 116, 71, 81, 54, 49, 45, 206, 210, 110, 105]
  const data = zlibSync(encoder.encode(text)).map((value, index) => value ^ key[index % key.length]!)
  return Uint8Array.from([107, 114, 99, 49, ...data])
}
describe('浏览器和原生共用歌词文件解码', () => {
  it('解密真实 krc1 头、XOR 与 zlib 数据；保留内嵌语言标签', async () => {
    const text = '[language:eyJjb250ZW50IjpbXX0=]\n[1000,2000]<0,1000,0>你<1000,1000,0>好'
    const bytes = encryptedKrc(text)
    expect(decodeLyricBytes(bytes)).toBe(text)
    expect(decodeLyricSource({ name: 'song.krc', bytes: Array.from(bytes) })).toBe(text)
    expect(await readLyricFile(new File([bytes], 'song.krc'))).toBe(text)
  })
  it('识别 UTF-16 BOM 和 GBK；统一换行', () => {
    expect(decodeLyricBytes(Uint8Array.from([255, 254, 65, 0, 13, 0, 10, 0, 66, 0]))).toBe('A\nB')
    expect(decodeLyricBytes(Uint8Array.from([196, 227, 186, 195]))).toBe('你好')
    expect(decodeLyricBytes(encoder.encode('\uFEFF[00:01]你好\r[00:02]世界'))).toBe('[00:01]你好\n[00:02]世界')
  })
  it('无损兼容旧 IPC 字符串和未配置歌词', () => {
    expect(decodeLyricSource('[00:01]hi')).toBe('[00:01]hi')
    expect(decodeLyricSource(null)).toBe('')
  })
  it('损坏或解压超过 2 MB 的 KRC 明确失败', () => {
    expect(() => decodeLyricBytes(Uint8Array.from([107, 114, 99, 49, 0]))).toThrow()
    expect(() => decodeLyricBytes(encryptedKrc('x'.repeat(2 * 1024 * 1024 + 10)))).toThrow(/2 MB/)
  })
})
