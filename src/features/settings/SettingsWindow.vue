<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { desktop, onNative } from '../../bridge/native'
import { useMusicStore } from '../../stores/music'
import { AppIcon, WindowTitleBar } from '../../components/ui'
import SettingsPanel from './SettingsPanel.vue'
import { settingsCategory } from './categories'

const store = useMusicStore()
const state = reactive({
  category: settingsCategory(
    new URLSearchParams(location.search).get('category')
  ),
  closing: false,
})
const cleanups: (() => void)[] = []
async function close() {
  if (state.closing) return
  state.closing = true
  const saved = await store.flushPreferences()
  if (saved && desktop) {
    try {
      await getCurrentWindow().destroy()
    } catch (error) {
      store.report(error)
    }
  }
  state.closing = false
}
function keyboard(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    void close()
  }
}
onMounted(async () => {
  window.addEventListener('keydown', keyboard)
  if (desktop) {
    cleanups.push(
      await onNative<string>('ui:settings-category', category => {
        state.category = settingsCategory(category)
      })
    )
    cleanups.push(
      await getCurrentWindow().onCloseRequested(event => {
        event.preventDefault()
        void close()
      })
    )
  }
  await store.initialize('settings')
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', keyboard)
  cleanups.forEach(cleanup => cleanup())
})
</script>

<template>
  <main
    class="flex h-dvh flex-col overflow-hidden bg-panel"
    :class="{ 'reduced-motion': store.preferences.reducedMotion }"
  >
    <WindowTitleBar
      v-if="desktop"
      title="SOEI · SETTINGS"
      @close="close"
      @error="store.report"
    />
    <SettingsPanel
      v-if="store.ready"
      windowed
      :initial-category="state.category"
      @close="close"
      @lyrics="store.importLyrics()"
    />
    <div
      v-else
      class="flex min-h-0 flex-1 items-center justify-center gap-3 text-label text-muted"
      role="status"
    >
      <AppIcon
        name="loader-circle"
        class="animate-spin"
      />正在加载设置…
    </div>
  </main>
</template>
