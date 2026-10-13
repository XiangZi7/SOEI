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

## Scope

No upstream media, React components or application infrastructure is included. Upstream source files carry `// @note Version Control: Project Folia version x.y.z` provenance watermarks; where ported code retains those lines they are kept deliberately as attribution.
