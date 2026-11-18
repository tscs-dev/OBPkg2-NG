import { apiClient, fetchPaginated, parseContentRange } from './client'
import type { PackageFile, PaginatedResult, SaveFilePayload } from '@/types/models'

export type FileValidationFilter = 'pending' | 'validated' | 'all'
export type FilePlatformFilter = 'all' | 'hmmsim' | 'openbve'

export interface FileListParams {
  platform?: FilePlatformFilter
  status?: FileValidationFilter
  page?: number
  pageSize?: number
}

export async function fetchFileList(
  params: FileListParams,
  signal?: AbortSignal,
): Promise<PaginatedResult<PackageFile>> {
  const page = Math.max(1, params.page ?? 1)
  const pageSize = Math.max(1, params.pageSize ?? 20)
  const offset = (page - 1) * pageSize

  const query: Record<string, string | undefined> = {}
  if (params.platform && params.platform !== 'all') {
    query.platform = params.platform
  }
  if (params.status === 'pending') {
    query.validated = 'false'
  } else if (params.status === 'validated') {
    query.validated = 'true'
  }

  return fetchPaginated<PackageFile>('/files', {
    unit: 'files',
    offset,
    limit: pageSize,
    query,
    signal,
  })
}

export async function fetchPendingFilesCount(signal?: AbortSignal): Promise<number> {
  const response = await apiClient.raw('/files', {
    method: 'HEAD',
    query: { validated: 'false' },
    signal,
  })
  const parsed = parseContentRange(response.headers.get('content-range'))
  return parsed && parsed.total >= 0 ? parsed.total : 0
}

export async function createFile(payload: SaveFilePayload): Promise<PackageFile> {
  return apiClient<PackageFile>('/files', {
    method: 'PUT',
    body: payload,
  })
}

export async function updateFile(
  id: number,
  payload: Partial<SaveFilePayload> & { Validated?: boolean },
): Promise<PackageFile> {
  return apiClient<PackageFile>(`/files/${id}`, {
    method: 'POST',
    body: payload,
  })
}

export async function deleteFile(id: number): Promise<void> {
  await apiClient(`/files/${id}`, {
    method: 'DELETE',
  })
}
