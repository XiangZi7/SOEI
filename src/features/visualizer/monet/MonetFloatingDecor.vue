<script setup lang="ts">
import { computed } from 'vue'
import { useDocumentVisibility } from '@vueuse/core'
import type { Theme } from '../../theme/model'
import { colorWithAlpha } from '../../theme/colorMath'
import { AppIcon } from '../../../components/ui'
import iconCatalog from '../../../components/ui/icons.json'
import { buildMonetParticles } from './monetParticles'
const props = defineProps<{
  theme: Theme
  staticMode?: boolean
  paused?: boolean
}>()
const visibility = useDocumentVisibility()
const particles = computed(() =>
  buildMonetParticles(
    (props.theme.lyricsIcons ?? []).filter(name =>
      Object.prototype.hasOwnProperty.call(iconCatalog, name)
    )
  )
)
</script>
<template>
  <div
    class="pointer-events-none absolute inset-0 overflow-hidden"
    :class="{ 'is-frozen': staticMode || paused || visibility === 'hidden' }"
    aria-hidden="true"
  >
    <div
      v-for="particle in particles"
      :key="particle.id"
      class="monet-particle"
      :style="{
        left: particle.x + '%',
        top: particle.y + '%',
        opacity: particle.opacity,
        '--duration': particle.duration + 's',
        '--delay': particle.delay + 's',
        '--rotation': particle.rotation + 'deg',
        '--direction': particle.reverse ? -1 : 1,
      }"
    >
      <AppIcon
        v-if="particle.iconName"
        :name="particle.iconName as keyof typeof iconCatalog"
        :size="particle.size"
        :style="{ color: theme.secondaryColor }"
      />
      <svg
        v-else
        :width="particle.size"
        :height="particle.size"
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M12 3C14.5 5.5 16.8 9 16 14C15.2 19 13.5 21 12 21C10.5 21 8.8 19 8 14C7.2 9 9.5 5.5 12 3Z"
          :fill="colorWithAlpha(theme.secondaryColor, 0.55)"
        />
        <path
          d="M12 6C12 6 11.3 10.5 11.3 14.5C11.3 17.5 12 20 12 20"
          :stroke="colorWithAlpha(theme.secondaryColor, 0.2)"
          stroke-width="0.45"
        />
      </svg>
    </div>
  </div>
</template>
<style scoped>
.monet-particle {
  position: absolute;
  animation: petal-drift var(--duration) ease-in-out var(--delay) infinite;
}
.is-frozen .monet-particle {
  animation-play-state: paused;
}
@keyframes petal-drift {
  0%,
  100% {
    transform: translate(
        calc(-15px * var(--direction)),
        calc(40px * var(--direction))
      )
      rotate(var(--rotation));
  }
  25% {
    transform: translate(
        calc(25px * var(--direction)),
        calc(-60px * var(--direction))
      )
      rotate(calc(var(--rotation) + 120deg * var(--direction)));
  }
  50% {
    transform: translate(
        calc(-10px * var(--direction)),
        calc(20px * var(--direction))
      )
      rotate(calc(var(--rotation) + 60deg * var(--direction)));
  }
  75% {
    transform: translate(
        calc(20px * var(--direction)),
        calc(-40px * var(--direction))
      )
      rotate(calc(var(--rotation) + 180deg * var(--direction)));
  }
}
</style>
