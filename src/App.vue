<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { useMusicStore } from './stores/music'
import WallpaperView from './features/wallpaper/WallpaperView.vue'
const wallpaper = new URLSearchParams(location.search).has('wallpaper')
const store = useMusicStore()
const dispose = () => store.dispose()
window.addEventListener('beforeunload', dispose, { once: true })
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', dispose)
  dispose()
})
</script>
<template><WallpaperView v-if="wallpaper" /><RouterView v-else /></template>
