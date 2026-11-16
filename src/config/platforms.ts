import { ENV } from './env'

export type PlatformId = 'hmmsim' | 'openbve'

export interface PlatformMeta {
  id: PlatformId
  name: string
  color: string
}

export const PLATFORMS: Record<PlatformId, PlatformMeta> = {
  hmmsim: {
    id: 'hmmsim',
    name: 'Hmmsim',
    color: '#569E7B',
  },
  openbve: {
    id: 'openbve',
    name: 'OpenBVE',
    color: '#636363',
  },
}

export const PLATFORM_ORDER: PlatformId[] = ['hmmsim', 'openbve']

export function isKnownPlatform(platform: string): platform is PlatformId {
  return platform === 'hmmsim' || platform === 'openbve'
}

export function getPlatformMeta(platform: string): PlatformMeta {
  if (isKnownPlatform(platform)) {
    return PLATFORMS[platform]
  }
  return {
    id: 'openbve',
    name: platform,
    color: '#737373',
  }
}

export function encodeBase64Ascii(input: string): string {
  const bytes = new TextEncoder().encode(input)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

/**
 * 严格沿用旧版下载规则：
 * - hmmsim 平台跳转安装引导页 https://api.zbx1425.cn/install/?t=BASE64("hm"+packID)&l={lang}
 * - 其余平台直接使用文件自身的 FetchURL
 */
export function buildFileDownloadUrl(
  packageId: number,
  platform: string,
  fetchUrl: string | undefined,
  locale: string,
): string | null {
  if (platform === 'hmmsim') {
    const token = encodeBase64Ascii(`hm${packageId}`)
    const params = new URLSearchParams({
      t: token,
      l: locale,
    })
    return `${ENV.installEndpoint}?${params.toString()}`
  }
  return fetchUrl && fetchUrl.length > 0 ? fetchUrl : null
}
