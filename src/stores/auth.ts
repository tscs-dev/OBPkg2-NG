import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { PackageSummary, Uploader } from '@/types/models'

function decodeJwtPayload(token: string): { exp?: number; uid?: number } | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const base64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join(''),
    )
    return JSON.parse(json) as { exp?: number; uid?: number }
  } catch {
    return null
  }
}

function readStoredProfile(): Uploader | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem('PROFILE')
    return raw ? (JSON.parse(raw) as Uploader) : null
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(
    typeof window !== 'undefined' ? window.localStorage.getItem('JWT_TOKEN') : null,
  )
  const profile = ref<Uploader | null>(readStoredProfile())

  const isLoggedIn = computed(() => {
    if (!token.value) return false
    const payload = decodeJwtPayload(token.value)
    if (payload?.exp && payload.exp * 1000 <= Date.now()) {
      return false
    }
    return Boolean(profile.value)
  })

  const privilege = computed(() => profile.value?.Privilege ?? -1)

  function setSession(nextToken: string, nextProfile: Uploader) {
    token.value = nextToken
    profile.value = nextProfile
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('JWT_TOKEN', nextToken)
      window.localStorage.setItem('PROFILE', JSON.stringify(nextProfile))
    }
  }

  function logout() {
    token.value = null
    profile.value = null
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('JWT_TOKEN')
      window.localStorage.removeItem('PROFILE')
    }
  }

  function canEditPackage(pkg: Pick<PackageSummary, 'UploaderID'>): boolean {
    if (!isLoggedIn.value || !profile.value) return false
    return privilege.value >= 50 || profile.value.ID === pkg.UploaderID
  }

  return {
    token,
    profile,
    isLoggedIn,
    privilege,
    setSession,
    logout,
    canEditPackage,
  }
})
