<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useQueries } from '@tanstack/vue-query'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
} from '@lucide/vue'
import SidebarLayout from '@/layouts/SidebarLayout.vue'
import PlatformBadge from '@/components/package/PlatformBadge.vue'
import FileAuditMenu from '@/components/admin/FileAuditMenu.vue'
import { PLATFORMS } from '@/config/platforms'
import { usePreferencesStore } from '@/stores/preferences'
import { useFilesQuery } from '@/queries/files'
import { packageKeys } from '@/queries/packages'
import { fetchPackageDetail } from '@/api/packages'
import type { FilePlatformFilter, FileValidationFilter } from '@/api/files'
import { formatApiErrorMessage } from '@/api/auth'
import { useBreadcrumbState, usePageBreadcrumbCleanup } from '@/composables/useBreadcrumb'
import type { PackageDetail } from '@/types/models'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const PAGE_SIZE = 20

const route = useRoute()
const router = useRouter()
const { t, te } = useI18n()
const preferences = usePreferencesStore()
const { setBreadcrumb } = useBreadcrumbState()
usePageBreadcrumbCleanup()

const mobileSheetOpen = ref(false)
const auditMenuRefs = ref<Record<number, InstanceType<typeof FileAuditMenu> | null>>({})

function setAuditMenuRef(fileId: number, el: unknown) {
  auditMenuRefs.value[fileId] = (el as InstanceType<typeof FileAuditMenu> | null) ?? null
}

function parseStatus(raw: unknown): FileValidationFilter {
  if (raw === 'validated' || raw === 'all' || raw === 'pending') return raw
  return 'pending'
}

function parsePlatform(raw: unknown): FilePlatformFilter {
  if (raw === 'hmmsim' || raw === 'openbve' || raw === 'all') return raw
  return 'all'
}

function parsePage(raw: unknown): number {
  const num = Number.parseInt(String(raw ?? '1'), 10)
  return Number.isFinite(num) && num >= 1 ? num : 1
}

const statusFilter = computed<FileValidationFilter>(() => parseStatus(route.query.status))
const platformFilter = computed<FilePlatformFilter>(() => parsePlatform(route.query.platform))
const page = computed<number>(() => parsePage(route.query.page))

function updateFilters(next: {
  status?: FileValidationFilter
  platform?: FilePlatformFilter
  page?: number
}) {
  const nextStatus = next.status ?? statusFilter.value
  const nextPlatform = next.platform ?? platformFilter.value
  const nextPage = next.page ?? page.value

  const query: Record<string, string> = {}
  if (nextStatus !== 'pending') query.status = nextStatus
  if (nextPlatform !== 'all') query.platform = nextPlatform
  if (nextPage > 1) query.page = String(nextPage)
  void router.replace({ query })
}

const filesQuery = useFilesQuery(
  computed(() => ({
    status: statusFilter.value,
    platform: platformFilter.value,
    page: page.value,
    pageSize: PAGE_SIZE,
  })),
)

const items = computed(() => filesQuery.data.value?.items ?? [])
const total = computed(() => filesQuery.data.value?.total ?? 0)
const filesErrorMessage = computed(() =>
  filesQuery.error.value ? formatApiErrorMessage(filesQuery.error.value, t, te) : '',
)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

watch(
  [totalPages, () => filesQuery.data.value],
  ([tp, data]) => {
    if (data && page.value > tp) {
      updateFilters({ page: tp })
    }
  },
)

// 并发解析当前页关联作品名称并复用缓存
const uniquePackageIds = computed(() => {
  const set = new Set<number>()
  for (const file of items.value) {
    if (file.PackageID > 0) set.add(file.PackageID)
  }
  return Array.from(set)
})

const packageQueries = useQueries({
  queries: computed(() =>
    uniquePackageIds.value.map((id) => ({
      queryKey: packageKeys.detail(id),
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchPackageDetail(id, signal),
      staleTime: 60_000,
    })),
  ),
})

const packageMap = computed(() => {
  const map = new Map<number, PackageDetail>()
  uniquePackageIds.value.forEach((id, idx) => {
    const data = packageQueries.value[idx]?.data
    if (data) map.set(id, data)
  })
  return map
})

function resolvePackageName(packageId: number): string {
  const pkg = packageMap.value.get(packageId)
  if (!pkg) return `#${packageId}`
  return preferences.formatS3(pkg.Name) || pkg.Identifier
}

const statusOptions = computed<{ value: FileValidationFilter; label: string }[]>(() => [
  { value: 'pending', label: t('adminFiles.filters.pending') },
  { value: 'validated', label: t('adminFiles.filters.validated') },
  { value: 'all', label: t('adminFiles.filters.all') },
])

const platformOptions = computed<{ value: FilePlatformFilter; label: string; color?: string }[]>(() => [
  { value: 'all', label: t('adminFiles.filters.allPlatforms') },
  { value: 'hmmsim', label: PLATFORMS.hmmsim.name, color: PLATFORMS.hmmsim.color },
  { value: 'openbve', label: PLATFORMS.openbve.name, color: PLATFORMS.openbve.color },
])

const displayStart = computed(() =>
  total.value === 0 ? 0 : (page.value - 1) * PAGE_SIZE + 1,
)
const displayEnd = computed(() =>
  total.value === 0 ? 0 : Math.min(page.value * PAGE_SIZE, total.value),
)

watchEffect(() => {
  const summary =
    filesQuery.data.value !== undefined
      ? t('adminFiles.totalCount', { count: total.value })
      : ''
  setBreadcrumb(
    [
      { label: t('nav.home'), to: '/' },
      { label: t('adminFiles.title') },
    ],
    summary,
  )
})
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 py-6">
    <SidebarLayout side="left" :hide-sidebar-on-mobile="true">
      <!-- 左侧筛选栏 -->
      <template #sidebar>
        <div class="flex flex-col gap-5">
          <section class="space-y-2">
            <div class="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {{ t('adminFiles.filters.statusLabel') }}
            </div>
            <div role="radiogroup" class="space-y-0.5">
              <button
                v-for="opt in statusOptions"
                :key="opt.value"
                type="button"
                role="radio"
                :aria-checked="statusFilter === opt.value"
                class="w-full px-2.5 py-1.5 flex items-center gap-2 text-left text-sm transition-colors cursor-pointer"
                :class="
                  statusFilter === opt.value
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-foreground/85 hover:bg-muted/80 hover:text-foreground'
                "
                @click="updateFilters({ status: opt.value, page: 1 })"
              >
                <span
                  class="size-2.5 border shrink-0"
                  :class="
                    statusFilter === opt.value
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground/40'
                  "
                  aria-hidden="true"
                />
                <span class="truncate">{{ opt.label }}</span>
              </button>
            </div>
          </section>

          <Separator />

          <section class="space-y-2">
            <div class="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {{ t('packages.platformLabel') }}
            </div>
            <div role="radiogroup" class="space-y-0.5">
              <button
                v-for="opt in platformOptions"
                :key="opt.value"
                type="button"
                role="radio"
                :aria-checked="platformFilter === opt.value"
                class="w-full px-2.5 py-1.5 flex items-center gap-2 text-left text-sm transition-colors cursor-pointer"
                :class="
                  platformFilter === opt.value
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-foreground/85 hover:bg-muted/80 hover:text-foreground'
                "
                @click="updateFilters({ platform: opt.value, page: 1 })"
              >
                <span
                  v-if="opt.color"
                  class="size-2.5 shrink-0"
                  :style="{ backgroundColor: opt.color }"
                  aria-hidden="true"
                />
                <span
                  v-else
                  class="size-2.5 border shrink-0"
                  :class="
                    platformFilter === opt.value
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground/40'
                  "
                  aria-hidden="true"
                />
                <span class="truncate">{{ opt.label }}</span>
              </button>
            </div>
          </section>
        </div>
      </template>

      <!-- 主栏大表格 -->
      <div>
        <div class="flex items-center justify-between gap-3 pb-3 border-b border-border">
          <div class="flex items-center gap-2 min-w-0 text-sm text-muted-foreground tabular-nums">
            <template v-if="filesQuery.isPending.value">
              <Skeleton class="h-4 w-36 rounded-none" />
            </template>
            <template v-else-if="filesQuery.data.value">
              <span v-if="total > 0">
                {{
                  t('packages.rangeSummary', {
                    start: displayStart,
                    end: displayEnd,
                    total,
                  })
                }}
              </span>
              <span v-else>{{ t('adminFiles.totalCount', { count: 0 }) }}</span>
            </template>

            <Loader2
              v-if="filesQuery.isFetching.value && !filesQuery.isPending.value"
              class="size-3.5 animate-spin text-primary shrink-0"
            />
          </div>

          <div class="flex items-center gap-2 lg:hidden">
            <Sheet v-model:open="mobileSheetOpen">
              <SheetTrigger as-child>
                <Button variant="outline" size="sm" class="rounded-none h-8 cursor-pointer">
                  <SlidersHorizontal class="size-3.5" />
                  <span>{{ t('packages.filterButton') }}</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" class="w-72 sm:max-w-xs p-5">
                <SheetHeader class="p-0 pb-4 border-b border-border">
                  <SheetTitle class="text-sm font-semibold">
                    {{ t('packages.filterTitle') }}
                  </SheetTitle>
                </SheetHeader>
                <div class="pt-4 space-y-5">
                  <section class="space-y-2">
                    <div class="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      {{ t('adminFiles.filters.statusLabel') }}
                    </div>
                    <div class="space-y-0.5">
                      <button
                        v-for="opt in statusOptions"
                        :key="opt.value"
                        type="button"
                        class="w-full px-2.5 py-1.5 text-left text-sm"
                        :class="statusFilter === opt.value ? 'bg-primary/10 text-primary font-medium' : ''"
                        @click="() => { updateFilters({ status: opt.value, page: 1 }); mobileSheetOpen = false }"
                      >
                        {{ opt.label }}
                      </button>
                    </div>
                  </section>
                  <Separator />
                  <section class="space-y-2">
                    <div class="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      {{ t('packages.platformLabel') }}
                    </div>
                    <div class="space-y-0.5">
                      <button
                        v-for="opt in platformOptions"
                        :key="opt.value"
                        type="button"
                        class="w-full px-2.5 py-1.5 text-left text-sm"
                        :class="platformFilter === opt.value ? 'bg-primary/10 text-primary font-medium' : ''"
                        @click="() => { updateFilters({ platform: opt.value, page: 1 }); mobileSheetOpen = false }"
                      >
                        {{ opt.label }}
                      </button>
                    </div>
                  </section>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <!-- 加载骨架 -->
        <div v-if="filesQuery.isPending.value" class="mt-4 space-y-2">
          <Skeleton v-for="i in 8" :key="i" class="h-12 w-full rounded-none" />
        </div>

        <!-- 错误态 -->
        <div
          v-else-if="filesQuery.isError.value && items.length === 0"
          class="my-6 border border-border bg-muted/30 p-6 space-y-3"
        >
          <p class="text-sm font-medium text-foreground">{{ t('adminFiles.errorTitle') }}</p>
          <p class="text-sm text-muted-foreground">
            {{ filesErrorMessage || t('errors.network') }}
          </p>
          <Button
            variant="outline"
            size="sm"
            class="rounded-none cursor-pointer"
            @click="() => filesQuery.refetch()"
          >
            <RefreshCw class="size-3.5" />
            <span>{{ t('common.retry') }}</span>
          </Button>
        </div>

        <!-- 空态 -->
        <div
          v-else-if="items.length === 0"
          class="my-6 border border-dashed border-border py-12 px-6 text-center"
        >
          <p class="text-sm text-muted-foreground">{{ t('adminFiles.emptyTitle') }}</p>
        </div>

        <!-- 审核大表格 -->
        <div
          v-else
          class="mt-4 border border-border overflow-x-auto bg-card transition-opacity"
          :class="{ 'opacity-65': filesQuery.isPlaceholderData.value }"
        >
          <table class="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr class="bg-muted/45 border-b border-border text-xs sm:text-sm font-semibold text-muted-foreground">
                <th scope="col" class="py-2.5 px-3 whitespace-nowrap">#ID</th>
                <th scope="col" class="py-2.5 px-3 whitespace-nowrap">
                  {{ t('adminFiles.headers.package') }}
                </th>
                <th scope="col" class="py-2.5 px-3 whitespace-nowrap">
                  {{ t('adminFiles.headers.versionPlatform') }}
                </th>
                <th scope="col" class="py-2.5 px-3 whitespace-nowrap">
                  {{ t('detail.tableHeaders.status') }}
                </th>
                <th scope="col" class="py-2.5 px-3 text-right whitespace-nowrap">
                  {{ t('packageEdit.versions.actionsHeader') }}
                </th>
              </tr>
            </thead>

            <tbody class="divide-y divide-border">
              <tr
                v-for="file in items"
                :key="file.ID"
                class="hover:bg-muted/35 transition-colors"
              >
                <td class="py-2.5 px-3 font-mono text-xs sm:text-sm text-muted-foreground tabular-nums whitespace-nowrap">
                  #{{ file.ID }}
                </td>

                <td class="py-2.5 px-3 max-w-[220px]">
                  <router-link
                    :to="`/packages/${file.PackageID}`"
                    class="font-medium text-foreground hover:text-primary hover:underline underline-offset-4 truncate block"
                  >
                    {{ resolvePackageName(file.PackageID) }}
                  </router-link>
                  <span class="text-[11px] font-mono text-muted-foreground">
                    #{{ file.PackageID }}
                  </span>
                </td>

                <td class="py-2.5 px-3 whitespace-nowrap">
                  <div class="flex items-center gap-2">
                    <span class="font-mono font-semibold text-foreground tabular-nums">
                      v{{ file.Version }}
                    </span>
                    <PlatformBadge :platforms="[file.Platform]" variant="label" />
                  </div>
                </td>

                <td class="py-2.5 px-3 text-xs sm:text-sm max-w-[200px]">
                  <span
                    v-if="file.NeedValidation && !file.Validated && file.RejectReason"
                    class="inline-flex items-start gap-1 text-destructive leading-snug"
                  >
                    <AlertCircle class="size-3.5 shrink-0 mt-0.5" />
                    <span>{{ `${t('common.rejected')}: ${file.RejectReason}` }}</span>
                  </span>
                  <span
                    v-else-if="file.NeedValidation && !file.Validated"
                    class="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 whitespace-nowrap"
                  >
                    <Clock class="size-3.5 shrink-0" />
                    <span>{{ t('common.validationPending') }}</span>
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center gap-1 text-muted-foreground whitespace-nowrap"
                  >
                    <CheckCircle2 class="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{{ t('common.validated') }}</span>
                  </span>
                </td>

                <td class="py-2 px-3 text-right whitespace-nowrap">
                  <div class="inline-flex items-center justify-end gap-1">
                    <!-- 实测下载 -->
                    <Tooltip v-if="file.FetchURL">
                      <TooltipTrigger as-child>
                        <Button
                          as-child
                          variant="ghost"
                          size="icon-sm"
                          class="rounded-none text-foreground/80 hover:text-primary hover:bg-primary/10"
                        >
                          <a
                            :href="file.FetchURL"
                            target="_blank"
                            rel="noopener noreferrer"
                            :aria-label="t('adminFiles.actions.downloadTest')"
                          >
                            <Download class="size-3.5" />
                          </a>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {{ t('adminFiles.actions.downloadTest') }}
                      </TooltipContent>
                    </Tooltip>

                    <!-- 高频快捷通过按钮 -->
                    <Button
                      v-if="!file.Validated"
                      type="button"
                      size="xs"
                      class="rounded-none cursor-pointer"
                      :disabled="filesQuery.isPlaceholderData.value"
                      @click="auditMenuRefs[file.ID]?.openValidateConfirm()"
                    >
                      <Check class="size-3" />
                      <span>{{ t('adminFiles.actions.approveShort') }}</span>
                    </Button>

                    <!-- 三点操作菜单 -->
                    <FileAuditMenu
                      :ref="(el) => setAuditMenuRef(file.ID, el)"
                      :file="file"
                      context="admin-table"
                      :disabled="filesQuery.isPlaceholderData.value"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 分页条 -->
        <nav
          v-if="totalPages > 1"
          aria-label="Pagination"
          class="mt-5 pt-4 border-t border-border flex items-center justify-between gap-3 text-sm tabular-nums"
        >
          <span class="text-muted-foreground">
            {{ t('packages.paginationPage', { page, totalPages }) }}
          </span>
          <div class="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              class="rounded-none h-8 px-2.5 cursor-pointer"
              :disabled="page <= 1"
              @click="updateFilters({ page: page - 1 })"
            >
              <ChevronLeft class="size-3.5" />
              <span>{{ t('packages.paginationPrev') }}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              class="rounded-none h-8 px-2.5 cursor-pointer"
              :disabled="page >= totalPages"
              @click="updateFilters({ page: page + 1 })"
            >
              <span>{{ t('packages.paginationNext') }}</span>
              <ChevronRight class="size-3.5" />
            </Button>
          </div>
        </nav>
      </div>
    </SidebarLayout>
  </div>
</template>
