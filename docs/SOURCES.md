# 第三方与素材来源

版本以锁文件为准。正式发布需生成完整传递依赖许可清单。

| 内容 | 来源与用途 | 许可记录 |
| --- | --- | --- |
| Vue/Pinia/Router/I18n/VueUse | npm 官方包，前端技术栈 | MIT；I18n/VueUse 尚未接入完整功能 |
| Tailwind/插件/tailwind-merge | npm 官方包，主题、构建和 class 合并 | MIT |
| Three.js / @types/three | npm 官方包，歌词舞台的背景光场与类型声明 | MIT |
| GSAP | npm 官方包，歌词入场、淡出与交错动画 | GSAP Standard License，见包内 LICENSE 与 https://gsap.com/standard-license/ |
| Folia 歌词舞台参考 | 用户指定的 https://github.com/chthollyphile/folia-major ，阅读 Cadenza 构图与 Tempera 分镜代码，参考深色光场、片段强调、确定性构图和逐字入场 | 未复制该仓库代码、图片、歌词；本项目舞台与预览文案独立实现 |
| JIZURA 文字 PV 参考 | 用户指定的 https://github.com/852wa/JIZURA ，阅读 src/06_layouts.js、05_anim.js、07_decor.js 与 docs/EXPRESSION_PACKS.md，参考构图/运动/装饰组合、竖排、大小字、框线和种子重组 | 源仓库 MIT；未复制源代码或素材，Vue/Tailwind/GSAP 适配独立实现 |
| Iconify Vue/Lucide | npm 官方包，本地图标子集 | Iconify MIT；Lucide ISC；来自 Feather 的图标还涉及 MIT |
| Tauri/插件 | crates.io，窗口/IPC/托盘/组合键 | MIT / Apache-2.0 |
| rodio/Symphonia/RustFFT | crates.io，音频/解码/频谱 | rodio 和 RustFFT MIT / Apache-2.0；Symphonia MPL-2.0 |
| Lofty/rusqlite/image/rfd/walkdir/blake3/rand | crates.io，元数据/存储/封面/导入 | 正式清单按 Cargo.lock 对应 LICENSE 生成 |
| UI 参考图 | 用户提供的 ui稿，public/art/music-space.png 为副本 | 未提供对外分发许可，目前仅为本地开发参考 |
| 英文衬线字体 | [Google Fonts 官方仓库 / Cormorant Garamond](https://github.com/google/fonts/tree/main/ofl/cormorantgaramond)，本地完整可变字体及真实斜体 | SIL Open Font License 1.1；字体与许可证位于 public/fonts/，不访问在线 CDN |
| 中日文衬线字体 | [Google Fonts 官方仓库 / Noto Serif SC](https://github.com/google/fonts/tree/main/ofl/notoserifsc)，本地完整可变字体 | SIL Open Font License 1.1；未裁剪字库，支持离线导入歌词；许可证位于 public/fonts/ |
| WAV/LRC/损坏测试文件 | scripts/generate-fixtures.mjs 自行生成 | 不含第三方歌曲，可自由使用这些测试样本 |
| 一键播放测试旋律与歌词 | scripts/generate-playback-demo.mjs 自行合成与编写，public/demo/soei-test.wav 与 soei-test.lrc | 不含第三方歌曲或歌词，可自由使用 |
| 一键播放测试封面 | public/demo/soei-test-cover.svg 自行绘制的月光山水矢量图 | 不含第三方图片，可自由使用 |

程序附带一段自制器乐测试旋律及同步测试歌词，没有附带第三方歌曲或视频；导入原文件保留在原位置。用户媒体和歌词仅在本地处理。
