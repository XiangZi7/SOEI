import { createRouter, createWebHistory } from 'vue-router'
import MusicSpace from './features/library/MusicSpace.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: MusicSpace },
    { path: '/ui', component: () => import('./components/ui/UiShowcase.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
