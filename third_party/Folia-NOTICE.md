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
| `tilt/tiltLayout.ts`, `tilt/tiltFrame.ts`, `tilt/TiltLine.vue`, `tilt/VisualizerTilt.vue` | `src/components/visualizer/tilt/VisualizerTilt.tsx` |
| `tilt/entry.ts`, `tilt/TiltSettingsPanel.vue` | `src/components/visualizer/tilt/entry.tsx`, tilt tuning defaults and settings panel |
| `easing.ts` | cubic-bezier solver equivalent to `tempera/temperaMotionEasing.ts` |
| `partita/partitaLayout.ts`, `partita/partitaFrame.ts`, `partita/PartitaLine.vue`, `partita/VisualizerPartita.vue` | `src/components/visualizer/partita/VisualizerPartita.tsx` and `partita/README.md` |
| `partita/entry.ts`, `partita/PartitaSettingsPanel.vue` | `src/components/visualizer/partita/entry.tsx`, partita tuning defaults and settings panel |
| `claddagh/claddaghGeometry.ts`, `claddagh/claddaghFrame.ts`, `claddagh/CladdaghRing.vue`, `claddagh/VisualizerCladdagh.vue` | `src/components/visualizer/claddagh/VisualizerCladdagh.tsx` |
| `claddagh/entry.ts`, `claddagh/CladdaghSettingsPanel.vue` | `src/components/visualizer/claddagh/entry.tsx`, claddagh tuning defaults and settings panel |
| `wordReveal.ts` | word-level reveal shared verbatim by upstream `classic` and `partita` |
| `easing.ts` (`springStep`) | analytic step response replacing framer-motion `spring()` in `classic`, `partita` and `claddagh` |
| `cadenza/cadenzaTiming.ts`, `cadenza/cadenzaLayout.ts`, `cadenza/cadenzaFrame.ts`, `cadenza/VisualizerCadenza.vue` | `src/components/visualizer/cadenza/VisualizerCadenza.tsx` |
| `cadenza/entry.ts`, `cadenza/CadenzaSettingsPanel.vue` | `src/components/visualizer/cadenza/entry.tsx`, `cadenza/tuning.ts` |
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
- The tilt renderer likewise replaces framer-motion with absolute-time evaluation: segment and per-grapheme reveal are solved from the playback clock through `easing.ts` rather than played as CSS/framer transitions with delays, so seeking lands on the correct frame instead of restarting the entry. Whitespace graphemes are excluded from both the reveal stagger and the up/down alternation — indexing them would delay the rest of a spaced line by one step and invert its stagger phase. Per-grapheme timing lives only in the parent so the whole stage runs one frame loop.
- `easing.ts` reimplements the upstream cubic-bezier solver as a shared module, since several modes specify exact CSS curves (tilt `0.25/0.46/0.45/0.94`, tempera `0.22/1/0.36/1`) that absolute-time evaluation has to sample in JS.
- `wordReveal.ts` extracts the word-level reveal that upstream duplicates verbatim between `classic` and `partita` (render profile, active end, display duration, and the layout/body variants). Keeping two copies would let them drift; `classic/classicLayout.ts` and `classic/classicFrame.ts` now alias the shared implementation so their public API is unchanged.
- Upstream partita defines `getTargetColumnCount` but never calls it: `buildSequentialColumns` always emits exactly one column, and the real structure is the chunks inside it. That dead branch is not ported.
- Cadenza ports only the live render path. Upstream still defines a full canvas glow pipeline (`drawActiveBeam`, `drawShadowGlowText`, `drawGlowTrailText`, `chosenAngleForEntry`, ~160 lines) but the final version calls none of it from the draw loop: glow moved to the DOM, and the canvas survives only to stroke the chorus ripple and to read `actualBoundingBoxAscent`. The `beamIntensity` tuning field is dead for the same reason (default 0, sole consumer `drawActiveBeam`) and is not carried over. SOEI strokes the ripple as a DOM circle in a layer beneath the words, which is the stacking the upstream canvas already had, so the mode needs no canvas at all.
- `placement.rotate`, `entryOffsetX` and `entryOffsetY` are hard-coded to 0 upstream. Those fields are dropped and the per-state rotation math is written around 0 directly.
- Glyph ascent is measured once per placement at prepare time instead of calling `measureText` for every word on every frame. Both inputs (`placement.text` and `placement.height`) are constant per placement, so the result is identical.
- Cadenza is the one ported mode that keeps per-frame state. Upstream drives each placement with an exponential follower (`1 - exp(-k*dt)`, rates 11/14/16) and the feel of words gliding into place comes entirely from it; pure absolute-time evaluation would turn the waiting/active/passed transitions into hard jumps. Because a follower carries history, SOEI adds clock-jump detection (>0.35 s in either direction): during continuous playback the follower runs, and on a seek the state snaps straight to the target so the first frame after seeking is already correct instead of replaying the approach.
- The `getClassic*` envelope helpers are NOT merged into the shared `wordReveal.ts`. Despite the name they have drifted from classic: the lookahead window differs (0.18/0.045/0 against 0.15/0.08/0.03), the glow envelope is a rise-plateau-decay shape rather than keyframe interpolation, and the line envelope derives its durations from the real `getLineTransitionTiming` plus `linePassHold` instead of hard-coded constants. Sharing them would change how both modes look.
- The upstream glow lives on a separate transparent-text layer driven by `text-shadow`. `drop-shadow` projects the alpha of what is actually painted, so a transparent layer would emit nothing; the two-layer structure is therefore dropped and the drop-shadow chain is applied to the body glyph spans directly. Per-glyph glow consequently splits the body into glyph spans rather than the glow layer.
- `prepareWithSegments` requires an OffscreenCanvas or a DOM canvas. `prepareCadenzaLine` returns null when text measurement is unavailable rather than throwing, and the renderer treats null as nothing to draw. The geometry stages (`findCadenzaWordRanges`, `buildCadenzaEmphasisMap`, `buildCadenzaPlacements`) take measurement as an injected function so they stay testable without a canvas.
- The claddagh renderer keeps the upstream pseudo-3D projection exactly (depth `(cos ψ + 1) / 2`, spacing factor `0.35 + 0.65·D^1.2`, scale `(0.22 + 0.98·D^1.5)`, blur `8·(1 − D)`), but drives ψ from the playback clock instead of a framer `MotionValue` chain. Ring rotation uses the analytic step response for stiffness 55 / damping 14 / mass 0.9, so seeking lands mid-rotation at the correct angle rather than replaying it; jumps of more than one line snap instead of sweeping a long arc.
- Upstream measures arc spacing inside each ring component. SOEI computes it once in the parent and passes it down, because the parent already needs the active line's spacing for back-follow and matching child instances through `.dataset` would be fragile. Grapheme widths are measured through `@chenglou/pretext` behind a 240-entry LRU cache and fall back to visual-length estimation when measurement is unavailable.
- Zero-duration graphemes (the gap characters SOEI's timeline produces for punctuation and spaces) are given at least 60 ms each by borrowing from neighbours, never pushing a neighbour below 40 ms. Without this they would collapse onto a single angle and stack on top of each other.
- Claddagh glow uses the same `filter: drop-shadow()` chain as `wordGlow.ts` for the reason recorded above; the chorus variant stacks three layers with a deliberately weak middle layer (alpha 0.2), which is what produces the upstream halo rather than a flat bloom.
- A line's render window is extended to the next line's start minus 0.34 s so the ring keeps drifting through instrumental gaps instead of freezing on the last grapheme. When the clock resets before the line index commits, the completed frame is held for that one tick — otherwise the old line would briefly render at time 0.
- Partita falls back to one synthetic full-line unit when a line has no word timings. SOEI emits an empty `words` array for ordinary LRC, so `buildPostLyricLayoutUnits` returns nothing and the mode would render blank; the fallback shows the complete line without singing glow.
- `useVisualizerFrame.ts` is SOEI-specific: one DOM frame loop per stage, bounded by the selected quality. Optional non-reactive time subscriptions repaint a paused Seek without a continuous loop, and are removed on source changes or disposal.
- `useVisualizerBridge.ts` and the seconds/milliseconds boundary are SOEI-specific and not ported from upstream. Conversion inputs are isolated in computed values so a host getter that creates a fresh snapshot does not rebuild the full lyric array on each position update.
- `src-tauri/src/audio.rs` adopts the upstream `AudioBands` band split (bass/lowMid/mid/vocal/treble, with mid and vocal deliberately overlapping); the FFT, windowing and smoothing remain SOEI's own.

## Scope

No upstream media, React components or application infrastructure is included. Upstream source files carry `// @note Version Control: Project Folia version x.y.z` provenance watermarks; where ported code retains those lines they are kept deliberately as attribution.
## Monet and registered backgrounds — 2026-10-16

The Vue files under `src/features/visualizer/monet/` adapt Folia's VisualizerMonet, MonetLyricsRail, MonetPortraitImage, MonetFloatingDecor and AudioOverlay. The pure rail layout, portrait crossfade, audio sampling and particle builders retain the upstream algorithms; measured lyric/token helpers are reused from the previously ported `features/lyrics/folia/` modules. Vue watchers and typed callbacks replace React effects/state, and lyric scroll/sweep evaluation uses SOEI's playback clock. The original portrait drag editor and custom portrait upload are not included; position is exposed through settings. Animated singing glow uses drop-shadow instead of variable text-shadow.

The modules under `src/features/visualizer/backgrounds/` adapt the upstream background definitions, registry, common Fluid/Geometric backgrounds, Sora GLSL, Monet bitmap pipeline, Latent audio/palette functions, Nomand shader configuration and overscan/inversion helpers, and the sandboxed URL layer. SOEI adds input validation, bounded caches, cancellation of obsolete cover decodes, explicit resource ownership, and frame-rate/visibility integration. Sora uses a native WebGL host instead of twgl. Existing `features/visual/coverDrift.ts` and `useCoverDrift.ts` supply the already-ported Monet WAAPI drift; this change adds pause handling rather than a second copy.

Latent and Nomand use the published `@paper-design/shaders` 0.0.80 package directly, preserving the same shader family as upstream's React wrappers. Paper Shaders is a separate Apache-2.0 dependency, with its LICENSE/NOTICE shipped in its npm package. SOEI does not copy the Paper React wrappers. ShaderMount is held at speed zero and driven by the application frame loop; static image shaders only render on changes. The URL renderer preserves `sandbox="allow-scripts"`; desktop external-frame access remains disabled by the existing CSP.

These Folia adaptations remain AGPL-3.0, as described above. Background and lyric scene registry entries are lazy-loaded; none of the still-unported Folia modes are registered as placeholders.
