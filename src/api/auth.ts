import type { QueryClient } from '@tanstack/vue-query'
import { apiClient, bareApiClient, normalizeApiError } from './client'
import { decodeJwtPayload } from '@/stores/auth'
import { uploaderKeys } from '@/queries/uploaders'
import { formatLocalTimestamp } from '@/utils/date'
import type {
  ActivatePayload,
  ChangePasswordPayload,
  CheckTokenResponse,
  LoginPayload,
  RegisterPayload,
  RegisterResponse,
  TokenResponse,
  Uploader,
  UploaderDetail,
} from '@/types/models'

export async function loginApi(payload: LoginPayload): Promise<TokenResponse> {
  return bareApiClient<TokenResponse>('/auth/login', {
    method: 'POST',
    body: payload,
  })
}

export async function registerApi(payload: RegisterPayload): Promise<RegisterResponse> {
  return bareApiClient<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: payload,
  })
}

export async function checkActivationTokenApi(token: string): Promise<CheckTokenResponse> {
  return bareApiClient<CheckTokenResponse>('/auth/check_token', {
    method: 'POST',
    body: { Token: token },
  })
}

export async function activateAccountApi(payload: ActivatePayload): Promise<Uploader> {
  return bareApiClient<Uploader>('/auth/activate', {
    method: 'POST',
    body: payload,
  })
}

export async function changePasswordApi(payload: ChangePasswordPayload): Promise<void> {
  await apiClient('/auth/change_password', {
    method: 'POST',
    body: payload,
  })
}

/**
 * JWT 解码 → 拉取用户资料 → 写入 store 和查询缓存。
 * 供 LoginView / ActivateView 共用。
 */
export async function setupSessionFromToken(
  token: string,
  authStore: { setSession: (token: string, profile: Uploader) => void },
  queryClient: QueryClient,
): Promise<void> {
  const payload = decodeJwtPayload(token)
  if (!payload?.uid) {
    throw new Error('Invalid server response: missing user ID in token')
  }
  const uploader = await bareApiClient<UploaderDetail>(`/uploaders/${payload.uid}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  authStore.setSession(token, uploader)
  queryClient.setQueryData(uploaderKeys.detail(payload.uid), uploader)
}

const KNOWN_ERROR_CODES = new Set([111, 112, 113, 114, 201, 202, 203, 204, 205, 211, 212, 213, 214, 221])

export function formatApiErrorMessage(
  err: unknown,
  t: (key: string, params?: Record<string, unknown>) => string,
  te: (key: string) => boolean,
): string {
  const apiErr = normalizeApiError(err)

  if (apiErr.code && KNOWN_ERROR_CODES.has(apiErr.code)) {
    const i18nKey = `errors.code_${apiErr.code}`
    if (te(i18nKey)) {
      let dataVal = apiErr.data
      if (apiErr.code === 213 && typeof dataVal === 'string') {
        dataVal = formatLocalTimestamp(dataVal)
      }
      return t(i18nKey, dataVal !== undefined ? { data: String(dataVal) } : undefined)
    }
  }

  if (apiErr.status === undefined) {
    return apiErr.isNetworkError ? t('errors.network') : apiErr.message
  }

  if (apiErr.code) {
    return t('errors.codeFallback', {
      status: apiErr.status,
      code: apiErr.code,
      msg: apiErr.message,
    })
  }

  return t('errors.serverError', { status: apiErr.status })
}
