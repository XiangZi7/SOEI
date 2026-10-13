<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useMediaQuery } from '@vueuse/core'
import { useMusicStore } from '../../stores/music'
import { AppIcon, UiButton, UiIconButton } from '../../components/ui'
import type { LibraryTab } from '../../types/music'
import type icons from '../../components/ui/icons.json'

type NavigationId = LibraryTab | 'recent' | 'favorites'

const collapsed = defineModel<boolean>('collapsed', { default: false })
const emit = defineEmits<{ import: []; scene: [] }>()
const store = useMusicStore()
const { tab, recentOnly, favoritesOnly, realTracks, activeTrack } =
  storeToRefs(store)

const navigation: {
  id: NavigationId
  title: string
  label: string
  icon: keyof typeof icons
}[] = [
  { id: 'all', title: '所有歌曲', label: '所有歌曲', icon: 'library' },
  { id: 'recent', title: '最近播放', label: '最近播放', icon: 'clock-3' },
  { id: 'favorites', title: '收藏', label: '收藏', icon: 'heart' },
  { id: 'albums', title: '专辑', label: '专辑', icon: 'disc-3' },
  { id: 'artists', title: '歌手', label: '歌手', icon: 'users' },
  { id: 'playlists', title: '播放列表', label: '播放列表', icon: 'list-music' },
]

function active(id: NavigationId) {
  if (id === 'recent') return recentOnly.value
  if (id === 'favorites') return favoritesOnly.value
  return tab.value === id && !recentOnly.value && !favoritesOnly.value
}
function navigate(id: NavigationId) {
  store.recentOnly = id === 'recent'
  store.favoritesOnly = id === 'favorites'
  store.tab = id === 'recent' || id === 'favorites' ? 'all' : id
}
const count = computed(() => realTracks.value.length)
// 窄窗口强制折叠。渲染只读 folded 这一个真源，否则 CSS 隐藏文字而模板仍渲染宽按钮，
// 64px 的侧栏会被撑开。
const narrow = useMediaQuery('(max-width: 860px)')
const folded = computed(() => collapsed.value || narrow.value)
</script>

<template>
  <nav
    class="app-sidebar chrome-surface"
    :class="{ 'is-collapsed': folded }"
    aria-label="音乐库导航"
  >
    <button
      class="sidebar-wordmark"
      :aria-label="folded ? '展开侧栏' : '折叠侧栏'"
      :title="folded ? '展开侧栏' : '折叠侧栏'"
      :disabled="narrow"
      @click="collapsed = !collapsed"
    >
      <AppIcon
        name="panel-left"
        :size="16"
      />
      <span
        v-if="!folded"
        class="sidebar-wordmark-text"
        >MUSIC</span
      >
    </button>

    <ul class="sidebar-list">
      <li
        v-for="item in navigation"
        :key="item.id"
      >
        <button
          class="sidebar-link"
          :class="{ 'is-active': active(item.id) }"
          :aria-label="item.label"
          :title="folded ? item.label : undefined"
          :aria-current="active(item.id) ? 'page' : undefined"
          @click="navigate(item.id)"
        >
          <span
            class="sidebar-rail"
            aria-hidden="true"
          />
          <AppIcon
            :name="item.icon"
            :size="15"
          />
          <span
            v-if="!folded"
            class="sidebar-link-text truncate-text"
            >{{ item.title }}</span
          >
        </button>
      </li>
    </ul>

    <div class="sidebar-foot">
      <UiButton
        v-if="!folded"
        variant="ghost"
        class="sidebar-action"
        aria-label="导入音乐"
        @click="emit('import')"
        ><AppIcon
          name="plus"
          :size="14"
        /><span>导入音乐</span></UiButton
      >
      <UiIconButton
        v-else
        icon="plus"
        label="导入音乐"
        class="sidebar-icon-action"
        :icon-size="15"
        @click="emit('import')"
      />
      <UiButton
        v-if="!folded"
        variant="ghost"
        class="sidebar-action"
        :disabled="!activeTrack"
        aria-label="进入歌词舞台"
        @click="emit('scene')"
        ><AppIcon
          name="audio-lines"
          :size="14"
        /><span>歌词舞台</span></UiButton
      >
      <UiIconButton
        v-else
        icon="audio-lines"
        label="歌词舞台"
        class="sidebar-icon-action"
        :disabled="!activeTrack"
        :icon-size="15"
        @click="emit('scene')"
      />
      <p
        v-if="!folded"
        class="sidebar-count"
      >
        {{ count.toString().padStart(2, '0') }} TRACKS
      </p>
    </div>
  </nav>
</template>

<style scoped>
.app-sidebar {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: var(--spacing-sidebar);
  border-right: 1px solid var(--glass-line);
  transition: width var(--motion-controls) var(--ease-scene);
}
.app-sidebar.is-collapsed {
  width: var(--spacing-sidebar-collapsed);
}
.sidebar-wordmark {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 12px;
  height: 56px;
  padding-inline: 20px;
  color: var(--color-muted);
  transition: color var(--motion-hover);
}
.is-collapsed .sidebar-wordmark {
  justify-content: center;
  padding-inline: 0;
}
.sidebar-wordmark:hover {
  color: var(--color-ink);
}
.sidebar-wordmark-text {
  font-family: var(--font-display);
  font-size: 17px;
  letter-spacing: 0.14em;
  color: var(--theme-primary, var(--color-ink));
}
.sidebar-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  margin: 0;
  padding: 6px 10px;
  list-style: none;
}
.is-collapsed .sidebar-list {
  padding-inline: 8px;
}
.sidebar-link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  min-height: 38px;
  padding-inline: 11px;
  border-radius: var(--radius-input);
  font-size: 13px;
  letter-spacing: 0.04em;
  color: var(--color-muted);
  transition:
    background var(--motion-hover),
    color var(--motion-hover);
}
.is-collapsed .sidebar-link {
  justify-content: center;
  padding-inline: 0;
}
.sidebar-link:hover {
  background: var(--color-hover);
  color: var(--color-ink);
}
.sidebar-link.is-active {
  background: var(--theme-surface, var(--color-hover));
  color: var(--theme-primary, var(--color-ink));
}
/* 选中态的左侧色条跟随封面点缀色。 */
.sidebar-rail {
  position: absolute;
  top: 50%;
  left: 0;
  width: 2px;
  height: 0;
  border-radius: 0 2px 2px 0;
  background: var(--theme-accent, var(--color-accent));
  transform: translateY(-50%);
  transition:
    height var(--motion-controls) var(--ease-scene),
    background var(--motion-ambient);
}
.sidebar-link.is-active .sidebar-rail {
  height: 17px;
}
.sidebar-foot {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: 2px;
  padding: 10px;
  border-top: 1px solid var(--glass-line);
}
.is-collapsed .sidebar-foot {
  align-items: center;
}
.sidebar-action {
  justify-content: flex-start;
  min-height: 34px;
  padding-inline: 11px;
  font-size: 12px;
  color: var(--color-muted);
}
.sidebar-action:hover {
  color: var(--color-ink);
}
.sidebar-icon-action {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-input);
}
.sidebar-count {
  margin: 8px 0 2px 11px;
  font-family: var(--font-display);
  font-size: 9px;
  letter-spacing: 0.18em;
  color: var(--color-faint);
}
</style>
