import { ofetch } from 'ofetch'
import { ENV } from '@/config/env'
import type { LskyUploadResult } from '@/types/models'

interface LskyApiResponse {
  status: boolean
  message?: string
  data?: {
    links?: {
      url?: string
      thumbnail_url?: string
    }
  }
}

export async function uploadImageToLsky(file: File): Promise<LskyUploadResult> {
  if (!ENV.lskyApiUrl) {
    throw new Error('Image upload endpoint is not configured.')
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('strategy_id', '1')

  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  if (ENV.lskyApiToken) {
    headers.Authorization = `Bearer ${ENV.lskyApiToken}`
  }

  const res = await ofetch<LskyApiResponse>(ENV.lskyApiUrl, {
    method: 'POST',
    body: formData,
    headers,
    timeout: 60_000,
  })

  if (!res?.status || !res.data?.links?.url) {
    throw new Error(res?.message || 'Image upload failed.')
  }

  return {
    fullUrl: res.data.links.url,
    thumbUrl: res.data.links.thumbnail_url ?? '',
  }
}
