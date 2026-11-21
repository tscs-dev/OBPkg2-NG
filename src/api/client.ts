import { ofetch, FetchError } from 'ofetch'
import { ENV } from '@/config/env'
import type { BackendErrorPayload, PaginatedResult } from '@/types/models'

export class ApiError extends Error {
  status: number | undefined
  code: number | undefined
  data: string | number | undefined
  isNetworkError: boolean

  constructor(
    message: string,
    status?: number,
    code?: number,
    data?: string | number,
    isNetworkError = false,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.data = data
    this.isNetworkError = isNetworkError
  }
}

interface AuthClientHooks {
  getToken: () => string | null
  ensureValidToken: () => Promise<string | null>
  getFreshTokenFromStorage: (failedToken: string | null) => string | null
  onSessionExpired: () => void
}

let authHooks: AuthClientHooks | null = null

export function configureApiAuthHooks(hooks: AuthClientHooks) {
  authHooks = hooks
}

const PUBLIC_AUTH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/check_token',
  '/auth/activate',
  '/auth/refresh_token',
]

function isPublicAuthEndpoint(request: RequestInfo): boolean {
  const url = typeof request === 'string' ? request : request.url
  return PUBLIC_AUTH_PATHS.some((path) => url.includes(path))
}

function isIdempotentMethod(method?: string): boolean {
  const m = (method ?? 'GET').toUpperCase()
  return m === 'GET' || m === 'HEAD'
}

function isSessionExpiredError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false
  return err.code === 211 || (err.status === 401 && !err.code)
}

export const bareApiClient = ofetch.create({
  baseURL: ENV.apiRootUrl,
  timeout: 20_000,
  onRequest({ options }) {
    const headers = new Headers(options.headers)
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json')
    }
    options.headers = headers
  },
  onResponseError({ response }) {
    const payload = response._data as BackendErrorPayload | undefined
    throw new ApiError(
      payload?.Msg || response.statusText || 'Request failed',
      response.status,
      payload?.ErrorCode,
      payload?.Data,
    )
  },
})

const _apiClientBase = ofetch.create({
  baseURL: ENV.apiRootUrl,
  timeout: 20_000,
  async onRequest({ request, options }) {
    const headers = new Headers(options.headers)
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json')
    }

    if (!headers.has('Authorization') && authHooks) {
      const token = isPublicAuthEndpoint(request)
        ? authHooks.getToken()
        : await authHooks.ensureValidToken()
      if (token) {
        headers.set('Authorization', `Bearer ${token}`)
      }
    }

    options.headers = headers
  },
  async onResponseError({ request, response, options }) {
    const payload = response._data as BackendErrorPayload | undefined
    const code = payload?.ErrorCode
    const isExpired = code === 211 || (response.status === 401 && !code)

    if (isExpired && !isPublicAuthEndpoint(request) && authHooks) {
      const reqHeaders = new Headers(options.headers)
      const authHeader = reqHeaders.get('Authorization')
      const usedToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

      const freshToken = authHooks.getFreshTokenFromStorage(usedToken)
      if (!freshToken) {
        authHooks.onSessionExpired()
      }
      // freshToken 存在时: 内存已同步，不过期; 外层 wrapper 处理 GET/HEAD 重试
    }

    throw new ApiError(
      payload?.Msg || response.statusText || 'Request failed',
      response.status,
      code,
      payload?.Data,
    )
  },
})

function canRetryWithFreshToken(
  err: unknown,
  options?: { method?: string; headers?: HeadersInit },
): boolean {
  if (!isSessionExpiredError(err)) return false
  if (!isIdempotentMethod(options?.method)) return false
  if (!authHooks?.getToken()) return false
  const headers = new Headers(options?.headers)
  return headers.get('X-OBPkg-Retried') !== '1'
}

function withRetryHeaders(original?: HeadersInit): HeadersInit {
  const headers = new Headers(original)
  headers.set('Authorization', `Bearer ${authHooks!.getToken()!}`)
  headers.set('X-OBPkg-Retried', '1')
  return headers
}

type ClientOptions = Parameters<typeof _apiClientBase>[1]

async function _apiFetch<T = unknown>(url: string, options?: ClientOptions): Promise<T> {
  try {
    return await _apiClientBase<T>(url, options as any)
  } catch (err) {
    if (canRetryWithFreshToken(err, options)) {
      return _apiClientBase<T>(url, { ...options, headers: withRetryHeaders(options?.headers) } as any)
    }
    throw err
  }
}

_apiFetch.raw = async function <T = unknown>(url: string, options?: ClientOptions) {
  try {
    return await _apiClientBase.raw<T>(url, options as any)
  } catch (err) {
    if (canRetryWithFreshToken(err, options)) {
      return _apiClientBase.raw<T>(url, { ...options, headers: withRetryHeaders(options?.headers) } as any)
    }
    throw err
  }
}

export const apiClient: typeof _apiClientBase = _apiFetch as any

export function normalizeApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err
  if (err instanceof FetchError) {
    const payload = err.data as BackendErrorPayload | undefined
    const hasStatus = typeof err.statusCode === 'number'
    return new ApiError(
      payload?.Msg || err.message || 'Network error',
      err.statusCode,
      payload?.ErrorCode,
      payload?.Data,
      !hasStatus,
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
