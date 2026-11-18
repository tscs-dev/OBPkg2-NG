import { hasTrimIssues } from './string3'

const IDENTIFIER_REGEX = /^[a-zA-Z0-9- ]*$/
const VERSION_REGEX = /^\d+(\.\d+){1,3}$/
const SIZE_REGEX = /^\d+(\.\d+)?\s(B|KB|MB|GB|TB)$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * 将字节数格式化为 "数字 单位"（保留两位小数，自适应 B/KB/MB/GB/TB）
 */
export function formatBytesToPackageSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0.00 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const
  let value = bytes
  let unitIdx = 0
  while (value >= 1024 && unitIdx < units.length - 1) {
    value /= 1024
    unitIdx += 1
  }
  return `${value.toFixed(2)} ${units[unitIdx]}`
}

/**
 * 确保路径以单个前导 '/' 开头
 */
export function normalizeStoragePath(rawPath: string): string {
  const trimmed = rawPath.trim().replace(/^\/+/, '')
  return `/${trimmed}`
}

export function isValidIdentifierFormat(value: string): 'empty' | 'trim' | 'chars' | 'spaces' | null {
  if (!value || value.trim().length === 0) return 'empty'
  if (hasTrimIssues(value)) return 'trim'
  if (!IDENTIFIER_REGEX.test(value)) return 'chars'
  if (value.includes('  ')) return 'spaces'
  return null
}

export function isValidVersionFormat(value: string): boolean {
  return VERSION_REGEX.test(value.trim())
}

export function isValidPackageSizeFormat(value: string): boolean {
  return SIZE_REGEX.test(value)
}

export function isValidEmailFormat(value: string): boolean {
  return EMAIL_REGEX.test(value.trim())
}

export function isValidHttpUrl(value: string): boolean {
  if (!value.trim()) return true
  if (hasTrimIssues(value)) return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function hasSubstantialHtmlContent(rawHtml?: string): boolean {
  if (!rawHtml || !rawHtml.trim()) return false
  if (typeof DOMParser === 'undefined') {
    return rawHtml.replace(/<[^>]+>/g, '').trim().length > 0 || rawHtml.includes('<img')
  }
  const doc = new DOMParser().parseFromString(rawHtml, 'text/html')
  const textLen = doc.body.textContent?.replace(/\u00a0/g, ' ').trim().length ?? 0
  const hasImg = doc.body.querySelector('img') !== null
  return textLen > 0 || hasImg
}
