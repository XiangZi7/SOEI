<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useMusicStore } from '../../stores/music'
import ImmersiveScene from '../visual/ImmersiveScene.vue'
import { desktop } from '../../bridge/native'
const store = useMusicStore()
onMounted(() => store.initialize('wallpaper'))
onBeforeUnmount(() => store.dispose())
</script>
<template>
  <main
    class="pointer-events-none h-screen w-screen overflow-hidden"
    :class="{ 'reduced-motion': store.preferences.reducedMotion }"
  >
    <ImmersiveScene
      wallpaper
      :preview="!desktop && !store.activeTrack"
    />
  </main>
</template>
