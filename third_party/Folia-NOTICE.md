# Folia port

SOEI contains code adapted from [Folia](https://github.com/chthollyphile/folia-major), commit `c69afdcba85fe6ca1f5c9f5cb83be3e83adfcd67`, provided locally in `D:\code\ck\folia-major`.

The upstream project identifies its author as chthollyphile and its license as AGPL-3.0. The complete license is retained in [Folia-LICENSE.txt](Folia-LICENSE.txt). These copied and adapted modules remain covered by that license; this is a source port, not an independent implementation. Distribution of the resulting combined application must satisfy the applicable AGPL terms.

## Lyrics engine — `src/features/lyrics/folia/`

Adaptations: isolated lyric-only types and imports, removed TTML debug output, formatted TypeScript for SOEI, and connected the algorithms to Vue through an explicit seconds/milliseconds adapter. The original parser and measurement algorithms use seconds internally. SOEI's public model, native playback state, offsets, component props and frame functions use milliseconds.

Modules: parserCore, ttmlConversion, renderHints, sentenceLayout, cjkSemanticLayout, wordSegmentation, graphemeTiming, formatDetection, timelineSplitter, alternateText, subtitleTrackStyle, monetLyricsModel, monetLyricMotion and wordColoring. File decoding also adapts the upstream KRC XOR key and encoding behavior, with fflate used for bounded zlib decompression. Ported regression tests retain the same provenance.

## Cover palette theme engine — `src/features/theme/`

| SOEI module | Upstream source |
| --- | --- |
| `colorMath.ts` | `src/utils/themeColorMath.ts` merged with `src/components/visualizer/colorMix.ts` |
| `medianCut.ts` | `src/utils/colorPalette.ts` |
| `coverPalette.ts` | `src/utils/colorExtractor.ts` |
| `paletteAnalysis.ts` | `src/utils/builtinTheme/coverPaletteAnalysis.ts` |
| `colorRanges.ts` | `src/utils/builtinTheme/themeColorRanges.ts` |
| `nameTable.ts` | `src/utils/builtinTheme/themeNameTable.ts` |
| `descriptionTable.ts` | `src/utils/builtinTheme/themeDescriptionTable.ts` |
| `generateTheme.ts` | `src/utils/builtinTheme/generateBuiltinDualTheme.ts` |
| `sanitize.ts` | `src/services/themeSanitizer.ts` |
| `fontStacks.ts` | `src/utils/fontStacks.ts` |

Adaptations:

- `model.ts` declares a lyric/visual-only `Theme` and `DualTheme` instead of importing the upstream application-wide `src/types.ts`.
- `generateTheme.ts` adds a `seededRandom` (mulberry32) keyed on the track id, so a track keeps one palette across sessions. Upstream defaults to `Math.random`. Generated themes use `fontStyle: 'serif'` and `provider: 'SOEI'`; upstream defaults to `'sans'` / `'Built-in'`.
- `nameTable.ts` drops the upstream `' Built-in'` name suffix, which exists only to distinguish generated themes from AI-generated ones. SOEI has no AI theme path.
- `sanitize.ts` replaces the upstream AI fallback colors with SOEI's own palette from `src/styles/tokens.css`; the dark accent keeps `--color-ambient-default` so the idle look is unchanged.
- `fontStacks.ts` substitutes SOEI's bundled offline families (`SOEI Cormorant`, `SOEI Mincho`, see `src/styles/fonts.css`) for the upstream stacks, which name fonts this project does not ship.
- `coverPalette.ts` wraps `getImageData` in `try`/`catch` and supports `ArtworkCrop` regions. Tauri's asset protocol can taint the canvas and throw `SecurityError`; extraction must degrade to the fallback theme rather than break the theme chain.
- `cssVariables.ts` and `src/stores/theme.ts` are SOEI-specific and not ported from upstream.

## Visualizer rendering layer — `src/features/visualizer/`

| SOEI module | Upstream source |
| --- | --- |
| `runtime.ts` | `src/components/visualizer/runtime.ts` |
| `definition.ts` | `src/components/visualizer/definition.ts` |
| `registry.ts` | `src/components/visualizer/registry.tsx` |
| `loadPixi.ts` | `src/components/visualizer/loadPixi.ts` |
| `pixiFilterPoolCompat.ts` | `src/components/visualizer/pixiFilterPoolCompat.ts` |
| `pixiDisplayResources.ts` | `src/components/visualizer/pixiDisplayResources.ts` |
| `pixiTextureBudget.ts` | `src/components/visualizer/pixiTextureBudget.ts` |
| `usePixiHost.ts` | `src/components/visualizer/pixiRuntimeHost.ts` |
| `wordGlow.ts` | `src/components/visualizer/wordGlow.ts` |
| `subtitleFontSizes.ts` | `src/components/visualizer/subtitleFontSizes.ts` |
| `audioBands.ts` | `AudioBands` contract from `src/types.ts` |
| `VisualizerShell.vue` | `src/components/visualizer/VisualizerShell.tsx` |
| `VisualizerRenderer.vue` | `src/components/visualizer/VisualizerRenderer.tsx` |
| `still/VisualizerStill.vue` | `src/components/visualizer/still/VisualizerStill.tsx` |
| `classic/classicLayout.ts`, `classic/classicFrame.ts`, `classic/ClassicLine.vue`, `classic/VisualizerClassic.vue` | `src/components/visualizer/classic/Visualizer.tsx` |
| `classic/entry.ts`, `classic/ClassicSettingsPanel.vue` | `src/components/visualizer/classic/entry.tsx`, classic tuning defaults and settings panel |
| `subtitleOverlay.ts`, `VisualizerSubtitleOverlay.vue` | `src/components/visualizer/VisualizerSubtitleOverlay.tsx` |

Adaptations:

- `timeSource.ts` replaces framer-motion's `MotionValue<number>` with a deliberately non-reactive container exposing the same `.get()` call shape, so ported draw loops need no rewriting and never enter Vue's dependency tracking.
- `usePixiHost.ts` is the React hook rewritten as a Vue composable. The mount-once lifecycle and the drain-towards-newest-song handover semantics are preserved.
- `pixiFilterPoolCompat.ts` replaces the upstream exact-version gate (`pixi.VERSION !== '8.21.0'`) with detection of the private internals it patches. SOEI resolves pixi.js 8.22.0, where the upstream fix (pixijs/pixijs#12259) is still absent — verified against the installed sources: `FilterSystem.destroy()` does not unbind or destroy `_globalFilterBindGroup`, and `TexturePool._dropTextures()` still destroys textures without notifying bound renderers. The version gate would therefore have silently disabled a still-necessary patch.
- `wordGlow.ts` keeps only the `filter: drop-shadow()` path and drops the upstream `text-shadow` alternative behind `isGlowBlurQuantized`. The text-shadow path is the one that leaks file descriptors through Chromium's glyph strike cache; SOEI has no earlier look to stay compatible with. The module is also reshaped from framer `Variants` into pure timing/envelope functions to match SOEI's absolute-time frame evaluation.
- `runtime.ts` drops the React `useMemo` wrappers; memoisation belongs to the calling `computed`.
- `definition.ts` collapses the upstream per-mode tuning props into one `tunings` record, and expresses "this mode mounts no background" (upstream `renderBackground={false}`) as a registry field, because SOEI applies the shared shell in the renderer rather than in each mode.
- The classic renderer replaces framer-motion's stateful transitions with absolute-time word, line and glow evaluation. Spring entry uses the analytic response for stiffness 200 / damping 20; breathing uses a bounded sinusoid. The current line is replaced on line changes rather than recreating framer-motion's overlapping pop-layout exit. Layout keeps the upstream start-time seed by default and adds SOEI's scene seed for "换个分镜".
- Ordinary LRC has no measured word timing in SOEI. Classic displays its complete line without singing glow; missing spaces and punctuation are retained, and unalignable tokens fall back to the full line. Reduced-motion and power modes show complete static text.
- `useVisualizerFrame.ts` is SOEI-specific: one DOM frame loop per stage, bounded by the selected quality. Optional non-reactive time subscriptions repaint a paused Seek without a continuous loop, and are removed on source changes or disposal.
- `useVisualizerBridge.ts` and the seconds/milliseconds boundary are SOEI-specific and not ported from upstream. Conversion inputs are isolated in computed values so a host getter that creates a fresh snapshot does not rebuild the full lyric array on each position update.
- `src-tauri/src/audio.rs` adopts the upstream `AudioBands` band split (bass/lowMid/mid/vocal/treble, with mid and vocal deliberately overlapping); the FFT, windowing and smoothing remain SOEI's own.

## Scope

No upstream media, React components or application infrastructure is included. Upstream source files carry `// @note Version Control: Project Folia version x.y.z` provenance watermarks; where ported code retains those lines they are kept deliberately as attribution.