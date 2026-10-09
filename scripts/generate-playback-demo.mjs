import { mkdir, writeFile } from 'node:fs/promises'

// Original instrumental melody and test lyrics. No external media is needed.
const directory = new URL('../public/demo/', import.meta.url)
await mkdir(directory, { recursive: true })
const rate = 22050
const seconds = 36
const samples = new Float64Array(rate * seconds)
const frequency = midi => 440 * 2 ** ((midi - 69) / 12)

function note(midi, start, duration, volume) {
  const hz = frequency(midi)
  for (let i = 0; i < Math.floor(duration * rate); i++) {
    const index = Math.floor(start * rate) + i
    if (index >= samples.length) break
    const t = i / rate
    const envelope = Math.min(1, t / 0.012) * Math.exp((-t * 3) / duration)
    const release = Math.min(1, (duration - t) / 0.08)
    const wave =
      Math.sin(2 * Math.PI * hz * t) +
      0.25 * Math.sin(4 * Math.PI * hz * t) +
      0.08 * Math.sin(6 * Math.PI * hz * t)
    samples[index] += wave * envelope * release * volume
  }
}

const melodies = [
  [72, 76, 79, 76, 74, 72, 67, 71],
  [69, 72, 76, 79, 76, 72, 71, 69],
  [65, 69, 72, 76, 74, 72, 69, 67],
  [67, 71, 74, 79, 77, 74, 71, 67],
]
const chords = [
  [48, 55, 60],
  [45, 52, 57],
  [41, 48, 53],
  [43, 50, 55],
]
for (let bar = 0; bar < 8; bar++) {
  const melody = melodies[bar % 4]
  melody.forEach((midi, beat) => note(midi, bar * 4 + beat * 0.5, 0.75, 0.15))
  chords[bar % 4].forEach((midi, index) => {
    note(midi, bar * 4 + index * 0.04, 3.8, 0.065)
    note(midi + 12, bar * 4 + 2 + index * 0.04, 1.8, 0.035)
  })
}
;[48, 55, 60, 64, 72].forEach((midi, index) =>
  note(midi, 32 + index * 0.1, 3.5, 0.08)
)

const wav = Buffer.alloc(44 + samples.length * 2)
wav.write('RIFF', 0)
wav.writeUInt32LE(wav.length - 8, 4)
wav.write('WAVEfmt ', 8)
wav.writeUInt32LE(16, 16)
wav.writeUInt16LE(1, 20)
wav.writeUInt16LE(1, 22)
wav.writeUInt32LE(rate, 24)
wav.writeUInt32LE(rate * 2, 28)
wav.writeUInt16LE(2, 32)
wav.writeUInt16LE(16, 34)
wav.write('data', 36)
wav.writeUInt32LE(samples.length * 2, 40)
samples.forEach((sample, index) => {
  const fade = Math.min(1, (seconds - index / rate) / 0.5)
  wav.writeInt16LE(
    Math.round(Math.max(-1, Math.min(1, sample * fade)) * 32767),
    44 + index * 2
  )
})
await writeFile(new URL('soei-test.wav', directory), wav)
// Authored word timings demonstrate the instrumental; they are not vocal alignment.
await writeFile(
  new URL('soei-test.lrc', directory),
  [
    '[ti:光的回声 · 播放测试]',
    '[ar:SOEI]',
    '[by:SOEI · 器乐演示自定义词时间，非语音对齐]',
    '[00:00.00]<00:00.00>把声音<00:01.20>交给<00:02.20>此刻<00:03.60>',
    '[00:04.00]<00:04.00>让窗外的风<00:05.80>慢慢<00:06.70>经过<00:07.60>',
    '[00:08.00]<00:08.00>一束光<00:09.20>落在<00:10.00>安静角落<00:11.60>',
    '[00:12.00]<00:12.00>每个节拍<00:13.80>都有<00:14.70>回应<00:15.60>',
    '[00:16.00]<00:16.00>暂停，<00:16.80>让时间<00:18.00>停在这里<00:19.60>',
    '[00:20.00]<00:20.00>再播放，<00:21.20>故事<00:22.00>继续前行<00:23.60>',
    '[00:24.00]<00:24.00>拖动进度，<00:25.60>找到<00:26.40>这一句<00:27.60>',
    '[00:28.00]<00:28.00>向前<00:28.80>向后，<00:29.60>歌词<00:30.40>依然同行<00:31.60>',
    '[00:32.00]<00:32.00>最后的音符，<00:33.80>轻轻<00:34.70>落定<00:35.60>',
    '',
  ].join('\n')
)
