<script setup lang="ts">
import type { SceneLayout } from '../../types/music'
import { reactive, watch } from 'vue'
const props = defineProps<{
  layout: SceneLayout
  variant: number
  animated: boolean
}>()
const state = reactive({
  // 已启动的装饰在暂停时保留当前姿态，新建的静态分镜直接显示完成态。
  started: props.animated,
})
watch(
  () => [props.layout, props.variant, props.animated] as const,
  (value, previous) => {
    if (value[0] !== previous[0] || value[1] !== previous[1])
      state.started = value[2]
    else if (value[2]) state.started = true
  }
)
</script>

<template>
  <div
    class="absolute inset-0 overflow-hidden"
    :class="{
      'illustration-still': !state.started,
      'illustration-paused': state.started && !animated,
    }"
    aria-hidden="true"
  >
    <div
      v-if="layout === 'collage' || layout === 'montage'"
      :key="`plate-${layout}-${variant}`"
      class="scene-plate absolute top-[18%] -right-[8%] h-[55%] w-[52%] -rotate-12 bg-stage-gold/8"
      :class="
        variant % 3 === 0
          ? 'rounded-[50%]'
          : variant % 3 === 1
            ? 'border border-stage-gold/25 bg-transparent!'
            : 'top-[10%]! right-[16%]! h-[80%]! w-[24%]! rotate-12!'
      "
    />
    <div
      v-if="layout === 'manuscript' || layout === 'montage'"
      class="absolute inset-0 bg-[radial-gradient(#b9c5d51a_.6px,transparent_.6px)] bg-size-[5px_5px] opacity-25"
    />
    <svg
      :key="`${layout}-${variant}`"
      class="stage-illustration absolute inset-0 size-full text-stage-gold"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
    >
      <g
        v-if="layout === 'echo' || layout === 'title'"
        class="illustration-orbit origin-center stroke-current opacity-18"
        stroke-width="1"
      >
        <circle
          cx="720"
          cy="435"
          :r="200 + variant * 14"
        />
        <circle
          cx="720"
          cy="435"
          :r="270 + variant * 11"
          stroke-dasharray="2 15"
        />
        <path d="M390 435H440M1000 435H1050M720 105V155M720 715V765" />
      </g>
      <g
        v-else-if="variant % 3 === 0"
        class="stroke-current opacity-25"
        stroke-width="1.2"
        stroke-linecap="round"
      >
        <path
          class="illustration-ink"
          pathLength="100"
          d="M80 590C190 690 340 550 286 480S150 517 266 602C620 860 731 68 1090 174S1240 600 1390 320"
        />
        <path
          class="illustration-ink"
          pathLength="100"
          d="m1200 226 10-42 28 32m-972 483 32-10-17-23"
        />
        <path
          d="m1170 520 6 21 22 5-22 5-6 21-5-21-22-5 22-5Zm-910-292 5 17 18 4-18 5-5 17-4-17-18-5 18-4Z"
        />
        <circle
          cx="1140"
          cy="580"
          r="4"
          fill="currentColor"
          stroke="none"
        />
      </g>
      <g
        v-else-if="variant % 3 === 1"
        class="stroke-current opacity-22"
        stroke-width="1.2"
        stroke-linecap="round"
      >
        <path
          class="illustration-ink"
          pathLength="100"
          d="M415 190C230 110 240 695 775 716S1240 405 1100 228C953 70 510 38 403 306"
        />
        <path
          class="illustration-ink"
          pathLength="100"
          d="M399 208C292 80 202 429 367 610M965 734C1130 710 1249 567 1237 450"
        />
        <path d="M226 235V289M199 262H254M1190 678V714M1173 696H1208" />
        <circle
          cx="1130"
          cy="224"
          r="5"
          fill="currentColor"
          stroke="none"
        />
      </g>
      <g
        v-else
        class="stroke-current opacity-24"
        stroke-width="1.2"
        stroke-linecap="round"
      >
        <path
          class="illustration-ink"
          pathLength="100"
          d="M176 180H315M176 180V330M1125 640V744H1250M144 747C500 660 879 806 1273 179"
        />
        <path
          d="m1160 195 11 31 30 11-30 11-11 31-11-31-30-11 30-11Zm-900 451 8 24 24 8-24 8-8 24-8-24-24-8 24-8Z"
        />
        <path
          class="illustration-ink"
          pathLength="100"
          d="M302 714l50-10m-27-6 29-10m-13 17 29-10"
        />
      </g>
      <g
        v-if="layout === 'montage'"
        class="stroke-current opacity-20"
        stroke-width="1"
      >
        <path
          d="M65 85H145M65 85V150M1375 85H1295M1375 85V150M65 815H145M65 815V750M1375 815H1295M1375 815V750"
        />
        <path
          d="M1270 290V520M1282 300V510M1293 320V530M1301 310V500M1312 300V540"
        />
      </g>
    </svg>
  </div>
</template>

<style scoped>
/* 路径描画与环形运动无法由布局工具类表达，暂停状态统一冻结。 */
.illustration-ink {
  animation: ink-reveal 1.6s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.illustration-orbit {
  animation: orbit-turn 90s linear infinite;
}
.scene-plate {
  animation: plate-reveal 1.1s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.illustration-still * {
  animation: none;
}
.illustration-paused * {
  animation-play-state: paused;
}
@keyframes ink-reveal {
  from {
    stroke-dasharray: 100;
    stroke-dashoffset: 100;
  }
  to {
    stroke-dasharray: 100;
    stroke-dashoffset: 0;
  }
}
@keyframes orbit-turn {
  to {
    transform: rotate(360deg);
  }
}
@keyframes plate-reveal {
  from {
    opacity: 0;
    translate: 25px 15px;
  }
  to {
    opacity: 1;
    translate: 0 0;
  }
}
</style>
