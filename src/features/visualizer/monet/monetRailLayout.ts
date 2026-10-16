// Adapted from Folia MonetLyricsRail.tsx (AGPL-3.0); see third_party/Folia-NOTICE.md.
import type { Theme } from '../../theme/model'
import type { Line } from '../../lyrics/folia/model'
import { colorWithAlpha } from '../../theme/colorMath'
import { buildMonetLayoutCacheKey, measureMonetLineLayout, type MonetLineLayoutInputs, type MonetLineStatus, type MonetMeasuredLineLayout, type MonetVisibleLineEntry } from '../../lyrics/folia/monetLyricsModel'
interface MonetRailSize {
    width: number;
    height: number;
}

interface MonetLineTone {
    opacity: number;
    scale: number;
    blurPx: number;
    baseColor: string;
    fontWeight: number;
    zIndex: number;
}

export interface PositionedMonetLineEntry extends MonetVisibleLineEntry {
    y: number;
    tone: MonetLineTone;
    layout: MonetMeasuredLineLayout;
    scaledHeight: number;
}

export type MonetLayoutCache = Map<string, MonetMeasuredLineLayout>;


const MONET_RAIL_WIDTH_FALLBACK_PX = 680
const MONET_RAIL_HEIGHT_FALLBACK_PX = 340
const MONET_ACTIVE_GAP_PX = 18
const MONET_INACTIVE_GAP_PX = 14
const MONET_ACTIVE_GAP_RATIO = 0.49
const MONET_INACTIVE_GAP_RATIO = 0.38
const MONET_SCROLL_BEFORE = 4
const MONET_SCROLL_AFTER = 4
const MONET_LAYOUT_CACHE_LIMIT = 240
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min,value))
const resolveLineTone = (
    entry: MonetVisibleLineEntry,
    theme: Theme,
    inactiveScale: number,
): MonetLineTone => {
    if (entry.status === 'active') {
        return {
            opacity: 1,
            scale: 1,
            blurPx: 0,
            baseColor: colorWithAlpha(theme.primaryColor, 0.34),
            fontWeight: 600,
            zIndex: 4,
        };
    }

    const distance = Math.max(Math.abs(entry.offset), 1);
    const isWaiting = entry.status === 'waiting';
    const scale = clamp(inactiveScale * Math.pow(0.9, distance - 1), 0.68, 0.92);

    return {
        opacity: isWaiting
            ? clamp(0.72 - (distance - 1) * 0.18, 0.36, 0.72)
            : clamp(0.52 - (distance - 1) * 0.12, 0.28, 0.52),
        scale,
        blurPx: isWaiting
            ? distance === 1 ? 0.7 : 1.8 + (distance - 2) * 0.8
            : 1.1 + (distance - 1) * 0.7,
        baseColor: colorWithAlpha(theme.primaryColor, isWaiting ? 0.46 : 0.36),
        fontWeight: 500,
        zIndex: isWaiting ? 3 - distance : 2 - distance,
    };
};

const resolveLineGap = (
    previous: PositionedMonetLineEntry,
    next: PositionedMonetLineEntry,
    lyricFontPx: number,
): number => (
    previous.status === 'active' || next.status === 'active'
        ? Math.max(MONET_ACTIVE_GAP_PX, lyricFontPx * MONET_ACTIVE_GAP_RATIO)
        : Math.max(MONET_INACTIVE_GAP_PX, lyricFontPx * MONET_INACTIVE_GAP_RATIO)
);

const resolveRailLineStatus = (lineIndex: number, activeLineIndex: number): MonetLineStatus => {
    if (lineIndex === activeLineIndex) {
        return 'active';
    }
    if (activeLineIndex >= 0 && lineIndex < activeLineIndex) {
        return 'passed';
    }
    return 'waiting';
};

export const buildScrollableRailEntries = (
    lines: Line[],
    anchorIndex: number,
    activeLineIndex: number,
): MonetVisibleLineEntry[] => {
    if (lines.length === 0) {
        return [];
    }

    const safeAnchorIndex = Math.round(clamp(anchorIndex, 0, lines.length - 1));
    const startIndex = Math.max(0, safeAnchorIndex - MONET_SCROLL_BEFORE);
    const endIndex = Math.min(lines.length - 1, safeAnchorIndex + MONET_SCROLL_AFTER);
    const nextEntries: MonetVisibleLineEntry[] = [];

    for (let index = startIndex; index <= endIndex; index += 1) {
        const line = lines[index];
        nextEntries.push({
            key: `${index}-${line.startTime}-${line.fullText}`,
            line,
            index,
            offset: index - safeAnchorIndex,
            status: resolveRailLineStatus(index, activeLineIndex),
        });
    }

    return nextEntries;
};

const trimOldestCacheEntry = <TValue,>(cache: Map<string, TValue>, limit: number) => {
    if (cache.size < limit) {
        return;
    }

    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
        cache.delete(oldestKey);
    }
};

const getOrMeasureMonetLineLayout = (
    cache: MonetLayoutCache,
    entry: MonetVisibleLineEntry,
    inputs: MonetLineLayoutInputs,
) => {
    const cacheKey = buildMonetLayoutCacheKey(entry, inputs);
    const cached = cache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const layout = measureMonetLineLayout({
        line: entry.line,
        status: entry.status,
        ...inputs,
    });
    trimOldestCacheEntry(cache, MONET_LAYOUT_CACHE_LIMIT);
    cache.set(cacheKey, layout);
    return layout;
};

export const buildPositionedEntries = (
    entries: MonetVisibleLineEntry[],
    railSize: MonetRailSize,
    theme: Theme,
    lyricFontPx: number,
    inactiveFontPx: number,
    layoutInputs: Omit<MonetLineLayoutInputs, 'fontPx' | 'maxWidthPx'>,
    glowBufferPx: number,
    layoutCache: MonetLayoutCache,
): PositionedMonetLineEntry[] => {
    const railWidth = railSize.width || MONET_RAIL_WIDTH_FALLBACK_PX;
    const railHeight = railSize.height || MONET_RAIL_HEIGHT_FALLBACK_PX;
    const inactiveScale = clamp(inactiveFontPx / Math.max(lyricFontPx, 1), 0.72, 0.92);
    const contentWidthPx = Math.max(railWidth - glowBufferPx * 2, 0);
    const measureInputs: MonetLineLayoutInputs = {
        ...layoutInputs,
        fontPx: lyricFontPx,
        maxWidthPx: contentWidthPx - 8,
    };

    const measuredEntries: PositionedMonetLineEntry[] = entries.map(entry => {
        const tone = {
            ...resolveLineTone(entry, theme, inactiveScale),
            fontWeight: layoutInputs.fontWeight,
        };
        const layout = getOrMeasureMonetLineLayout(layoutCache, entry, measureInputs);

        return {
            ...entry,
            y: 0,
            tone,
            layout,
            scaledHeight: layout.visualHeightPx * tone.scale,
        };
    });

    if (measuredEntries.length === 0) {
        return [];
    }

    const anchorIndex = Math.max(0, measuredEntries.findIndex(entry => entry.offset === 0));
    const focusCenterY = railHeight * 0.46;
    measuredEntries[anchorIndex].y = focusCenterY - measuredEntries[anchorIndex].scaledHeight / 2;

    for (let index = anchorIndex + 1; index < measuredEntries.length; index += 1) {
        const previous = measuredEntries[index - 1];
        const current = measuredEntries[index];
        current.y = previous.y + previous.scaledHeight + resolveLineGap(previous, current, lyricFontPx);
    }

    for (let index = anchorIndex - 1; index >= 0; index -= 1) {
        const current = measuredEntries[index];
        const next = measuredEntries[index + 1];
        current.y = next.y - current.scaledHeight - resolveLineGap(current, next, lyricFontPx);
    }

    return measuredEntries;
};

