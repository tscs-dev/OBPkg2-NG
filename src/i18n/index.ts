import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN'
import en from './locales/en'
import ja from './locales/ja'
import type { SupportedLocale } from '@/api/portal'

export const SUPPORTED_LOCALES: { code: SupportedLocale; label: string }[] = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
]

export function detectInitialLocale(): SupportedLocale {
  if (typeof window !== 'undefined') {
    const saved = window.localStorage.getItem('LANGUAGE')
    if (saved === 'zh-CN' || saved === 'en' || saved === 'ja') {
      return saved
    }
    const navLang = window.navigator.language || ''
    if (navLang === 'zh-CN' || navLang.toLowerCase().startsWith('zh')) {
      return 'zh-CN'
    }
    if (navLang === 'ja' || navLang.toLowerCase().startsWith('ja')) {
      return 'ja'
    }
    if (navLang === 'en' || navLang.toLowerCase().startsWith('en')) {
      return 'en'
    }
  }
  return 'en'
}

export const i18n = createI18n({
  legacy: false,
  locale: detectInitialLocale(),
  fallbackLocale: 'en',
  messages: {
    'zh-CN': zhCN,
    en,
    ja,
  },
})
