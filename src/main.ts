import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import './style.css'
import App from './App.vue'
import router from './router'
import { i18n } from './i18n'
import { configureApiAuthHooks } from './api/client'
import { useAuthStore } from './stores/auth'

const app = createApp(App)
const pinia = createPinia()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

app.use(pinia)
app.use(router)
app.use(i18n)
app.use(VueQueryPlugin, { queryClient })

const authStore = useAuthStore(pinia)
authStore.initSessionLifecycle()

authStore.registerSessionExpiryHandler(() => {
  const current = router.currentRoute.value
  if (current.meta.requiresAuth) {
    void router.replace({
      name: 'login',
      query: {
        redirect: current.fullPath,
        reason: 'expired',
      },
    })
  }
})

authStore.registerStorageLogoutHandler(() => {
  const current = router.currentRoute.value
  if (current.meta.requiresAuth) {
    void router.replace({
      name: 'login',
      query: {
        redirect: current.fullPath,
        reason: 'expired',
      },
    })
  }
})

configureApiAuthHooks({
  getToken: () => authStore.token,
  ensureValidToken: () => authStore.ensureValidToken(),
  getFreshTokenFromStorage: (failedToken) => authStore.getFreshTokenFromStorage(failedToken),
  onSessionExpired: () => authStore.expireSession(),
})

app.mount('#app')
