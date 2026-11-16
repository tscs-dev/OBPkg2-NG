import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }
    if (to.path === from.path) {
      return false
    }
    return { top: 0 }
  },
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      path: '/packages',
      name: 'packages',
      component: () => import('@/views/PackageListView.vue'),
    },
    {
      path: '/packages/:id',
      name: 'package-detail',
      component: () => import('@/views/PackageDetailView.vue'),
      beforeEnter(to) {
        const raw = String(to.params.id ?? '')
        if (!/^\d+$/.test(raw) || Number.parseInt(raw, 10) <= 0) {
          return { name: 'packages', replace: true }
        }
        return true
      },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

export default router
