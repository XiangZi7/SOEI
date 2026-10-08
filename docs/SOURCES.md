# 第三方与素材来源

版本以锁文件为准。正式发布需生成完整传递依赖许可清单。

| 内容 | 来源与用途 | 许可记录 |
| --- | --- | --- |
| Vue/Pinia/Router/I18n/VueUse | npm 官方包，前端技术栈 | MIT；I18n/VueUse 尚未接入完整功能 |
| Tailwind/插件/tailwind-merge | npm 官方包，主题、构建和 class 合并 | MIT |
| Iconify Vue/Lucide | npm 官方包，本地图标子集 | Iconify MIT；Lucide ISC；来自 Feather 的图标还涉及 MIT |
| Tauri/插件 | crates.io，窗口/IPC/托盘/组合键 | MIT / Apache-2.0 |
| rodio/Symphonia/RustFFT | crates.io，音频/解码/频谱 | rodio 和 RustFFT MIT / Apache-2.0；Symphonia MPL-2.0 |
| Lofty/rusqlite/image/rfd/walkdir/blake3/rand | crates.io，元数据/存储/封面/导入 | 正式清单按 Cargo.lock 对应 LICENSE 生成 |
| UI 参考图 | 用户提供的 ui稿，public/art/music-space.png 为副本 | 未提供对外分发许可，目前仅为本地开发参考 |
| 字体 | 系统字体回退：Segoe UI/Microsoft YaHei/Palatino Linotype/Yu Mincho/SimSun 等 | 未嵌入或分发字体文件；实际外观随系统变化 |
| WAV/LRC/损坏测试文件 | scripts/generate-fixtures.mjs 自行生成 | 不含第三方歌曲，可自由使用这些测试样本 |

程序没有附带示例音乐或视频，导入原文件保留在原位置。用户媒体和歌词仅在本地处理。
