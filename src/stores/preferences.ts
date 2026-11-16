import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { i18n } from '@/i18n'
import type { SupportedLocale } from '@/api/portal'
import type { String3 } from '@/types/models'

export const usePreferencesStore = defineStore('preferences', () => {
  const locale = ref<SupportedLocale>(i18n.global.locale.value as SupportedLocale)
  // 与旧版保持一致：preferEnglishName 不持久化，每次页面刷新重置为 false
  const preferEnglishName = ref(false)

  watch(
    locale,
    (nextLocale) => {
      i18n.global.locale.value = nextLocale
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('LANGUAGE', nextLocale)
        document.documentElement.lang = nextLocale
      }
    },
    { immediate: true },
  )

  function setLocale(next: SupportedLocale) {
    locale.value = next
  }

  function toggleEnglishName() {
    preferEnglishName.value = !preferEnglishName.value
  }

  function setEnglishName(val: boolean) {
    preferEnglishName.value = val
  }

  function formatS3(s3?: String3 | null): string {
    if (!s3) return ''
    const local = s3.Local?.trim() ?? ''
    const english = s3.English?.trim() ?? ''
    if (local && english) {
      return preferEnglishName.value ? english : local
    }
    return english || local || ''
  }

  function formatSecondaryS3(s3?: String3 | null, identifier?: string): string {
    if (!s3) return ''
    const local = s3.Local?.trim() ?? ''
    const english = s3.English?.trim() ?? ''
    if (!local || !english) return ''
    const primary = preferEnglishName.value ? english : local
    const secondary = preferEnglishName.value ? local : english
    if (!secondary || secondary === primary) return ''
    if (identifier && secondary === identifier.trim()) return ''
    return secondary
  }

  return {
    locale,
    preferEnglishName,
    setLocale,
    toggleEnglishName,
    setEnglishName,
    formatS3,
    formatSecondaryS3,
  }
})
