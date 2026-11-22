import DOMPurify from 'dompurify'
import { ENV } from '@/config/env'

function resolveWikiHref(href: string): string {
  const trimmed = href.trim()
  if (
    !trimmed ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('#')
  ) {
    return trimmed
  }
  const base = ENV.docRootUrl.replace(/\/+$/, '')
  if (trimmed.startsWith('/')) {
    return `${base}${trimmed}`
  }
  return `${base}/${trimmed}`
}

/**
 * 清洗 DokuWiki ?do=export_xhtmlbody 返回的 HTML
 * - 若服务端意外返回完整 HTML 壳，尝试提取 .page-content
 * - 补全相对链接与图片路径到 docRootUrl
 * - 剔除脚本标签并规范外链属性
 */
export function sanitizeWikiHtml(rawHtml: string): string {
  if (!rawHtml || !rawHtml.trim()) return ''

  let fragmentHtml = rawHtml
  if (rawHtml.includes('<!DOCTYPE') || rawHtml.includes('<html')) {
    const parser = new DOMParser()
    const parsed = parser.parseFromString(rawHtml, 'text/html')
    const contentEl = parsed.querySelector('#dokuwiki__content .page-content, .page-content')
    if (contentEl) {
      contentEl.querySelectorAll('.msg-area, .clearer').forEach((el) => el.remove())
      fragmentHtml = contentEl.innerHTML
    } else {
      fragmentHtml = ''
    }
  }

  if (!fragmentHtml.trim()) return ''

  const cleaned = DOMPurify.sanitize(fragmentHtml, {
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick'],
  })

  const doc = new DOMParser().parseFromString(cleaned, 'text/html')
  // 移除仅由 status.js 挂载的空占位容器
  doc.querySelectorAll('#status-area').forEach((el) => {
    if (!el.textContent?.trim()) el.remove()
  })

  doc.querySelectorAll('a[href]').forEach((anchor) => {
    const href = anchor.getAttribute('href') ?? ''
    const resolved = resolveWikiHref(href)
    anchor.setAttribute('href', resolved)
    if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
      anchor.setAttribute('target', '_blank')
      anchor.setAttribute('rel', 'noopener') // Give referrer, so that the author can track the traffic
    }
  })

  doc.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src') ?? ''
    img.setAttribute('src', resolveWikiHref(src))
    img.setAttribute('loading', 'lazy')
  })

  const textLen = doc.body.textContent?.trim().length ?? 0
  const hasMedia = doc.body.querySelector('img, table, ul, ol, h1, h2, h3, h4, p') !== null
  if (textLen === 0 && !hasMedia) {
    return ''
  }

  return doc.body.innerHTML.trim()
}

/* ---- Package HTML helpers ---- */

function purifyAndParse(rawHtml: string): Document | null {
  const cleaned = DOMPurify.sanitize(rawHtml, {
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
  })
  if (!cleaned.trim()) return null
  return new DOMParser().parseFromString(cleaned, 'text/html')
}

/**
 * 展示数据库中的用户富文本 HTML（添加 target/rel/loading 等展示用属性）
 */
export function sanitizePackageHtmlForDisplay(rawHtml: string | undefined): string {
  if (!rawHtml || !rawHtml.trim()) return ''
  const doc = purifyAndParse(rawHtml)
  if (!doc) return ''

  doc.querySelectorAll('a[href]').forEach((anchor) => {
    let href = (anchor.getAttribute('href') ?? '').trim()
    if (href && !href.startsWith('https://') && !href.startsWith('http://') && !href.startsWith('mailto:') && !href.startsWith('#')) {
      href = `https://${href}`
      anchor.setAttribute('href', href)
    }
    if (href.startsWith('http://') || href.startsWith('https://')) {
      anchor.setAttribute('target', '_blank')
      anchor.setAttribute('rel', 'noopener') // Give referrer, so that the author can track the traffic
    }
  })

  doc.querySelectorAll('img[src]').forEach((img) => {
    let src = (img.getAttribute('src') ?? '').trim()
    if (src && !src.startsWith('https://') && !src.startsWith('http://') && !src.startsWith('data:')) {
      src = `https://${src}`
      img.setAttribute('src', src)
    }
    img.setAttribute('loading', 'lazy')
  })

  return doc.body.innerHTML.trim()
}

/**
 * 清洗编辑器输出的 HTML 用于存储（移除编辑器残留 & 仅展示用的属性）
 */
export function sanitizePackageHtmlForStorage(rawHtml: string | undefined): string {
  if (!rawHtml || !rawHtml.trim()) return ''
  const doc = purifyAndParse(rawHtml)
  if (!doc) return ''

  doc.querySelectorAll('.image-upload-placeholder').forEach((el) => el.remove())

  doc.querySelectorAll('a[href]').forEach((anchor) => {
    let href = (anchor.getAttribute('href') ?? '').trim()
    if (href && !href.startsWith('https://') && !href.startsWith('http://') && !href.startsWith('mailto:') && !href.startsWith('#')) {
      href = `https://${href}`
      anchor.setAttribute('href', href)
    }
    anchor.removeAttribute('target')
    anchor.removeAttribute('rel')
  })

  doc.querySelectorAll('img[src]').forEach((img) => {
    let src = (img.getAttribute('src') ?? '').trim()
    if (src && !src.startsWith('https://') && !src.startsWith('http://') && !src.startsWith('data:')) {
      src = `https://${src}`
      img.setAttribute('src', src)
    }
    img.removeAttribute('loading')
  })

  return doc.body.innerHTML.trim()
}
