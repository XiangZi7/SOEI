import { mkdir, writeFile } from 'node:fs/promises';
// 自行合成、可自由使用的测试音频，不含第三方歌曲。
const directory = new URL('../tests/fixtures/', import.meta.url);
await mkdir(directory, { recursive: true });
const rate = 8000;
const seconds = 12;
const samples = rate * seconds;
const wav = Buffer.alloc(44 + samples * 2);
wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);
for (let i = 0; i < samples; i++) wav.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 220 * i / rate) * 655), 44 + i * 2);
await writeFile(new URL('测试音楽.wav', directory), wav);
await writeFile(new URL('测试音楽.lrc', directory), '[00:00.00]测试音乐 / テスト音楽\n[00:03.00]第一句歌词\n[00:06.50]Hello, world.\n[00:09.00]最后一句歌词\n');
await writeFile(new URL('损坏.mp3', directory), 'intentionally invalid audio fixture');
