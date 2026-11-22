<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ArrowRight,
  BarChart3,
  Compass,
  ExternalLink,
  Loader2,
  Megaphone,
  RefreshCw,
  Wrench,
} from '@lucide/vue'
import SidebarLayout from '@/layouts/SidebarLayout.vue'
import PackageGhostRow from '@/components/package/PackageGhostRow.vue'
import { usePackagesQuery } from '@/queries/packages'
import { useSiteStatsQuery, useWikiDocQuery } from '@/queries/portal'
import { buildWikiDocUrl, type SupportedLocale } from '@/api/portal'
import { ENV } from '@/config/env'
import { usePreferencesStore } from '@/stores/preferences'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

const { t } = useI18n()
const preferences = usePreferencesStore()

// 两栏公告：面向用户 (bcs-doc:status) & 面向创作者 (bcs-doc:ann-uploader)
// 优先使用用户语言，非中文时 fallback 到 zh-CN
const annLocale = computed(() => preferences.locale as SupportedLocale)
const userAnnQuery = useWikiDocQuery(annLocale, 'status')
const uploaderAnnQuery = useWikiDocQuery(annLocale, 'ann-uploader')
const userAnnFallbackQuery = useWikiDocQuery('zh-CN', 'status')
const uploaderAnnFallbackQuery = useWikiDocQuery('zh-CN', 'ann-uploader')

// 最近更新包列表（前 6 条可下载包）
const recentQuery = usePackagesQuery({
  platform: '+',
  page: 1,
  pageSize: 6,
})

// 站点统计数据
const statsQuery = useSiteStatsQuery()

const numberFormatter = computed(
  () => new Intl.NumberFormat(preferences.locale),
)

function resolveAnnQuery(
  primary: typeof userAnnQuery,
  fallback: typeof userAnnFallbackQuery,
) {
  if (annLocale.value === 'zh-CN' || annLocale.value === 'zh-TW') return primary
  if (!primary.isSuccess.value) return primary
  if (!primary.data.value?.isEmpty) return primary
  return fallback
}

const effectiveUserAnnQuery = computed(() => resolveAnnQuery(userAnnQuery, userAnnFallbackQuery))
const effectiveUploaderAnnQuery = computed(() => resolveAnnQuery(uploaderAnnQuery, uploaderAnnFallbackQuery))

const userAnnUrl = computed(() => {
  const q = effectiveUserAnnQuery.value
  return q.data.value?.sourceUrl ?? buildWikiDocUrl(annLocale.value, 'status')
})
const uploaderAnnUrl = computed(() => {
  const q = effectiveUploaderAnnQuery.value
  return q.data.value?.sourceUrl ?? buildWikiDocUrl(annLocale.value, 'ann-uploader')
})
const usageGuideUrl = computed(() => buildWikiDocUrl(preferences.locale as SupportedLocale, 'start'))

const announcementCards = computed(() => [
  {
    key: 'user',
    title: t('home.userAnnouncements'),
    icon: Megaphone,
    url: userAnnUrl.value,
    query: effectiveUserAnnQuery.value,
  },
  {
    key: 'uploader',
    title: t('home.uploaderAnnouncements'),
    icon: Wrench,
    url: uploaderAnnUrl.value,
    query: effectiveUploaderAnnQuery.value,
  },
])
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 py-6">
    <SidebarLayout side="right">
      <!-- 左主栏 -->
      <div class="flex flex-col gap-6">
        <!-- 1. 顶部左右两栏固定高度滚动公告卡片 -->
        <section class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <article
            v-for="card in announcementCards"
            :key="card.key"
            class="border border-border bg-card flex flex-col min-w-0"
          >
            <header class="px-3.5 py-2.5 border-b border-border bg-muted/35 flex items-center justify-between gap-2 shrink-0">
              <div class="flex items-center gap-2 min-w-0">
                <component :is="card.icon" class="size-3.5 text-primary shrink-0" />
                <h2 class="text-sm font-semibold text-foreground truncate">
                  {{ card.title }}
                </h2>
              </div>

              <div class="flex items-center gap-2 shrink-0">
                <span
                  v-if="card.query.isFetching.value"
                  class="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
                >
                  <Loader2 class="size-3 animate-spin text-primary" />
                  <span>{{ t('home.fetchingWiki') }}</span>
                </span>
                <a
                  :href="card.url"
                  target="_blank"
                  class="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  :title="t('home.openOnWiki')"
                >
                  <ExternalLink class="size-3" />
                </a>
              </div>
            </header>

            <div class="h-52 overflow-y-auto overscroll-contain p-3.5 text-sm">
              <div v-if="card.query.isPending.value" class="space-y-2.5">
                <Skeleton class="h-4 w-1/3 rounded-none" />
                <Skeleton class="h-3.5 w-full rounded-none" />
                <Skeleton class="h-3.5 w-11/12 rounded-none" />
                <Skeleton class="h-3.5 w-4/5 rounded-none" />
                <Skeleton class="h-3.5 w-2/3 rounded-none" />
              </div>

              <div
                v-else-if="card.query.isError.value && !card.query.data.value?.html"
                class="h-full flex flex-col items-start justify-center gap-2.5 text-muted-foreground"
              >
                <p class="leading-relaxed">{{ t('home.wikiErrorDesc') }}</p>
                <div class="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="xs"
                    class="rounded-none cursor-pointer"
                    @click="() => card.query.refetch()"
                  >
                    <RefreshCw class="size-3" />
                    <span>{{ t('common.retry') }}</span>
                  </Button>
                  <a
                    :href="card.url"
                    target="_blank"
                    class="text-[11px] text-primary hover:underline underline-offset-4"
                  >
                    {{ t('home.openOnWiki') }}
                  </a>
                </div>
              </div>

              <div
                v-else-if="card.query.data.value?.isEmpty"
                class="h-full flex flex-col items-start justify-center gap-2 text-muted-foreground"
              >
                <p class="leading-relaxed">{{ t('home.wikiEmptyDesc') }}</p>
                <a
                  :href="card.url"
                  target="_blank"
                  class="inline-flex items-center gap-1 text-[11px] text-primary hover:underline underline-offset-4"
                >
                  <span>{{ t('home.openOnWiki') }}</span>
                  <ExternalLink class="size-3" />
                </a>
              </div>

              <div
                v-else-if="card.query.data.value?.html"
                class="prose prose-sm max-w-none wiki-prose text-sm leading-relaxed"
                v-html="card.query.data.value.html"
              />
            </div>
          </article>
        </section>

        <Separator />

        <!-- 2. 最近更新线路包 -->
        <section>
          <div class="flex items-center justify-between gap-4 mb-3">
            <h1 class="text-base font-semibold tracking-tight text-foreground">
              {{ t('home.recentPackages') }}
            </h1>
            <router-link
              to="/packages"
              class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline underline-offset-4"
            >
              <span>{{ t('home.viewAllPackages') }}</span>
              <ArrowRight class="size-3.5" />
            </router-link>
          </div>

          <div v-if="recentQuery.isPending.value" class="divide-y divide-border/60">
            <div v-for="i in 6" :key="i" class="py-3 flex items-start gap-3.5">
              <Skeleton class="w-[104px] h-[68px] sm:w-[144px] sm:h-[90px] shrink-0 rounded-none" />
              <div class="flex-1 space-y-2 py-0.5">
                <Skeleton class="h-4 w-2/3 rounded-none" />
                <Skeleton class="h-3 w-1/3 rounded-none" />
                <Skeleton class="h-3 w-1/2 mt-3 rounded-none" />
              </div>
            </div>
          </div>

          <div
            v-else-if="recentQuery.isError.value && !recentQuery.data.value"
            class="border border-border bg-muted/30 p-4 flex items-center justify-between gap-4"
          >
            <p class="text-sm text-muted-foreground">
              {{ t('packages.errorTitle') }}
            </p>
            <Button
              variant="outline"
              size="sm"
              class="rounded-none cursor-pointer"
              @click="() => recentQuery.refetch()"
            >
              <RefreshCw class="size-3.5" />
              <span>{{ t('common.retry') }}</span>
            </Button>
          </div>

          <div v-else class="divide-y divide-border/60">
            <PackageGhostRow
              v-for="pkg in recentQuery.data.value?.items ?? []"
              :key="pkg.ID"
              :pkg="pkg"
            />
          </div>
        </section>
      </div>

      <!-- 右侧辅助栏 -->
      <template #sidebar>
        <div class="flex flex-col gap-5">
          <!-- 常用入口 -->
          <section class="space-y-3">
            <h2 class="text-sm font-semibold uppercase text-muted-foreground">
              {{ t('home.quickLinks') }}
            </h2>

            <Button as-child class="w-full justify-between rounded-none">
              <router-link to="/packages">
                <span>{{ t('home.browseCatalog') }}</span>
                <ArrowRight class="size-4" />
              </router-link>
            </Button>

            <ul class="space-y-0.5 pt-1 text-sm">
              <li>
                <a
                  :href="usageGuideUrl"
                  target="_blank"
                  class="px-2 py-1.5 flex items-center justify-between gap-2 text-foreground/85 hover:bg-muted/75 hover:text-foreground transition-colors"
                >
                  <span class="flex items-center gap-2 min-w-0">
                    <Compass class="size-3.5 text-muted-foreground shrink-0" />
                    <span class="truncate">{{ t('home.usageGuide') }}</span>
                  </span>
                  <ExternalLink class="size-3 text-muted-foreground shrink-0" />
                </a>
              </li>
              <li>
                <a
                  :href="ENV.analyticsUrl"
                  target="_blank"
                  class="px-2 py-1.5 flex items-center justify-between gap-2 text-foreground/85 hover:bg-muted/75 hover:text-foreground transition-colors"
                >
                  <span class="flex items-center gap-2 min-w-0">
                    <BarChart3 class="size-3.5 text-muted-foreground shrink-0" />
                    <span class="truncate">{{ t('home.analyticsTool') }}</span>
                  </span>
                  <ExternalLink class="size-3 text-muted-foreground shrink-0" />
                </a>
              </li>
            </ul>
          </section>

          <Separator />

          <!-- 站点统计（时刻表式双列紧凑键值） -->
          <section class="space-y-3">
            <h2 class="text-sm font-semibold uppercase text-muted-foreground">
              {{ t('home.siteStats') }}
            </h2>

            <dl class="space-y-2 text-sm tabular-nums">
              <div class="flex items-baseline justify-between gap-2">
                <dt class="text-muted-foreground">{{ t('home.statPackages') }}</dt>
                <dd class="font-semibold text-foreground">
                  <Skeleton v-if="statsQuery.isPending.value" class="h-4 w-12 rounded-none" />
                  <template v-else-if="statsQuery.data.value">
                    {{ numberFormatter.format(statsQuery.data.value.packageCount) }}
                  </template>
                  <template v-else>—</template>
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-2">
                <dt class="text-muted-foreground">{{ t('home.statDownloads') }}</dt>
                <dd class="font-semibold text-foreground">
                  <Skeleton v-if="statsQuery.isPending.value" class="h-4 w-16 rounded-none" />
                  <template v-else-if="statsQuery.data.value">
                    {{ numberFormatter.format(statsQuery.data.value.downloadCount) }}
                  </template>
                  <template v-else>—</template>
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-2">
                <dt class="text-muted-foreground">{{ t('home.statUsers') }}</dt>
                <dd class="font-semibold text-foreground">
                  <Skeleton v-if="statsQuery.isPending.value" class="h-4 w-16 rounded-none" />
                  <template v-else-if="statsQuery.data.value">
                    {{ numberFormatter.format(statsQuery.data.value.userCount) }}
                  </template>
                  <template v-else>—</template>
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-2">
                <dt class="text-muted-foreground">{{ t('home.statRunningDays') }}</dt>
                <dd class="font-semibold text-foreground">
                  <Skeleton v-if="statsQuery.isPending.value" class="h-4 w-14 rounded-none" />
                  <template v-else-if="statsQuery.data.value">
                    {{ t('home.daysUnit', { count: statsQuery.data.value.runningDays }) }}
                  </template>
                  <template v-else>—</template>
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </template>
    </SidebarLayout>
  </div>
</template>
