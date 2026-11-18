import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/vue-query'
import { fetchFileList, fetchPendingFilesCount, type FileListParams } from '@/api/files'

export const fileKeys = {
  all: ['files'] as const,
  lists: () => [...fileKeys.all, 'list'] as const,
  list: (params: FileListParams) => [...fileKeys.lists(), params] as const,
  pendingCount: () => [...fileKeys.all, 'pending-count'] as const,
}

export function useFilesQuery(params: MaybeRefOrGetter<FileListParams>) {
  const resolved = computed(() => toValue(params))

  return useQuery({
    queryKey: computed(() => fileKeys.list(resolved.value)),
    queryFn: ({ signal }) => fetchFileList(resolved.value, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

export function usePendingFilesCountQuery(enabled: MaybeRefOrGetter<boolean>) {
  const isEnabled = computed(() => toValue(enabled))

  return useQuery({
    queryKey: fileKeys.pendingCount(),
    queryFn: ({ signal }) => fetchPendingFilesCount(signal),
    enabled: isEnabled,
    staleTime: 60_000,
  })
}

export function useFileCacheActions() {
  const queryClient = useQueryClient()

  function invalidateFiles() {
    return queryClient.invalidateQueries({
      queryKey: fileKeys.all,
    })
  }

  return {
    invalidateFiles,
  }
}
