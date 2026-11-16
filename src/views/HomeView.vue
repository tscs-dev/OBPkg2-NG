<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
} from '@lucide/vue'
import SidebarLayout from '@/layouts/SidebarLayout.vue'
import PackageGhostRow from '@/components/package/PackageGhostRow.vue'
import { usePackagesQuery } from '@/queries/packages'
import { useSiteStatsQuery, useWikiDocQuery } from '@/queries/portal'
import { buildWikiDocUrl } from '@/api/portal'
import { ENV } from '@/config/env'
import { usePreferencesStore } from '@/stores/preferences'
import { useBreadcrumbState, usePageBreadcrumbCleanup } from '@/composables/useBreadcrumb'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const { t } = useI18n()
const preferences = usePreferencesStore()
const { setBreadcrumb } = useBreadcrumbState()
usePageBreadcrumbCleanup()

watchEffect(() => {
  setBreadcrumb([{ label: t('nav.home') }], '')
})

// 最近更新包列表（前 6 条可下载包）
const recentQuery = usePackagesQuery({
  platform: '+',
  page: 1,
  pageSize: 6,
})

// 主页公告（DokuWiki ?do=export_xhtmlbody）
const startWikiQuery = useWikiDocQuery(
  () => preferences.locale,
  'start',
)

// 运维状态公告（原 status.js 请求 bcs-doc:status）
const statusWikiQuery = useWikiDocQuery('zh-CN', 'status')

// 站点统计数据（原 status.js 请求 statapi.php）
const statsQuery = useSiteStatsQuery()

const numberFormatter = computed(
  () => new Intl.NumberFormat(preferences.locale),
)

const packFieldsDocUrl = computed(() =>
  buildWikiDocUrl(preferences.locale, 'packfields'),
)

const fileFieldsDocUrl = computed(() =>
  buildWikiDocUrl(preferences.locale, 'filefields'),
)

const statusDocUrl = computed(() =>
  buildWikiDocUrl('zh-CN', 'status'),
)
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 py-6">
    <SidebarLayout side="right">
      <!-- 左主栏 -->
      <div class="divide-y divide-border">
        <!-- 1. 最近更新线路包 -->
        <section class="pb-8">
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
            v-else-if="recentQuery.isError.value"
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

        <!-- 2. 公告与使用指南 (Wiki XHR) -->
        <section class="pt-7">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div class="flex items-center gap-2.5">
              <h2 class="text-base font-semibold tracking-tight text-foreground">
                {{ t('home.announcementsAndGuide') }}
              </h2>
              <span
                v-if="startWikiQuery.isFetching.value"
                class="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <Loader2 class="size-3 animate-spin" />
                <span>{{ t('home.fetchingWiki') }}</span>
              </span>
            </div>

            <a
              :href="buildWikiDocUrl(preferences.locale, 'start')"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <span>{{ t('home.openOnWiki') }}</span>
              <ExternalLink class="size-3" />
            </a>
          </div>

          <!-- 骨架屏 -->
          <div v-if="startWikiQuery.isPending.value" class="space-y-4">
            <Skeleton class="h-6 w-56 rounded-none" />
            <Skeleton class="h-4 w-full rounded-none" />
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div class="border border-border p-4 space-y-2">
                <Skeleton class="h-4 w-32 rounded-none" />
                <Skeleton class="h-3.5 w-full rounded-none" />
                <Skeleton class="h-3.5 w-4/5 rounded-none" />
              </div>
              <div class="border border-border p-4 space-y-2">
                <Skeleton class="h-4 w-32 rounded-none" />
                <Skeleton class="h-3.5 w-full rounded-none" />
                <Skeleton class="h-3.5 w-3/4 rounded-none" />
              </div>
            </div>
            <div class="space-y-2 pt-2">
              <Skeleton class="h-4 w-40 rounded-none" />
              <Skeleton class="h-3.5 w-full rounded-none" />
              <Skeleton class="h-3.5 w-11/12 rounded-none" />
              <Skeleton class="h-3.5 w-5/6 rounded-none" />
            </div>
          </div>

          <!-- 错误状态 -->
          <div
            v-else-if="startWikiQuery.isError.value"
            class="border border-border bg-muted/30 p-5 space-y-3"
          >
            <div class="space-y-1">
              <p class="text-sm font-medium text-foreground">
                {{ t('home.wikiErrorTitle') }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ t('home.wikiErrorDesc') }}
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                class="rounded-none cursor-pointer"
                @click="() => startWikiQuery.refetch()"
              >
                <RefreshCw class="size-3.5" />
                <span>{{ t('common.retry') }}</span>
              </Button>
              <Button as-child variant="ghost" size="sm" class="rounded-none">
                <a
                  :href="buildWikiDocUrl(preferences.locale, 'start')"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span>{{ t('home.openOnWiki') }}</span>
                  <ExternalLink class="size-3.5" />
                </a>
              </Button>
            </div>
          </div>

          <!-- 服务端返回空正文状态 -->
          <div
            v-else-if="startWikiQuery.data.value?.isEmpty"
            class="border border-border bg-muted/30 p-5 space-y-3"
          >
            <div class="space-y-1">
              <p class="text-sm font-medium text-foreground">
                {{ t('home.wikiEmptyTitle') }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ t('home.wikiEmptyDesc') }}
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                class="rounded-none cursor-pointer"
                @click="() => startWikiQuery.refetch()"
              >
                <RefreshCw class="size-3.5" />
                <span>{{ t('common.retry') }}</span>
              </Button>
              <Button as-child variant="default" size="sm" class="rounded-none">
                <a
                  :href="startWikiQuery.data.value.sourceUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span>{{ t('home.openOnWiki') }}</span>
                  <ExternalLink class="size-3.5" />
                </a>
              </Button>
            </div>
          </div>

          <!-- 正常渲染 Wiki 正文 -->
          <div
            v-else-if="startWikiQuery.data.value?.html"
            class="prose prose-sm max-w-none wiki-prose"
            v-html="startWikiQuery.data.value.html"
          />
        </section>
      </div>

      <!-- 右侧辅助栏 -->
      <template #sidebar>
        <div class="space-y-6 divide-y divide-border">
          <!-- 常用入口 -->
          <section class="space-y-3">
            <h2 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {{ t('home.quickLinks') }}
            </h2>

            <Button as-child class="w-full justify-between rounded-none">
              <router-link to="/packages">
                <span>{{ t('home.browseCatalog') }}</span>
                <ArrowRight class="size-4" />
              </router-link>
            </Button>

            <ul class="space-y-1 pt-1 text-sm">
              <li>
                <a
                  :href="ENV.analyticsUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="-mx-2 px-2 py-1.5 flex items-center justify-between gap-2 text-foreground/85 hover:bg-muted/75 hover:text-foreground transition-colors"
                >
                  <span class="flex items-center gap-2 min-w-0">
                    <BarChart3 class="size-3.5 text-muted-foreground shrink-0" />
                    <span class="truncate">{{ t('home.analyticsTool') }}</span>
                  </span>
                  <ExternalLink class="size-3 text-muted-foreground shrink-0" />
                </a>
              </li>
              <li>
                <a
                  :href="packFieldsDocUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="-mx-2 px-2 py-1.5 flex items-center justify-between gap-2 text-foreground/85 hover:bg-muted/75 hover:text-foreground transition-colors"
                >
                  <span class="flex items-center gap-2 min-w-0">
                    <BookOpen class="size-3.5 text-muted-foreground shrink-0" />
                    <span class="truncate">{{ t('home.packFieldsGuide') }}</span>
                  </span>
                  <ExternalLink class="size-3 text-muted-foreground shrink-0" />
                </a>
              </li>
              <li>
                <a
                  :href="fileFieldsDocUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="-mx-2 px-2 py-1.5 flex items-center justify-between gap-2 text-foreground/85 hover:bg-muted/75 hover:text-foreground transition-colors"
                >
                  <span class="flex items-center gap-2 min-w-0">
                    <FileText class="size-3.5 text-muted-foreground shrink-0" />
                    <span class="truncate">{{ t('home.fileFieldsGuide') }}</span>
                  </span>
                  <ExternalLink class="size-3 text-muted-foreground shrink-0" />
                </a>
              </li>
            </ul>
          </section>

          <!-- 站点统计（时刻表式双列紧凑键值） -->
          <section class="pt-5 space-y-3">
            <h2 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {{ t('home.siteStats') }}
            </h2>

            <dl class="space-y-2 text-sm tabular-nums">
              <div class="flex items-baseline justify-between gap-2">
                <dt class="text-muted-foreground text-xs">{{ t('home.statPackages') }}</dt>
                <dd class="font-semibold text-foreground">
                  <Skeleton v-if="statsQuery.isPending.value" class="h-4 w-12 rounded-none" />
                  <template v-else-if="statsQuery.data.value">
                    {{ numberFormatter.format(statsQuery.data.value.packageCount) }}
                  </template>
                  <template v-else>—</template>
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-2">
                <dt class="text-muted-foreground text-xs">{{ t('home.statDownloads') }}</dt>
                <dd class="font-semibold text-foreground">
                  <Skeleton v-if="statsQuery.isPending.value" class="h-4 w-16 rounded-none" />
                  <template v-else-if="statsQuery.data.value">
                    {{ numberFormatter.format(statsQuery.data.value.downloadCount) }}
                  </template>
                  <template v-else>—</template>
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-2">
                <dt class="text-muted-foreground text-xs">{{ t('home.statUsers') }}</dt>
                <dd class="font-semibold text-foreground">
                  <Skeleton v-if="statsQuery.isPending.value" class="h-4 w-16 rounded-none" />
                  <template v-else-if="statsQuery.data.value">
                    {{ numberFormatter.format(statsQuery.data.value.userCount) }}
                  </template>
                  <template v-else>—</template>
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-2">
                <dt class="text-muted-foreground text-xs">{{ t('home.statRunningDays') }}</dt>
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

          <!-- 服务状态公告 -->
          <section class="pt-5 space-y-2.5">
            <div class="flex items-center justify-between gap-2">
              <h2 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {{ t('home.serviceStatus') }}
              </h2>
              <a
                :href="statusDocUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="text-[11px] text-primary hover:underline underline-offset-4"
              >
                {{ t('home.statusLink') }}
              </a>
            </div>

            <div v-if="statusWikiQuery.isPending.value" class="space-y-2">
              <Skeleton class="h-3.5 w-full rounded-none" />
              <Skeleton class="h-3.5 w-4/5 rounded-none" />
            </div>

            <div
              v-else-if="statusWikiQuery.data.value && !statusWikiQuery.data.value.isEmpty"
              class="prose prose-xs max-w-none wiki-prose text-xs"
              v-html="statusWikiQuery.data.value.html"
            />

            <p v-else class="text-xs text-muted-foreground leading-relaxed">
              {{ t('home.statusEmpty') }}
            </p>
          </section>
        </div>
      </template>
    </SidebarLayout>
  </div>
</template>
