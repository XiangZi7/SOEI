<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useMusicStore } from '../../stores/music'
import ImmersiveScene from '../visual/ImmersiveScene.vue'
const store = useMusicStore()
onMounted(() => store.initialize(true))
onBeforeUnmount(() => store.dispose())
</script>
<template>
  <main
    class="wallpaper-view"
    :class="{ 'reduced-motion': store.preferences.reducedMotion }"
  >
    <ImmersiveScene wallpaper />
  </main>
</template>
<style scoped>
.wallpaper-view {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  pointer-events: none;
}
</style>
