import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { bareApiClient, normalizeApiError } from '@/api/client'
import type { PackageSummary, TokenResponse, Uploader } from '@/types/models'

export const TOKEN_STORAGE_KEY = 'JWT_TOKEN'
export const PROFILE_STORAGE_KEY = 'PROFILE'
const REFRESH_WINDOW_MS = 10 * 60 * 1000
const WEB_LOCK_NAME = 'obpkg-jwt-refresh'

export interface JwtPayload {
  exp?: number
  uid?: number
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const base64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join(''),
    )
    return JSON.parse(json) as JwtPayload
  } catch {
    return null
  }
}

export function getTokenExpiryMs(token: string | null): number | null {
  if (!token) return null
  const payload = decodeJwtPayload(token)
  if (!payload || typeof payload.exp !== 'number') return null
  return payload.exp * 1000
}

export function isTokenExpired(token: string | null, now = Date.now()): boolean {
  const expMs = getTokenExpiryMs(token)
  if (expMs === null) return true
  return expMs <= now
}

export function isTokenInRefreshWindow(token: string | null, now = Date.now()): boolean {
  const expMs = getTokenExpiryMs(token)
  if (expMs === null) return false
  const remaining = expMs - now
  return remaining > 0 && remaining <= REFRESH_WINDOW_MS
}

function sanitizeStoredProfile(raw: Uploader): Uploader {
  const cloned = JSON.parse(JSON.stringify(raw)) as Uploader & { Packages?: unknown }
  delete cloned.Description
  delete cloned.Packages
  return cloned
}

function readStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TOKEN_STORAGE_KEY)
}

function isValidProfile(obj: unknown): obj is Uploader {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'ID' in obj &&
    typeof (obj as any).ID === 'number' &&
    Number.isInteger((obj as any).ID) &&
    (obj as any).ID > 0
  )
}

function readStoredProfile(): Uploader | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return isValidProfile(parsed) ? parsed : null
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(readStoredToken())
  const profile = ref<Uploader | null>(readStoredProfile())
  const sessionExpiredNotice = ref(false)

  let inFlightRefresh: Promise<string | null> | null = null
  let refreshTimerId: number | null = null
  let lifecycleBound = false
  let sessionExpiryHandler: (() => void) | null = null
  let storageLogoutHandler: (() => void) | null = null

  const isLoggedIn = computed(() => {
    if (!token.value || !profile.value) return false
    return !isTokenExpired(token.value)
  })

  const privilege = computed(() => (isLoggedIn.value ? (profile.value?.Privilege ?? -1) : -1))
  const currentUserId = computed(() => (isLoggedIn.value ? (profile.value?.ID ?? null) : null))

  function clearRefreshTimer() {
    if (refreshTimerId !== null && typeof window !== 'undefined') {
      window.clearTimeout(refreshTimerId)
      refreshTimerId = null
    }
  }

  function scheduleProactiveRefresh() {
    clearRefreshTimer()
    if (typeof window === 'undefined') return
    const expMs = getTokenExpiryMs(token.value)
    if (expMs === null) return

    const now = Date.now()
    if (expMs <= now) return

    const triggerAt = expMs - REFRESH_WINDOW_MS
    const delay = Math.max(0, triggerAt - now)
    // setTimeout 最大安全延迟约 24.8 天
    const cappedDelay = Math.min(delay, 2_000_000_000)
    refreshTimerId = window.setTimeout(() => {
      if (isTokenExpired(token.value)) {
        expireSession()
      } else if (isTokenInRefreshWindow(token.value)) {
        void ensureValidToken()
      } else {
        scheduleProactiveRefresh()
      }
    }, cappedDelay)
  }

  function persistToken(nextToken: string) {
    token.value = nextToken
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, nextToken)
    }
    scheduleProactiveRefresh()
  }

  function setSession(nextToken: string, nextProfile: Uploader) {
    const cleanProfile = sanitizeStoredProfile(nextProfile)
    token.value = nextToken
    profile.value = cleanProfile
    sessionExpiredNotice.value = false
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, nextToken)
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(cleanProfile))
    }
    scheduleProactiveRefresh()
  }

  function updateProfile(nextProfile: Uploader) {
    const cleanProfile = sanitizeStoredProfile(nextProfile)
    profile.value = cleanProfile
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(cleanProfile))
    }
  }

  function clearCredentials(showExpiredNotice = false) {
    clearRefreshTimer()
    token.value = null
    profile.value = null
    sessionExpiredNotice.value = showExpiredNotice
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY)
      window.localStorage.removeItem(PROFILE_STORAGE_KEY)
    }
  }

  function logout() {
    clearCredentials(false)
  }

  function expireSession() {
    const hadSession = Boolean(token.value || profile.value)
    clearCredentials(hadSession)
    if (hadSession) {
      sessionExpiryHandler?.()
    }
  }

  function dismissExpiredNotice() {
    sessionExpiredNotice.value = false
  }

  function registerSessionExpiryHandler(handler: () => void) {
    sessionExpiryHandler = handler
  }

  function registerStorageLogoutHandler(handler: () => void) {
    storageLogoutHandler = handler
  }

  function getFreshTokenFromStorage(failedToken: string | null): string | null {
    const stored = readStoredToken()
    if (!stored || stored === failedToken) return null
    if (isTokenExpired(stored)) return null
    if (stored !== token.value) {
      token.value = stored
      scheduleProactiveRefresh()
    }
    return stored
  }

  async function executeRefreshUnderLock(): Promise<string | null> {
    const perform = async (): Promise<string | null> => {
      // 获取锁后重读 localStorage，避免其他标签页已刷新后重复请求
      const latestStored = readStoredToken()
      if (!latestStored) {
        clearCredentials(false)
        return null
      }
      if (isTokenExpired(latestStored)) {
        expireSession()
        return null
      }
      if (!isTokenInRefreshWindow(latestStored)) {
        if (latestStored !== token.value) {
          token.value = latestStored
          scheduleProactiveRefresh()
        }
        return latestStored
      }

      try {
        const res = await bareApiClient<TokenResponse>('/auth/refresh_token', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${latestStored}`,
          },
        })
        // await 后重读 storage，防止其他标签页登出/切换账号
        const currentStored = readStoredToken()
        if (currentStored !== latestStored) {
          return currentStored
        }
        if (res?.token) {
          persistToken(res.token)
          return res.token
        }
        scheduleProactiveRefresh()
        return latestStored
      } catch (err) {
        const currentStored = readStoredToken()
        if (currentStored !== latestStored) {
          return currentStored
        }
        const apiErr = normalizeApiError(err)
        if (apiErr.status === 401 || apiErr.code === 211) {
          expireSession()
          return null
        }
        // 网络/5xx 错误：保留未过期的 token，重新排定刷新
        if (!isTokenExpired(latestStored)) {
          scheduleProactiveRefresh()
          return latestStored
        }
        return null
      }
    }

    if (typeof navigator !== 'undefined' && navigator.locks?.request) {
      return navigator.locks.request(WEB_LOCK_NAME, perform)
    }
    return perform()
  }

  function hasValidProfileInMemoryOrStorage(): boolean {
    return isValidProfile(profile.value) || isValidProfile(readStoredProfile())
  }

  async function ensureValidToken(): Promise<string | null> {
    const current = token.value ?? readStoredToken()
    if (!current) return null

    if (isTokenExpired(current)) {
      expireSession()
      return null
    }

    if (!hasValidProfileInMemoryOrStorage()) {
      clearCredentials(false)
      return null
    }

    if (!isTokenInRefreshWindow(current)) {
      return current
    }

    if (!inFlightRefresh) {
      inFlightRefresh = executeRefreshUnderLock().finally(() => {
        inFlightRefresh = null
      })
    }

    return inFlightRefresh
  }

  function syncFromStorageEvent(event: StorageEvent) {
    if (event.key === TOKEN_STORAGE_KEY) {
      const nextToken = event.newValue
      if (!nextToken) {
        clearRefreshTimer()
        token.value = null
        profile.value = null
        storageLogoutHandler?.()
      } else {
        token.value = nextToken
        sessionExpiredNotice.value = false
        const storedProfile = readStoredProfile()
        if (storedProfile) {
          profile.value = storedProfile
        }
        scheduleProactiveRefresh()
      }
    } else if (event.key === PROFILE_STORAGE_KEY) {
      if (!event.newValue) {
        profile.value = null
      } else {
        const parsed = readStoredProfile()
        profile.value = parsed
      }
    } else if (event.key === null) {
      clearRefreshTimer()
      token.value = null
      profile.value = null
      storageLogoutHandler?.()
    }
  }

  function initSessionLifecycle() {
    if (typeof window === 'undefined' || lifecycleBound) return
    lifecycleBound = true

    if (token.value) {
      if (isTokenExpired(token.value)) {
        clearCredentials(false)
      } else if (!hasValidProfileInMemoryOrStorage()) {
        clearCredentials(false)
      } else if (isTokenInRefreshWindow(token.value)) {
        void ensureValidToken()
      } else {
        scheduleProactiveRefresh()
      }
    }

    window.addEventListener('storage', syncFromStorageEvent)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && token.value) {
        if (isTokenExpired(token.value)) {
          expireSession()
        } else if (!hasValidProfileInMemoryOrStorage()) {
          clearCredentials(false)
        } else if (isTokenInRefreshWindow(token.value)) {
          void ensureValidToken()
        } else {
          scheduleProactiveRefresh()
        }
      }
    })
  }

  function canEditPackage(pkg: Pick<PackageSummary, 'UploaderID'>): boolean {
    if (!isLoggedIn.value || !profile.value) return false
    return privilege.value >= 50 || profile.value.ID === pkg.UploaderID
  }

  function canEditUploader(targetUploaderId: number): boolean {
    if (!isLoggedIn.value || !profile.value) return false
    return privilege.value >= 50 || profile.value.ID === targetUploaderId
  }

  return {
    token,
    profile,
    isLoggedIn,
    privilege,
    currentUserId,
    sessionExpiredNotice,
    setSession,
    updateProfile,
    logout,
    expireSession,
    dismissExpiredNotice,
    registerSessionExpiryHandler,
    registerStorageLogoutHandler,
    getFreshTokenFromStorage,
    ensureValidToken,
    initSessionLifecycle,
    canEditPackage,
    canEditUploader,
  }
})
