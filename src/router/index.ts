import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    guestOnly?: boolean
    minPrivilege?: number
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
      path: '/packages/new',
      component: () => import('@/views/package-edit/PackageEditLayoutView.vue'),
      meta: { requiresAuth: true, minPrivilege: 0 },
      children: [
        {
          path: '',
          name: 'package-new',
          component: () => import('@/views/package-edit/PackageEditInfoView.vue'),
        },
      ],
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
      path: '/packages/:id/edit',
      component: () => import('@/views/package-edit/PackageEditLayoutView.vue'),
      meta: { requiresAuth: true },
      redirect: (to) => `/packages/${to.params.id}/edit/info`,
      beforeEnter(to) {
        const raw = String(to.params.id ?? '')
        if (!/^\d+$/.test(raw) || Number.parseInt(raw, 10) <= 0) {
          return { name: 'packages', replace: true }
        }
        return true
      },
      children: [
        {
          path: 'info',
          name: 'package-edit-info',
          component: () => import('@/views/package-edit/PackageEditInfoView.vue'),
        },
        {
          path: 'gallery',
          name: 'package-edit-gallery',
          component: () => import('@/views/package-edit/PackageEditGalleryView.vue'),
        },
        {
          path: 'description',
          name: 'package-edit-description',
          component: () => import('@/views/package-edit/PackageEditDescriptionView.vue'),
        },
        {
          path: 'versions',
          name: 'package-edit-versions',
          component: () => import('@/views/package-edit/PackageEditVersionsView.vue'),
        },
        {
          path: 'versions/new',
          name: 'package-edit-version-new',
          component: () => import('@/views/package-edit/PackageEditVersionFormView.vue'),
        },
        {
          path: 'versions/:fileId',
          name: 'package-edit-version-edit',
          component: () => import('@/views/package-edit/PackageEditVersionFormView.vue'),
        },
      ],
    },
    {
      path: '/admin/files',
      name: 'admin-files',
      meta: { requiresAuth: true, minPrivilege: 10 },
      component: () => import('@/views/admin/AdminFileListView.vue'),
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
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
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

  if (typeof to.meta.minPrivilege === 'number' && authStore.privilege < to.meta.minPrivilege) {
    return { name: 'home', replace: true }
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
