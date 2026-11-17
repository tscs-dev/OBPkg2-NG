<script setup lang="ts">
import { computed, nextTick, ref, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useMediaQuery, useResizeObserver, useWindowSize } from '@vueuse/core'
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Globe,
  Mail,
  Pencil,
  RefreshCw,
  Search,
  Shield,
  X,
} from '@lucide/vue'
import SidebarLayout from '@/layouts/SidebarLayout.vue'
import PackageGhostRow from '@/components/package/PackageGhostRow.vue'
import { useUploaderDetailQuery } from '@/queries/uploaders'
import { usePreferencesStore } from '@/stores/preferences'
import { useAuthStore } from '@/stores/auth'
import { useBreadcrumbState, usePageBreadcrumbCleanup } from '@/composables/useBreadcrumb'
import { sanitizePackageHtml } from '@/utils/sanitize'
import { formatDateShort, formatLocalTimestamp } from '@/utils/date'
import type { PackageSummary } from '@/types/models'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type UploaderTab = 'bio' | 'packages'

const PAGE_SIZE = 20

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const preferences = usePreferencesStore()
const authStore = useAuthStore()
const { setBreadcrumb } = useBreadcrumbState()
usePageBreadcrumbCleanup()

const uploaderId = computed<number | null>(() => {
  const raw = String(route.params.id ?? '')
  if (!/^\d+$/.test(raw)) return null
  const num = Number.parseInt(raw, 10)
  return num > 0 ? num : null
})

const uploaderQuery = useUploaderDetailQuery(uploaderId)
const uploader = computed(() => uploaderQuery.data.value ?? null)

const primaryName = computed(() => {
  if (!uploader.value) return ''
  return preferences.formatS3(uploader.value.Name) || `#${uploader.value.ID}`
})

const secondaryName = computed(() => {
  if (!uploader.value) return ''
  return preferences.formatSecondaryS3(uploader.value.Name)
})

const monogram = computed(() => {
  const name = primaryName.value.trim()
  if (!name) return 'U'
  return Array.from(name)[0]!.toUpperCase()
})

const roleBadge = computed(() => {
  const priv = uploader.value?.Privilege ?? 0
  if (priv >= 100) return t('uploader.roleSuperAdmin')
  if (priv >= 50) return t('uploader.roleAdmin')
  if (priv >= 10) return t('uploader.roleModerator')
  return ''
})

const isSelf = computed(() => authStore.currentUserId === uploader.value?.ID)
const canEdit = computed(() =>
  uploader.value ? authStore.canEditUploader(uploader.value.ID) : false,
)

const editLocation = computed(() => {
  if (!uploader.value) return '/settings/profile'
  return isSelf.value
    ? '/settings/profile'
    : `/settings/profile?uid=${uploader.value.ID}`
})

const sanitizedBio = computed(() =>
  sanitizePackageHtml(uploader.value?.Description),
)

// 自适应桌面端 <=48vh 合流 / >52vh 双 Tab 滞回逻辑
const isDesktop = useMediaQuery('(min-width: 1024px)')
const { height: windowHeight } = useWindowSize()
const bioMeasureRef = ref<HTMLElement | null>(null)
const measuredBioHeight = ref(0)
const desktopUseTabs = ref(false)

function updateBioMeasurement() {
  if (!bioMeasureRef.value) {
    measuredBioHeight.value = 0
    return
  }
  measuredBioHeight.value = bioMeasureRef.value.getBoundingClientRect().height
}

function attachBioImageListeners() {
  if (!bioMeasureRef.value) return
  bioMeasureRef.value.querySelectorAll('img').forEach((img) => {
    if (!img.complete) {
      img.addEventListener('load', updateBioMeasurement, { once: true })
      img.addEventListener('error', updateBioMeasurement, { once: true })
    }
  })
}

useResizeObserver(bioMeasureRef, () => {
  updateBioMeasurement()
})

watch(
  [sanitizedBio, isDesktop],
  async () => {
    await nextTick()
    updateBioMeasurement()
    attachBioImageListeners()
  },
  { immediate: true },
)

watch(
  [measuredBioHeight, windowHeight, isDesktop, sanitizedBio],
  ([bioH, winH, desktop, bioHtml]) => {
    if (!bioHtml) {
      desktopUseTabs.value = false
      return
    }
    if (!desktop || winH <= 0) {
      desktopUseTabs.value = true
      return
    }
    const ratio = bioH / winH
    if (!desktopUseTabs.value && ratio > 0.52) {
      desktopUseTabs.value = true
    } else if (desktopUseTabs.value && ratio <= 0.48) {
      desktopUseTabs.value = false
    }
  },
  { immediate: true },
)

const shouldShowTabs = computed(
  () => Boolean(sanitizedBio.value) && (!isDesktop.value || desktopUseTabs.value),
)

const activeTab = computed<UploaderTab>(() => {
  const q = route.query.tab
  if (q === 'packages' || q === 'bio') return q
  return 'bio'
})

function setActiveTab(next: unknown) {
  if (next !== 'bio' && next !== 'packages') return
  const query = { ...route.query }
  if (next === 'bio') {
    delete query.tab
  } else {
    query.tab = next
  }
  void router.replace({ query })
}

// 发布的包列表（注入 uploader 基本信息并支持页内检索与本地分页）
const enrichedPackages = computed<PackageSummary[]>(() => {
  const u = uploader.value
  const list = u?.Packages ?? []
  if (!u || list.length === 0) return []
  const uploaderRef = {
    ID: u.ID,
    Name: u.Name,
    Email: u.Email,
    Homepage: u.Homepage,
    Privilege: u.Privilege,
  }
  return [...list]
    .sort((a, b) => new Date(b.UpdatedAt).getTime() - new Date(a.UpdatedAt).getTime())
    .map((pkg) => ({
      ...pkg,
      Uploader: pkg.Uploader ?? uploaderRef,
    }))
})

const hmmsimCount = computed(
  () =>
    enrichedPackages.value.filter((p) => p.Platforms?.includes('hmmsim')).length,
)
const openbveCount = computed(
  () =>
    enrichedPackages.value.filter((p) => p.Platforms?.includes('openbve')).length,
)

const packageFilter = ref('')
const currentPage = ref(1)

watch(uploaderId, () => {
  packageFilter.value = ''
  currentPage.value = 1
})

watch(packageFilter, () => {
  currentPage.value = 1
})

const filteredPackages = computed(() => {
  const kw = packageFilter.value.trim().toLowerCase()
  if (!kw) return enrichedPackages.value
  return enrichedPackages.value.filter((pkg) => {
    const fields = [
      pkg.Identifier,
      pkg.Name?.Local,
      pkg.Name?.English,
      pkg.Name?.Tag,
      pkg.Author?.Name?.Local,
      pkg.Author?.Name?.English,
    ]
    return fields.some((f) => f && f.toLowerCase().includes(kw))
  })
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredPackages.value.length / PAGE_SIZE)),
)

const pagedPackages = computed(() => {
  const safePage = Math.min(currentPage.value, totalPages.value)
  const start = (safePage - 1) * PAGE_SIZE
  return filteredPackages.value.slice(start, start + PAGE_SIZE)
})

// 图片点击放大灯箱
const lightboxUrl = ref<string | null>(null)
const lightboxOpen = computed({
  get: () => Boolean(lightboxUrl.value),
  set: (val: boolean) => {
    if (!val) lightboxUrl.value = null
  },
})

function handleProseClick(e: MouseEvent) {
  const target = e.target as HTMLElement | null
  if (target && target.tagName === 'IMG') {
    const src = (target as HTMLImageElement).src
    if (src) {
      lightboxUrl.value = src
    }
  }
}

watchEffect(() => {
  const label =
    primaryName.value ||
    (uploaderId.value ? `${t('uploader.breadcrumb')} #${uploaderId.value}` : t('uploader.breadcrumb'))
  const summary = uploader.value ? `#${uploader.value.ID}` : ''
  setBreadcrumb(
    [
      { label: t('nav.home'), to: '/' },
      { label },
    ],
    summary,
  )
})
</script>

<template>
  <div>
    <!-- 错误态 -->
    <div
      v-if="uploaderId === null || uploaderQuery.isError.value"
      class="max-w-7xl mx-auto px-4 sm:px-6 py-10"
    >
      <div class="border border-border bg-muted/30 p-6 max-w-xl space-y-3">
        <h1 class="text-base font-semibold text-foreground">
          {{ uploaderId === null ? t('uploader.invalidIdTitle') : t('uploader.notFoundTitle') }}
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ uploaderQuery.error.value?.message || t('errors.notFound') }}
        </p>
        <div class="flex items-center gap-2 pt-1">
          <Button as-child variant="outline" size="sm" class="rounded-none">
            <router-link to="/packages">{{ t('common.backToList') }}</router-link>
          </Button>
          <Button
            v-if="uploaderId !== null"
            variant="ghost"
            size="sm"
            class="rounded-none cursor-pointer"
            @click="() => uploaderQuery.refetch()"
          >
            <RefreshCw class="size-3.5" />
            <span>{{ t('common.retry') }}</span>
          </Button>
        </div>
      </div>
    </div>

    <!-- 骨架屏 -->
    <template v-else-if="uploaderQuery.isPending.value">
      <div class="bg-muted/35 border-b border-border">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <Skeleton class="size-14 shrink-0 rounded-none" />
            <div class="space-y-2">
              <Skeleton class="h-6 w-48 rounded-none" />
              <Skeleton class="h-4 w-32 rounded-none" />
            </div>
          </div>
          <Skeleton class="h-9 w-28 rounded-none" />
        </div>
      </div>

      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <SidebarLayout side="right">
          <div class="space-y-4">
            <Skeleton class="h-5 w-36 rounded-none" />
            <Skeleton class="h-4 w-full rounded-none" />
            <Skeleton class="h-4 w-4/5 rounded-none" />
          </div>
          <template #sidebar>
            <div class="space-y-3">
              <Skeleton class="h-4 w-24 rounded-none" />
              <Skeleton class="h-24 w-full rounded-none" />
            </div>
          </template>
        </SidebarLayout>
      </div>
    </template>

    <!-- 作者主页主体 -->
    <template v-else-if="uploader">
      <!-- 全宽创作者标题带 -->
      <section class="bg-muted/35 border-b border-border">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div class="flex items-center gap-4 min-w-0">
            <div
              class="size-14 shrink-0 flex items-center justify-center bg-primary/12 text-primary border border-primary/25 font-mono text-xl font-bold select-none"
              aria-hidden="true"
            >
              {{ monogram }}
            </div>

            <div class="min-w-0 space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-foreground break-words">
                  {{ primaryName }}
                </h1>
                <span
                  v-if="roleBadge"
                  class="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium bg-primary/10 text-primary border border-primary/25"
                >
                  <Shield class="size-3" />
                  <span>{{ roleBadge }}</span>
                </span>
              </div>

              <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground tabular-nums">
                <span v-if="secondaryName" class="text-sm text-muted-foreground">
                  {{ secondaryName }}
                </span>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              v-if="uploader.Homepage"
              as-child
              variant="outline"
              size="sm"
              class="rounded-none"
            >
              <a :href="uploader.Homepage" target="_blank" rel="noopener noreferrer">
                <Globe class="size-3.5" />
                <span>{{ t('uploader.websiteButton') }}</span>
              </a>
            </Button>

            <Button
              v-if="canEdit"
              as-child
              size="sm"
              class="rounded-none"
            >
              <router-link :to="editLocation">
                <Pencil class="size-3.5" />
                <span>
                  {{ isSelf ? t('uploader.editProfileButton') : t('uploader.manageProfileButton') }}
                </span>
              </router-link>
            </Button>
          </div>
        </div>
      </section>

      <!-- 下部双栏内容区 -->
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <SidebarLayout side="right">
          <!-- 左主栏 -->
          <div class="relative min-w-0">
            <!-- 同宽隐藏测量层：用于即使切到包列表 Tab 也能准确观测桌面端高度变化 -->
            <div
              v-if="sanitizedBio"
              ref="bioMeasureRef"
              aria-hidden="true"
              class="pointer-events-none invisible absolute left-0 right-0 top-0 -z-10 prose prose-sm sm:prose-base max-w-none package-prose"
              v-html="sanitizedBio"
            />

            <!-- 情形 1：双 Tab 模式（移动端 或 桌面端介绍高度 > 52vh） -->
            <Tabs
              v-if="shouldShowTabs"
              :model-value="activeTab"
              @update:model-value="setActiveTab"
            >
              <TabsList class="w-full justify-start h-auto bg-transparent p-0 rounded-none border-b border-border gap-5">
                <TabsTrigger
                  value="bio"
                  class="flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 py-2.5 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-foreground hover:text-foreground cursor-pointer"
                >
                  {{ t('uploader.tabs.bio') }}
                </TabsTrigger>
                <TabsTrigger
                  value="packages"
                  class="flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 py-2.5 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-foreground hover:text-foreground cursor-pointer tabular-nums"
                >
                  <span>{{ t('uploader.tabs.packages') }}</span>
                  <span class="ml-1 text-xs text-muted-foreground">({{ enrichedPackages.length }})</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="bio" class="pt-5 mt-0">
                <div
                  class="prose prose-sm sm:prose-base max-w-none package-prose"
                  @click="handleProseClick"
                  v-html="sanitizedBio"
                />
              </TabsContent>

              <TabsContent value="packages" class="pt-5 mt-0">
                <!-- 页内搜索栏 -->
                <div v-if="enrichedPackages.length > 0" class="flex items-center justify-between gap-3 pb-3 border-b border-border">
                  <div class="relative w-full max-w-xs">
                    <Search class="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      v-model="packageFilter"
                      type="text"
                      :placeholder="t('uploader.searchPlaceholder')"
                      class="w-full h-8 pl-8 pr-7 text-xs bg-background border border-input focus:border-primary focus:outline-none"
                    />
                    <button
                      v-if="packageFilter"
                      type="button"
                      class="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                      @click="packageFilter = ''"
                    >
                      <X class="size-3" />
                    </button>
                  </div>
                  <span class="text-xs text-muted-foreground tabular-nums shrink-0">
                    {{ t('packages.totalCount', { count: filteredPackages.length }) }}
                  </span>
                </div>

                <div
                  v-if="enrichedPackages.length === 0"
                  class="border border-dashed border-border py-12 px-6 text-center"
                >
                  <p class="text-sm text-muted-foreground">{{ t('uploader.noPackages') }}</p>
                </div>

                <div
                  v-else-if="filteredPackages.length === 0"
                  class="my-4 border border-dashed border-border py-10 px-6 text-center"
                >
                  <p class="text-sm text-muted-foreground">{{ t('uploader.noMatchingPackages') }}</p>
                </div>

                <div v-else class="divide-y divide-border/70">
                  <PackageGhostRow
                    v-for="pkg in pagedPackages"
                    :key="pkg.ID"
                    :pkg="pkg"
                  />
                </div>

                <!-- 本地分页 -->
                <nav
                  v-if="totalPages > 1"
                  class="mt-5 pt-4 border-t border-border flex items-center justify-between gap-3 text-xs tabular-nums"
                >
                  <span class="text-muted-foreground">
                    {{ t('packages.paginationPage', { page: currentPage, totalPages }) }}
                  </span>
                  <div class="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      class="rounded-none h-8 px-2.5 text-xs cursor-pointer"
                      :disabled="currentPage <= 1"
                      @click="currentPage -= 1"
                    >
                      <ChevronLeft class="size-3.5" />
                      <span>{{ t('packages.paginationPrev') }}</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      class="rounded-none h-8 px-2.5 text-xs cursor-pointer"
                      :disabled="currentPage >= totalPages"
                      @click="currentPage += 1"
                    >
                      <span>{{ t('packages.paginationNext') }}</span>
                      <ChevronRight class="size-3.5" />
                    </Button>
                  </div>
                </nav>
              </TabsContent>
            </Tabs>

            <!-- 情形 2：合流模式（无介绍 或 桌面端短介绍 <= 48vh） -->
            <div v-else class="flex flex-col gap-6">
              <section v-if="sanitizedBio" class="space-y-3">
                <h2 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {{ t('uploader.bioHeading') }}
                </h2>
                <div
                  class="prose prose-sm sm:prose-base max-w-none package-prose"
                  @click="handleProseClick"
                  v-html="sanitizedBio"
                />
              </section>

              <Separator v-if="sanitizedBio" />

              <section>
                <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
                  <h2 class="text-sm font-semibold tracking-tight text-foreground tabular-nums">
                    {{ t('uploader.packagesHeading') }}
                    <span class="ml-1 text-xs font-normal text-muted-foreground">
                      ({{ filteredPackages.length }})
                    </span>
                  </h2>

                  <div v-if="enrichedPackages.length > 0" class="relative w-full sm:w-64">
                    <Search class="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      v-model="packageFilter"
                      type="text"
                      :placeholder="t('uploader.searchPlaceholder')"
                      class="w-full h-8 pl-8 pr-7 text-xs bg-background border border-input focus:border-primary focus:outline-none"
                    />
                    <button
                      v-if="packageFilter"
                      type="button"
                      class="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                      @click="packageFilter = ''"
                    >
                      <X class="size-3" />
                    </button>
                  </div>
                </div>

                <div
                  v-if="enrichedPackages.length === 0"
                  class="mt-4 border border-dashed border-border py-12 px-6 text-center"
                >
                  <p class="text-sm text-muted-foreground">{{ t('uploader.noPackages') }}</p>
                </div>

                <div
                  v-else-if="filteredPackages.length === 0"
                  class="mt-4 border border-dashed border-border py-10 px-6 text-center"
                >
                  <p class="text-sm text-muted-foreground">{{ t('uploader.noMatchingPackages') }}</p>
                </div>

                <div v-else class="divide-y divide-border/70">
                  <PackageGhostRow
                    v-for="pkg in pagedPackages"
                    :key="pkg.ID"
                    :pkg="pkg"
                  />
                </div>

                <nav
                  v-if="totalPages > 1"
                  class="mt-5 pt-4 border-t border-border flex items-center justify-between gap-3 text-xs tabular-nums"
                >
                  <span class="text-muted-foreground">
                    {{ t('packages.paginationPage', { page: currentPage, totalPages }) }}
                  </span>
                  <div class="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      class="rounded-none h-8 px-2.5 text-xs cursor-pointer"
                      :disabled="currentPage <= 1"
                      @click="currentPage -= 1"
                    >
                      <ChevronLeft class="size-3.5" />
                      <span>{{ t('packages.paginationPrev') }}</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      class="rounded-none h-8 px-2.5 text-xs cursor-pointer"
                      :disabled="currentPage >= totalPages"
                      @click="currentPage += 1"
                    >
                      <span>{{ t('packages.paginationNext') }}</span>
                      <ChevronRight class="size-3.5" />
                    </Button>
                  </div>
                </nav>
              </section>
            </div>
          </div>

          <!-- 右侧元数据侧栏 -->
          <template #sidebar>
            <div class="flex flex-col gap-5">
              <section class="space-y-3">
                <h2 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {{ t('uploader.meta.accountHeading') }}
                </h2>

                <dl class="space-y-2.5 text-xs">
                  <div class="space-y-0.5">
                    <dt class="text-muted-foreground">{{ t('uploader.meta.userId') }}</dt>
                    <dd class="font-mono text-foreground tabular-nums">#{{ uploader.ID }}</dd>
                  </div>

                  <div v-if="uploader.Email" class="space-y-0.5">
                    <dt class="text-muted-foreground">{{ t('uploader.meta.email') }}</dt>
                    <dd>
                      <a
                        :href="`mailto:${uploader.Email}`"
                        class="inline-flex items-center gap-1.5 text-primary hover:underline underline-offset-4 break-all"
                      >
                        <Mail class="size-3 shrink-0" />
                        <span>{{ uploader.Email }}</span>
                      </a>
                    </dd>
                  </div>

                  <div v-if="uploader.Homepage" class="space-y-0.5">
                    <dt class="text-muted-foreground">{{ t('uploader.meta.website') }}</dt>
                    <dd>
                      <a
                        :href="uploader.Homepage"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="inline-flex items-center gap-1 text-primary hover:underline underline-offset-4 break-all"
                      >
                        <span>{{ uploader.Homepage }}</span>
                        <ExternalLink class="size-3 shrink-0" />
                      </a>
                    </dd>
                  </div>

                  <div v-if="uploader.CreatedAt" class="space-y-0.5">
                    <dt class="text-muted-foreground">{{ t('uploader.meta.joinedAt') }}</dt>
                    <dd class="text-foreground tabular-nums">
                      <Tooltip>
                        <TooltipTrigger as-child>
                          <time :datetime="uploader.CreatedAt">
                            {{ formatDateShort(uploader.CreatedAt) }}
                          </time>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          {{ formatLocalTimestamp(uploader.CreatedAt) }}
                        </TooltipContent>
                      </Tooltip>
                    </dd>
                  </div>
                </dl>
              </section>

              <Separator />

              <section class="space-y-3">
                <h2 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {{ t('uploader.meta.statsHeading') }}
                </h2>

                <dl class="space-y-2 text-xs tabular-nums">
                  <div class="flex items-baseline justify-between gap-2">
                    <dt class="text-muted-foreground">{{ t('uploader.meta.packageCount') }}</dt>
                    <dd class="font-semibold text-foreground">{{ enrichedPackages.length }}</dd>
                  </div>
                  <div class="flex items-baseline justify-between gap-2">
                    <dt class="text-muted-foreground">{{ t('uploader.meta.hmmsimCount') }}</dt>
                    <dd class="font-semibold text-foreground">{{ hmmsimCount }}</dd>
                  </div>
                  <div class="flex items-baseline justify-between gap-2">
                    <dt class="text-muted-foreground">{{ t('uploader.meta.openbveCount') }}</dt>
                    <dd class="font-semibold text-foreground">{{ openbveCount }}</dd>
                  </div>
                </dl>
              </section>
            </div>
          </template>
        </SidebarLayout>
      </div>
    </template>

    <!-- 图片预览灯箱 -->
    <Dialog v-model:open="lightboxOpen">
      <DialogContent class="max-w-4xl rounded-none p-2 sm:p-3">
        <DialogHeader class="sr-only">
          <DialogTitle>{{ primaryName }}</DialogTitle>
          <DialogDescription>{{ t('detail.zoomImage') }}</DialogDescription>
        </DialogHeader>
        <div v-if="lightboxUrl" class="flex items-center justify-center bg-black/5 max-h-[85vh] overflow-auto">
          <img
            :src="lightboxUrl"
            :alt="primaryName"
            class="max-w-full max-h-[82vh] object-contain"
          />
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
