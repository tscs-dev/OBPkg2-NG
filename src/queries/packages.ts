import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { fetchPackageDetail, fetchPackageList, type PackageListParams } from '@/api/packages'

export const packageKeys = {
  all: ['packages'] as const,
  lists: () => [...packageKeys.all, 'list'] as const,
  list: (params: PackageListParams) => [...packageKeys.lists(), params] as const,
  details: () => [...packageKeys.all, 'detail'] as const,
  detail: (id: number) => [...packageKeys.details(), id] as const,
}

export function usePackagesQuery(params: MaybeRefOrGetter<PackageListParams>) {
  const resolved = computed(() => toValue(params))

  return useQuery({
    queryKey: computed(() => packageKeys.list(resolved.value)),
    queryFn: ({ signal }) => fetchPackageList(resolved.value, signal),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}

export function usePackageDetailQuery(id: MaybeRefOrGetter<number | null>) {
  const resolvedId = computed(() => toValue(id))

  return useQuery({
    queryKey: computed(() => packageKeys.detail(resolvedId.value ?? -1)),
    queryFn: ({ signal }) => fetchPackageDetail(resolvedId.value!, signal),
    enabled: computed(() => resolvedId.value !== null && Number.isInteger(resolvedId.value) && resolvedId.value > 0),
    staleTime: 60_000,
  })
}
