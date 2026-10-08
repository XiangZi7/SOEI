<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount } from 'vue'
import { useMusicStore } from './stores/music'
import WallpaperView from './features/wallpaper/WallpaperView.vue'
import { desktop } from './bridge/native'
import { getCurrentWindow } from '@tauri-apps/api/window'
const SettingsWindow = defineAsyncComponent(
  () => import('./features/settings/SettingsWindow.vue')
)
const settings =
  new URLSearchParams(location.search).has('settings') ||
  (desktop && getCurrentWindow().label === 'settings')
const wallpaper =
  new URLSearchParams(location.search).has('wallpaper') ||
  (desktop && getCurrentWindow().label.startsWith('wallpaper-'))
const store = useMusicStore()
const dispose = () => store.dispose()
window.addEventListener('beforeunload', dispose, { once: true })
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', dispose)
  dispose()
})
</script>
<template>
  <SettingsWindow v-if="settings" /><WallpaperView
    v-else-if="wallpaper"
  /><RouterView v-else />
</template>
