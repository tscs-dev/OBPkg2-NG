import { ofetch } from 'ofetch'
import { ENV } from '@/config/env'
import type { SiteStats } from '@/types/models'
import { sanitizeWikiHtml } from '@/utils/sanitize'

export type SupportedLocale = 'zh-CN' | 'zh-TW' | 'en' | 'ja' | 'ko'

export function buildWikiDocUrl(locale: SupportedLocale, topic: string): string {
  const root = ENV.docRootUrl.replace(/\/+$/, '')
  if (locale.startsWith('zh')) {
    return `${root}/bcs-doc:${topic}`
  }
  return `${root}/${locale}:bcs-doc:${topic}`
}

export interface WikiDocResult {
  html: string
  sourceUrl: string
  isEmpty: boolean
}

export async function fetchWikiDoc(
  locale: SupportedLocale,
  topic: string,
  signal?: AbortSignal,
): Promise<WikiDocResult> {
  const sourceUrl = buildWikiDocUrl(locale, topic)
  const exportUrl = `${sourceUrl}?do=export_xhtmlbody`

  const rawHtml = await ofetch<string>(exportUrl, {
    parseResponse: (txt) => txt,
    timeout: 45_000,
    signal,
  })

  const html = sanitizeWikiHtml(rawHtml)
  return {
    html,
    sourceUrl,
    isEmpty: html.length === 0,
  }
}

export async function fetchSiteStats(signal?: AbortSignal): Promise<SiteStats> {
  // statapi.php 返回 Content-Type: text/html，用 parseResponse 确保转为 JSON
  return ofetch<SiteStats>(ENV.statsUrl, {
    timeout: 20_000,
    signal,
    parseResponse: (txt) => JSON.parse(txt) as SiteStats,
  })
}
