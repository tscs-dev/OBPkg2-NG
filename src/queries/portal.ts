import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { fetchSiteStats, fetchWikiDoc, type SupportedLocale } from '@/api/portal'

export const portalKeys = {
  wiki: (locale: SupportedLocale, topic: string) => ['wiki', locale, topic] as const,
  stats: ['site-stats'] as const,
}

export function useWikiDocQuery(
  locale: MaybeRefOrGetter<SupportedLocale>,
  topic: MaybeRefOrGetter<string>,
) {
  const resolvedLocale = computed(() => toValue(locale))
  const resolvedTopic = computed(() => toValue(topic))

  return useQuery({
    queryKey: computed(() => portalKeys.wiki(resolvedLocale.value, resolvedTopic.value)),
    queryFn: ({ signal }) => fetchWikiDoc(resolvedLocale.value, resolvedTopic.value, signal),
    staleTime: 5 * 60_000,
    retry: 1,
  })
}

export function useSiteStatsQuery() {
  return useQuery({
    queryKey: portalKeys.stats,
    queryFn: ({ signal }) => fetchSiteStats(signal),
    staleTime: 5 * 60_000,
    retry: 1,
  })
}
