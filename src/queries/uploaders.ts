import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { fetchUploaderDetail } from '@/api/uploaders'

export const uploaderKeys = {
  all: ['uploaders'] as const,
  details: () => [...uploaderKeys.all, 'detail'] as const,
  detail: (id: number) => [...uploaderKeys.details(), id] as const,
}

export function useUploaderDetailQuery(id: MaybeRefOrGetter<number | null>) {
  const resolvedId = computed(() => toValue(id))

  return useQuery({
    queryKey: computed(() => uploaderKeys.detail(resolvedId.value ?? -1)),
    queryFn: ({ signal }) => fetchUploaderDetail(resolvedId.value!, signal),
    enabled: computed(
      () =>
        resolvedId.value !== null &&
        Number.isInteger(resolvedId.value) &&
        resolvedId.value > 0,
    ),
    staleTime: 60_000,
  })
}

export function useUploaderCacheActions() {
  const queryClient = useQueryClient()

  function invalidateUploader(id: number) {
    return queryClient.invalidateQueries({
      queryKey: uploaderKeys.detail(id),
    })
  }

  return {
    invalidateUploader,
  }
}
