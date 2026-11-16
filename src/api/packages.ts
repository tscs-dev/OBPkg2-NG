import { apiClient, fetchPaginated } from './client'
import type { PackageDetail, PackageSummary, PaginatedResult } from '@/types/models'

export type PlatformFilter = '+' | 'hmmsim' | 'openbve' | 'all'

export interface PackageListParams {
  platform?: PlatformFilter
  keyword?: string
  page?: number
  pageSize?: number
}

export async function fetchPackageList(
  params: PackageListParams,
  signal?: AbortSignal,
): Promise<PaginatedResult<PackageSummary>> {
  const page = Math.max(1, params.page ?? 1)
  const pageSize = Math.max(1, params.pageSize ?? 20)
  const offset = (page - 1) * pageSize

  const query: Record<string, string | undefined> = {}
  if (params.platform && params.platform !== 'all') {
    // 后端约定 platform=+ 表示所有含可下载文件的包（ofetch 会自动编码为 %2B）
    query.platform = params.platform
  }
  const keyword = params.keyword?.trim()
  if (keyword) {
    query.keyword = keyword
  }

  return fetchPaginated<PackageSummary>('/packages', {
    unit: 'packages',
    offset,
    limit: pageSize,
    query,
    signal,
  })
}

export async function fetchPackageDetail(
  id: number,
  signal?: AbortSignal,
): Promise<PackageDetail> {
  return apiClient<PackageDetail>(`/packages/${id}`, {
    signal,
  })
}
