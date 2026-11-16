import { ofetch, FetchError } from 'ofetch'
import { ENV } from '@/config/env'
import type { BackendErrorPayload, PaginatedResult } from '@/types/models'

export class ApiError extends Error {
  status: number | undefined
  code: number | undefined
  data: string | number | undefined

  constructor(
    message: string,
    status?: number,
    code?: number,
    data?: string | number,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.data = data
  }
}

let tokenGetter: (() => string | null) | null = null
let unauthorizedHandler: (() => void) | null = null

export function configureApiAuthHooks(options: {
  getToken: () => string | null
  onUnauthorized?: () => void
}) {
  tokenGetter = options.getToken
  unauthorizedHandler = options.onUnauthorized ?? null
}

export const apiClient = ofetch.create({
  baseURL: ENV.apiRootUrl,
  timeout: 20_000,
  onRequest({ options }) {
    const headers = new Headers(options.headers)
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json')
    }
    const token = tokenGetter?.()
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`)
    }
    options.headers = headers
  },
  onResponseError({ response }) {
    const payload = response._data as BackendErrorPayload | undefined
    const code = payload?.ErrorCode
    if (code === 211 && unauthorizedHandler) {
      unauthorizedHandler()
    }
    throw new ApiError(
      payload?.Msg || response.statusText || 'Request failed',
      response.status,
      code,
      payload?.Data,
    )
  },
})

export function normalizeApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err
  if (err instanceof FetchError) {
    const payload = err.data as BackendErrorPayload | undefined
    return new ApiError(
      payload?.Msg || err.message || 'Network error',
      err.statusCode,
      payload?.ErrorCode,
      payload?.Data,
    )
  }
  if (err instanceof Error) {
    return new ApiError(err.message)
  }
  return new ApiError('Unknown error')
}

export function parseContentRange(headerValue: string | null): {
  rangeStart: number
  rangeEnd: number
  total: number
} | null {
  if (!headerValue) return null
  const match = headerValue.match(/^\s*\w+\s+(\d+)-(\d+)\/(\d+|\*)\s*$/)
  if (!match) return null
  const rangeStart = Number.parseInt(match[1]!, 10)
  const rangeEnd = Number.parseInt(match[2]!, 10)
  const total = match[3] === '*' ? -1 : Number.parseInt(match[3]!, 10)
  if (Number.isNaN(rangeStart) || Number.isNaN(rangeEnd) || Number.isNaN(total)) {
    return null
  }
  return { rangeStart, rangeEnd, total }
}

export async function fetchPaginated<T>(
  path: string,
  options: {
    unit: string
    offset: number
    limit: number
    query?: Record<string, string | undefined>
    signal?: AbortSignal
  },
): Promise<PaginatedResult<T>> {
  const { unit, offset, limit, query, signal } = options
  const rangeStart = Math.max(0, offset)
  const rangeEnd = rangeStart + Math.max(1, limit) - 1

  const response = await apiClient.raw<T[]>(path, {
    query,
    signal,
    headers: {
      Range: `${unit}=${rangeStart}-${rangeEnd}`,
    },
  })

  const items = Array.isArray(response._data) ? response._data : []
  const parsed = parseContentRange(response.headers.get('content-range'))

  return {
    items,
    total: parsed && parsed.total >= 0 ? parsed.total : items.length,
    rangeStart: parsed ? parsed.rangeStart : rangeStart,
    rangeEnd: parsed ? parsed.rangeEnd : rangeStart + Math.max(0, items.length - 1),
  }
}
