<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  SlidersHorizontal,
} from '@lucide/vue'
import SidebarLayout from '@/layouts/SidebarLayout.vue'
import PackageFilterSidebar from '@/components/package/PackageFilterSidebar.vue'
import PackageGhostRow from '@/components/package/PackageGhostRow.vue'
import { usePackagesQuery } from '@/queries/packages'
import type { PlatformFilter } from '@/api/packages'
import { useAuthStore } from '@/stores/auth'
import { useBreadcrumbState, usePageBreadcrumbCleanup } from '@/composables/useBreadcrumb'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

const PAGE_SIZE = 20

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const authStore = useAuthStore()
const { setBreadcrumb } = useBreadcrumbState()
usePageBreadcrumbCleanup()

const mobileSheetOpen = ref(false)

function parsePlatformQuery(raw: unknown): PlatformFilter {
  if (raw === 'hmmsim' || raw === 'openbve' || raw === 'all' || raw === '+') {
    return raw
  }
  return '+'
}

function parsePageQuery(raw: unknown): number {
  const num = Number.parseInt(String(raw ?? '1'), 10)
  return Number.isFinite(num) && num >= 1 ? num : 1
}

const platform = computed<PlatformFilter>(() => parsePlatformQuery(route.query.platform))
const keyword = computed<string>(() =>
  typeof route.query.q === 'string' ? route.query.q : '',
)
const page = computed<number>(() => parsePageQuery(route.query.page))

const hasActiveCustomFilter = computed(
  () => platform.value !== '+' || keyword.value.trim().length > 0,
)

function updateFilters(next: {
  platform?: PlatformFilter
  keyword?: string
  page?: number
}) {
  const nextPlatform = next.platform ?? platform.value
  const nextKeyword = next.keyword ?? keyword.value
  const nextPage = next.page ?? page.value

  const query: Record<string, string> = {}
  if (nextPlatform !== '+') {
    query.platform = nextPlatform
  }
  if (nextKeyword.trim()) {
    query.q = nextKeyword.trim()
  }
  if (nextPage > 1) {
    query.page = String(nextPage)
  }

  router.replace({ query })
}

function handlePlatformChange(nextPlatform: PlatformFilter) {
  updateFilters({ platform: nextPlatform, page: 1 })
}

function handleKeywordChange(nextKeyword: string) {
  updateFilters({ keyword: nextKeyword, page: 1 })
}

function handleReset() {
  updateFilters({ platform: '+', keyword: '', page: 1 })
  mobileSheetOpen.value = false
}

function goToPage(nextPage: number) {
  if (nextPage < 1 || nextPage > totalPages.value || nextPage === page.value) return
  updateFilters({ page: nextPage })
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const packagesQuery = usePackagesQuery(
  computed(() => ({
    platform: platform.value,
    keyword: keyword.value,
    page: page.value,
    pageSize: PAGE_SIZE,
  })),
)

const items = computed(() => packagesQuery.data.value?.items ?? [])
const total = computed(() => packagesQuery.data.value?.total ?? 0)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

const displayStart = computed(() =>
  total.value === 0 ? 0 : (page.value - 1) * PAGE_SIZE + 1,
)
const displayEnd = computed(() =>
  total.value === 0 ? 0 : Math.min(page.value * PAGE_SIZE, total.value),
)

watchEffect(() => {
  const summary =
    packagesQuery.data.value !== undefined
      ? t('packages.totalCount', { count: total.value })
      : ''
  setBreadcrumb(
    [
      { label: t('nav.home'), to: '/' },
      { label: t('packages.breadcrumb') },
    ],
    summary,
  )
})

const paginationTokens = computed<(number | 'ellipsis')[]>(() => {
  const count = totalPages.value
  const current = page.value
  if (count <= 7) {
    return Array.from({ length: count }, (_, idx) => idx + 1)
  }
  const tokens: (number | 'ellipsis')[] = [1]
  const left = Math.max(2, current - 1)
  const right = Math.min(count - 1, current + 1)
  if (left > 2) tokens.push('ellipsis')
  for (let p = left; p <= right; p++) {
    tokens.push(p)
  }
  if (right < count - 1) tokens.push('ellipsis')
  tokens.push(count)
  return tokens
})
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 py-6">
    <SidebarLayout side="left" :hide-sidebar-on-mobile="true">
      <template #sidebar>
        <PackageFilterSidebar
          :platform="platform"
          :keyword="keyword"
          @update:platform="handlePlatformChange"
          @update:keyword="handleKeywordChange"
          @reset="handleReset"
        />
      </template>

      <!-- 主栏 -->
      <div>
        <!-- 顶部结果摘要与移动端筛选抽屉触发器 -->
        <div class="flex items-center justify-between gap-3 pb-3 border-b border-border">
          <div class="flex items-center gap-2 min-w-0 text-xs text-muted-foreground tabular-nums">
            <template v-if="packagesQuery.isPending.value">
              <Skeleton class="h-4 w-36 rounded-none" />
            </template>
            <template v-else-if="packagesQuery.data.value">
              <span v-if="total > 0">
                {{
                  t('packages.rangeSummary', {
                    start: displayStart,
                    end: displayEnd,
                    total,
                  })
                }}
              </span>
              <span v-else>{{ t('packages.totalCount', { count: 0 }) }}</span>
            </template>

            <Loader2
              v-if="packagesQuery.isFetching.value && !packagesQuery.isPending.value"
              class="size-3.5 animate-spin text-primary shrink-0"
            />
          </div>

          <div class="flex items-center gap-2">
            <Button
              v-if="authStore.isLoggedIn && authStore.privilege >= 0"
              as-child
              size="sm"
              class="rounded-none h-8 text-xs"
            >
              <router-link to="/packages/new">
                <Plus class="size-3.5" />
                <span>{{ t('nav.newPackage') }}</span>
              </router-link>
            </Button>

            <div class="lg:hidden">
              <Sheet v-model:open="mobileSheetOpen">
                <SheetTrigger as-child>
                  <Button variant="outline" size="sm" class="rounded-none h-8 text-xs cursor-pointer">
                    <SlidersHorizontal class="size-3.5" />
                    <span>{{ t('packages.filterButton') }}</span>
                    <span
                      v-if="hasActiveCustomFilter"
                      class="size-1.5 rounded-full bg-primary"
                      aria-hidden="true"
                    />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" class="w-72 sm:max-w-xs p-5">
                  <SheetHeader class="p-0 pb-4 border-b border-border">
                    <SheetTitle class="text-sm font-semibold">
                      {{ t('packages.filterTitle') }}
                    </SheetTitle>
                  </SheetHeader>
                  <div class="pt-4">
                    <PackageFilterSidebar
                      :platform="platform"
                      :keyword="keyword"
                      @update:platform="handlePlatformChange"
                      @update:keyword="handleKeywordChange"
                      @reset="handleReset"
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>

        <!-- 选择「全部条目」时的说明警告 -->
        <div
          v-if="platform === 'all'"
          role="status"
          class="mt-3 mb-1 border border-amber-500/35 bg-amber-500/8 px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200 leading-relaxed"
        >
          <AlertTriangle class="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <span>{{ t('packages.allEntriesNotice') }}</span>
        </div>

        <!-- 首次加载骨架屏 -->
        <div v-if="packagesQuery.isPending.value" class="divide-y divide-border/60">
          <div v-for="i in 8" :key="i" class="py-3 flex items-start gap-3.5">
            <Skeleton class="w-[104px] h-[68px] sm:w-[144px] sm:h-[90px] shrink-0 rounded-none" />
            <div class="flex-1 space-y-2 py-0.5">
              <div class="flex items-center justify-between gap-4">
                <Skeleton class="h-4 w-2/3 rounded-none" />
                <Skeleton class="h-4 w-16 rounded-none hidden sm:block" />
              </div>
              <Skeleton class="h-3 w-1/3 rounded-none" />
              <Skeleton class="h-3 w-1/2 mt-3 rounded-none" />
            </div>
          </div>
        </div>

        <!-- 错误态 -->
        <div
          v-else-if="packagesQuery.isError.value && items.length === 0"
          class="my-6 border border-border bg-muted/30 p-6 space-y-3"
        >
          <p class="text-sm font-medium text-foreground">
            {{ t('packages.errorTitle') }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ packagesQuery.error.value?.message || t('errors.network') }}
          </p>
          <Button
            variant="outline"
            size="sm"
            class="rounded-none cursor-pointer"
            @click="() => packagesQuery.refetch()"
          >
            <RefreshCw class="size-3.5" />
            <span>{{ t('common.retry') }}</span>
          </Button>
        </div>

        <!-- 空态 -->
        <div
          v-else-if="items.length === 0"
          class="my-6 border border-dashed border-border py-12 px-6 text-center space-y-3"
        >
          <p class="text-sm font-medium text-foreground">
            {{ t('packages.emptyTitle') }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ t('packages.emptyDesc') }}
          </p>
          <Button
            v-if="hasActiveCustomFilter"
            variant="outline"
            size="sm"
            class="rounded-none cursor-pointer"
            @click="handleReset"
          >
            <span>{{ t('packages.resetFilters') }}</span>
          </Button>
        </div>

        <!-- Ghost 包列表 -->
        <div
          v-else
          class="divide-y divide-border/50 transition-opacity duration-150"
          :class="{ 'opacity-65': packagesQuery.isPlaceholderData.value }"
        >
          <PackageGhostRow
            v-for="pkg in items"
            :key="pkg.ID"
            :pkg="pkg"
          />
        </div>

        <!-- 分页条 -->
        <nav
          v-if="totalPages > 1"
          aria-label="Pagination"
          class="mt-6 pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3"
        >
          <span class="text-xs text-muted-foreground tabular-nums">
            {{ t('packages.paginationPage', { page, totalPages }) }}
          </span>

          <div class="flex items-center gap-1 tabular-nums">
            <Button
              variant="outline"
              size="sm"
              class="rounded-none h-8 px-2.5 text-xs cursor-pointer"
              :disabled="page <= 1"
              @click="goToPage(page - 1)"
            >
              <ChevronLeft class="size-3.5" />
              <span class="hidden sm:inline">{{ t('packages.paginationPrev') }}</span>
            </Button>

            <template v-for="(token, idx) in paginationTokens" :key="`${idx}-${token}`">
              <span
                v-if="token === 'ellipsis'"
                class="px-2 text-xs text-muted-foreground select-none"
              >
                …
              </span>
              <Button
                v-else
                :variant="token === page ? 'default' : 'outline'"
                size="sm"
                class="rounded-none h-8 min-w-8 px-2 text-xs cursor-pointer"
                :aria-current="token === page ? 'page' : undefined"
                @click="goToPage(token)"
              >
                {{ token }}
              </Button>
            </template>

            <Button
              variant="outline"
              size="sm"
              class="rounded-none h-8 px-2.5 text-xs cursor-pointer"
              :disabled="page >= totalPages"
              @click="goToPage(page + 1)"
            >
              <span class="hidden sm:inline">{{ t('packages.paginationNext') }}</span>
              <ChevronRight class="size-3.5" />
            </Button>
          </div>
        </nav>
      </div>
    </SidebarLayout>
  </div>
</template>
