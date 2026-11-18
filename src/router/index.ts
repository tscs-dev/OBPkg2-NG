import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    guestOnly?: boolean
  }
}

export function resolveSafeRedirect(raw: unknown): string {
  if (typeof raw !== 'string') return '/'
  const trimmed = raw.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return '/'
  }
  return trimmed
}

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
      path: '/uploaders/:id',
      name: 'uploader-detail',
      component: () => import('@/views/UploaderDetailView.vue'),
      beforeEnter(to) {
        const raw = String(to.params.id ?? '')
        if (!/^\d+$/.test(raw) || Number.parseInt(raw, 10) <= 0) {
          return { name: 'home', replace: true }
        }
        return true
      },
    },
    {
      path: '/profile',
      name: 'profile-shortcut',
      meta: { requiresAuth: true },
      redirect: () => {
        const authStore = useAuthStore()
        if (authStore.currentUserId) {
          return `/uploaders/${authStore.currentUserId}`
        }
        return { name: 'login', query: { redirect: '/profile' } }
      },
    },
    {
      path: '/auth/login',
      name: 'login',
      meta: { guestOnly: true },
      component: () => import('@/views/auth/LoginView.vue'),
    },
    {
      path: '/auth/register',
      name: 'register',
      meta: { guestOnly: true },
      component: () => import('@/views/auth/RegisterView.vue'),
    },
    {
      // Keep legacy path, as this is a part of the URL
      // the backend sends with an activation email.
      path: '/user/activate/:token',
      name: 'activate',
      component: () => import('@/views/auth/ActivateView.vue'),
    },
    {
      path: '/settings',
      component: () => import('@/views/settings/SettingsLayoutView.vue'),
      meta: { requiresAuth: true },
      redirect: '/settings/profile',
      children: [
        {
          path: 'profile',
          name: 'settings-profile',
          component: () => import('@/views/settings/SettingsProfileView.vue'),
        },
        {
          path: 'bio',
          name: 'settings-bio',
          component: () => import('@/views/settings/SettingsBioView.vue'),
        },
        {
          path: 'security',
          name: 'settings-security',
          component: () => import('@/views/settings/SettingsSecurityView.vue'),
        },
      ],
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('@/views/AboutView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

router.beforeEach((to) => {
  const authStore = useAuthStore()

  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    return {
      name: 'login',
      query: {
        redirect: to.fullPath,
      },
      replace: true,
    }
  }

  if (to.meta.guestOnly && authStore.isLoggedIn) {
    return {
      path: resolveSafeRedirect(to.query.redirect),
      replace: true,
    }
  }

  return true
})

export default router
