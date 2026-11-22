import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN'
import zhTW from './locales/zh-TW'
import en from './locales/en'
import ja from './locales/ja'
import ko from './locales/ko'
import type { SupportedLocale } from '@/api/portal'

export const SUPPORTED_LOCALES: { code: SupportedLocale; label: string }[] = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' }
]

export function detectInitialLocale(): SupportedLocale {
  if (typeof window !== 'undefined') {
    const saved = window.localStorage.getItem('LANGUAGE')
    if (saved === 'zh-CN' || saved === 'zh-TW' || saved === 'en' || saved === 'ja' || saved === 'ko') {
      return saved
    }
    const navLang = window.navigator.language || ''
    if (navLang === 'zh-CN') {
      return 'zh-CN'
    }
    if (navLang.toLowerCase().startsWith('zh')) {
      return 'zh-TW'
    }
    if (navLang.toLowerCase().startsWith('ja')) {
      return 'ja'
    }
    if (navLang.toLowerCase().startsWith('ja')) {
      return 'ko'
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
    'zh-TW': zhTW,
    en,
    ja,
    ko
  },
})
