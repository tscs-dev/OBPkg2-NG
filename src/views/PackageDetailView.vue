<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useClipboard } from '@vueuse/core'
import {
  Check,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Mail,
  MessageSquare,
  Pencil,
  RefreshCw,
  ZoomIn,
} from '@lucide/vue'
import SidebarLayout from '@/layouts/SidebarLayout.vue'
import PackageThumbnail from '@/components/package/PackageThumbnail.vue'
import PlatformBadge from '@/components/package/PlatformBadge.vue'
import PackageVersionList from '@/components/package/PackageVersionList.vue'
import HomepageCtaButton from '@/components/package/HomepageCtaButton.vue'
import ImageLightbox, { type LightboxImageItem } from '@/components/common/ImageLightbox.vue'
import { usePackageDetailQuery } from '@/queries/packages'
import { useAuthStore } from '@/stores/auth'
import { usePreferencesStore } from '@/stores/preferences'
import { useBreadcrumbState, usePageBreadcrumbCleanup } from '@/composables/useBreadcrumb'
import { sanitizePackageHtml } from '@/utils/sanitize'
import { formatDateShort, formatLocalTimestamp } from '@/utils/date'
import { hasValidAuthor } from '@/utils/package'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type DetailTab = 'description' | 'downloads' | 'comments'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const authStore = useAuthStore()
const preferences = usePreferencesStore()
const { setBreadcrumb } = useBreadcrumbState()
usePageBreadcrumbCleanup()

const { copy, copied } = useClipboard({ copiedDuring: 1500 })
const copiedField = ref<'identifier' | 'guid' | null>(null)

const packageId = computed<number | null>(() => {
  const raw = String(route.params.id ?? '')
  if (!/^\d+$/.test(raw)) return null
  const num = Number.parseInt(raw, 10)
  return num > 0 ? num : null
})

const activeTab = computed<DetailTab>(() => {
  const q = route.query.tab
  if (q === 'downloads' || q === 'comments' || q === 'description') {
    return q
  }
  return 'description'
})

const tabsAnchorRef = ref<HTMLElement | null>(null)

const detailQuery = usePackageDetailQuery(packageId)
const pkg = computed(() => detailQuery.data.value ?? null)

const primaryName = computed(() => {
  if (!pkg.value) return ''
  return preferences.formatS3(pkg.value.Name) || pkg.value.Identifier
})

const secondaryName = computed(() => {
  if (!pkg.value) return ''
  return preferences.formatSecondaryS3(pkg.value.Name)
})

const isRepost = computed(() => hasValidAuthor(pkg.value?.Author))

const authorDisplayName = computed(() => {
  if (!isRepost.value || !pkg.value?.Author) return ''
  return preferences.formatS3(pkg.value.Author.Name)
})

const uploaderDisplayName = computed(() => {
  if (!pkg.value?.Uploader) return ''
  return preferences.formatS3(pkg.value.Uploader.Name)
})

const visibleFiles = computed(() =>
  (pkg.value?.Files ?? []).filter((file) => !file.NeedValidation || file.Validated),
)

const filesCount = computed(() => visibleFiles.value.length)

const sanitizedDescription = computed(() =>
  sanitizePackageHtml(pkg.value?.Description),
)

// 缩略图及描述中图片点击放大灯箱（支持多图翻页）
const lightboxOpen = ref(false)
const lightboxIndex = ref(0)

const lightboxImages = computed<LightboxImageItem[]>(() => {
  const list: LightboxImageItem[] = []
  const seen = new Set<string>()
  const pushImg = (src?: string | null, alt?: string) => {
    const trimmed = src?.trim()
    if (!trimmed || seen.has(trimmed)) return
    seen.add(trimmed)
    list.push({ src: trimmed, alt })
  }

  pushImg(pkg.value?.Thumbnail, primaryName.value)

  if (sanitizedDescription.value && typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(sanitizedDescription.value, 'text/html')
    doc.querySelectorAll('img[src]').forEach((img) => {
      pushImg(img.getAttribute('src'), img.getAttribute('alt') || primaryName.value)
    })
  }
  return list
})

function openLightbox(url?: string) {
  const target = url?.trim()
  if (!target) return
  const idx = lightboxImages.value.findIndex((item) => item.src === target)
  lightboxIndex.value = idx >= 0 ? idx : 0
  lightboxOpen.value = true
}

function handleProseClick(e: MouseEvent) {
  const target = e.target as HTMLElement | null
  if (target && target.tagName === 'IMG') {
    const imgEl = target as HTMLImageElement
    const src = imgEl.getAttribute('src') || imgEl.src
    if (src) {
      openLightbox(src)
    }
  }
}

function setActiveTab(next: unknown) {
  if (next !== 'description' && next !== 'downloads' && next !== 'comments') {
    return
  }
  const query = { ...route.query }
  if (next === 'description') {
    delete query.tab
  } else {
    query.tab = next
  }
  router.replace({ query })
}

function jumpToDownloads() {
  setActiveTab('downloads')
  tabsAnchorRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function copyText(field: 'identifier' | 'guid', text: string) {
  copiedField.value = field
  await copy(text)
}

watchEffect(() => {
  const label = primaryName.value || (packageId.value ? `#${packageId.value}` : t('packages.breadcrumb'))
  const summary = pkg.value ? `#${pkg.value.ID}` : ''
  setBreadcrumb(
    [
      { label: t('nav.home'), to: '/' },
      { label: t('packages.breadcrumb'), to: '/packages' },
      { label },
    ],
    summary,
  )
})
</script>

<template>
  <div>
    <!-- 无效 ID 或加载错误态 -->
    <div
      v-if="packageId === null || detailQuery.isError.value"
      class="max-w-7xl mx-auto px-4 sm:px-6 py-10"
    >
      <div class="border border-border bg-muted/30 p-6 max-w-xl space-y-3">
        <h1 class="text-base font-semibold text-foreground">
          {{ packageId === null ? t('detail.invalidIdTitle') : t('detail.notFoundTitle') }}
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ detailQuery.error.value?.message || t('errors.notFound') }}
        </p>
        <div class="flex items-center gap-2 pt-1">
          <Button as-child variant="outline" size="sm" class="rounded-none">
            <router-link to="/packages">{{ t('common.backToList') }}</router-link>
          </Button>
          <Button
            v-if="packageId !== null"
            variant="ghost"
            size="sm"
            class="rounded-none cursor-pointer"
            @click="() => detailQuery.refetch()"
          >
            <RefreshCw class="size-3.5" />
            <span>{{ t('common.retry') }}</span>
          </Button>
        </div>
      </div>
    </div>

    <!-- 骨架屏 -->
    <template v-else-if="detailQuery.isPending.value">
      <div class="bg-muted/35 border-b border-border">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div class="flex items-start gap-4">
            <Skeleton class="w-[144px] h-[90px] sm:w-[192px] sm:h-[120px] shrink-0 rounded-none" />
            <div class="space-y-2.5 py-1">
              <Skeleton class="h-6 w-64 rounded-none" />
              <Skeleton class="h-4 w-44 rounded-none" />
              <Skeleton class="h-4 w-52 rounded-none" />
            </div>
          </div>
          <Skeleton class="h-9 w-32 rounded-none" />
        </div>
      </div>

      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <SidebarLayout side="right">
          <div class="space-y-4">
            <Skeleton class="h-9 w-64 rounded-none" />
            <Skeleton class="h-4 w-full rounded-none" />
            <Skeleton class="h-4 w-5/6 rounded-none" />
            <Skeleton class="h-4 w-3/4 rounded-none" />
          </div>
          <template #sidebar>
            <div class="space-y-4">
              <Skeleton class="h-4 w-28 rounded-none" />
              <Skeleton class="h-20 w-full rounded-none" />
              <Skeleton class="h-4 w-28 rounded-none" />
              <Skeleton class="h-32 w-full rounded-none" />
            </div>
          </template>
        </SidebarLayout>
      </div>
    </template>

    <!-- 详情主体 -->
    <template v-else-if="pkg">
      <!-- 全宽标题部分 -->
      <section class="bg-muted/35 border-b border-border">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div class="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-5 min-w-0">
            <!-- 预览图（有原图时支持点击放大） -->
            <button
              v-if="pkg.Thumbnail"
              type="button"
              class="group relative w-[160px] h-[100px] sm:w-[192px] sm:h-[120px] shrink-0 cursor-zoom-in text-left focus-visible:outline-2 focus-visible:outline-ring"
              :title="t('detail.zoomImage')"
              @click="openLightbox(pkg.Thumbnail)"
            >
              <PackageThumbnail
                :thumbnail="pkg.Thumbnail"
                :thumbnail-lq="pkg.ThumbnailLQ"
                :prefer-high-res="true"
                :alt="primaryName"
                class="size-full"
              />
              <span
                class="absolute bottom-1.5 right-1.5 p-1 bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ZoomIn class="size-3.5" />
              </span>
            </button>

            <PackageThumbnail
              v-else
              :thumbnail="pkg.Thumbnail"
              :thumbnail-lq="pkg.ThumbnailLQ"
              :alt="primaryName"
              class="w-[160px] h-[100px] sm:w-[192px] sm:h-[120px] shrink-0"
            />

            <div class="min-w-0 space-y-2">
              <div class="space-y-0.5">
                <div class="flex flex-wrap items-center gap-2">
                  <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-foreground break-words">
                    {{ primaryName }}
                  </h1>
                  <span
                    v-if="pkg.NeedValidation && !pkg.Validated"
                    class="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25"
                  >
                    <Clock class="size-3" />
                    <span>{{ t('common.validationPending') }}</span>
                  </span>
                </div>

                <p v-if="secondaryName" class="text-sm text-muted-foreground break-words">
                  {{ secondaryName }}
                </p>
              </div>

              <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-muted-foreground tabular-nums">
                <PlatformBadge :platforms="pkg.Platforms" variant="label" />
                <span aria-hidden="true">·</span>
                <template v-if="isRepost && authorDisplayName">
                  <span>{{ authorDisplayName }}</span>
                  <span aria-hidden="true">·</span>
                </template>
                <template v-else-if="pkg.Uploader">
                  <router-link
                    :to="`/uploaders/${pkg.Uploader.ID}`"
                    class="text-foreground/85 hover:text-primary hover:underline underline-offset-4"
                  >
                    {{ uploaderDisplayName || `#${pkg.Uploader.ID}` }}
                  </router-link>
                  <span aria-hidden="true">·</span>
                </template>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <time :datetime="pkg.UpdatedAt">{{ formatDateShort(pkg.UpdatedAt) }}</time>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {{ formatLocalTimestamp(pkg.UpdatedAt) }}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>

          <!-- 右侧主行动区 -->
          <div class="flex flex-wrap items-center gap-2.5 shrink-0">
            <HomepageCtaButton
              v-if="pkg.Homepage"
              :href="pkg.Homepage"
              :label="t('detail.visitHomepageTitle')"
            />

            <Button
              :disabled="filesCount === 0"
              class="rounded-none cursor-pointer"
              :class="pkg.Homepage ? 'h-11 px-4' : ''"
              @click="jumpToDownloads"
            >
              <Download class="size-4" />
              <span>
                {{
                  filesCount > 0
                    ? t('detail.downloadCount', { count: filesCount })
                    : t('detail.noFilesShort')
                }}
              </span>
            </Button>
          </div>
        </div>
      </section>

      <!-- 下部双栏内容区 -->
      <div ref="tabsAnchorRef" class="max-w-7xl mx-auto px-4 sm:px-6 py-6 scroll-mt-14">
        <SidebarLayout side="right">
          <!-- 左主栏：Tab 切换 -->
          <div>
            <Tabs :model-value="activeTab" @update:model-value="setActiveTab">
              <TabsList class="w-full justify-start h-auto bg-transparent p-0 rounded-none border-b border-border gap-5">
                <TabsTrigger
                  value="description"
                  class="flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 py-2.5 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-foreground hover:text-foreground cursor-pointer"
                >
                  {{ t('detail.tabs.description') }}
                </TabsTrigger>
                <TabsTrigger
                  value="downloads"
                  class="flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 py-2.5 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-foreground hover:text-foreground cursor-pointer tabular-nums"
                >
                  <span>{{ t('detail.tabs.downloads') }}</span>
                  <span class="ml-1 text-xs text-muted-foreground">({{ filesCount }})</span>
                </TabsTrigger>
                <TabsTrigger
                  value="comments"
                  class="flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 py-2.5 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-primary data-[state=active]:text-foreground hover:text-foreground cursor-pointer"
                >
                  {{ t('detail.tabs.comments') }}
                </TabsTrigger>
              </TabsList>

              <!-- Tab 1: 描述 -->
              <TabsContent value="description" class="pt-5 mt-0">
                <div
                  v-if="sanitizedDescription"
                  class="prose prose-sm sm:prose-base max-w-none package-prose"
                  @click="handleProseClick"
                  v-html="sanitizedDescription"
                />
                <div
                  v-else
                  class="border border-dashed border-border py-12 px-6 text-center"
                >
                  <p class="text-sm text-muted-foreground">
                    {{ t('detail.descriptionEmpty') }}
                  </p>
                </div>
              </TabsContent>

              <!-- Tab 2: 下载（统一版本表格） -->
              <TabsContent value="downloads" class="pt-5 mt-0">
                <PackageVersionList
                  :package-id="pkg.ID"
                  :files="visibleFiles"
                />
              </TabsContent>

              <!-- Tab 3: 评论占位 -->
              <TabsContent value="comments" class="pt-5 mt-0">
                <div class="border border-dashed border-border py-12 px-6 text-center space-y-2">
                  <MessageSquare class="size-5 mx-auto text-muted-foreground/70" />
                  <p class="text-sm font-medium text-foreground">
                    {{ t('detail.commentsPlaceholderTitle') }}
                  </p>
                  <p class="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                    {{ t('detail.commentsPlaceholderDesc') }}
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <!-- 右侧元数据侧栏 -->
          <template #sidebar>
            <div class="flex flex-col gap-5">
              <!-- 编辑按钮 -->
              <section v-if="authStore.canEditPackage(pkg)" class="space-y-3">
                <Button
                  as-child
                  size="sm"
                  variant="ghost"
                  class="rounded-none"
                >
                  <router-link :to="`/packages/${pkg.ID}/edit/info`">
                    <Pencil class="size-4" />
                    <span>{{ t('detail.editButton') }}</span>
                  </router-link>
                </Button>
                <Separator />
              </section>

              <!-- 创作者与上传者 -->
              <section class="space-y-3">
                <h2 class="text-sm font-semibold uppercase trackingdisabled-wider text-muted-foreground">
                  {{ t('detail.meta.peopleHeading') }}
                </h2>

                <!-- 转载场景：先展示原作者，再展示上传者 -->
                <div v-if="isRepost && pkg.Author" class="flex flex-col gap-3">
                  <div class="space-y-1">
                    <div class="text-sm text-muted-foreground">
                      {{ t('detail.meta.originalAuthor') }}
                    </div>
                    <div class="text-sm font-medium text-foreground break-words">
                      {{ authorDisplayName || '—' }}
                    </div>
                    <div class="flex flex-wrap items-center gap-3 pt-0.5 text-sm">
                      <a
                        v-if="pkg.Author.Email"
                        :href="`mailto:${pkg.Author.Email}`"
                        class="inline-flex items-center gap-1 text-primary hover:underline underline-offset-4"
                      >
                        <Mail class="size-3" />
                        <span>{{ t('detail.meta.email') }}</span>
                      </a>
                      <a
                        v-if="pkg.Author.Homepage"
                        :href="pkg.Author.Homepage"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="inline-flex items-center gap-1 text-primary hover:underline underline-offset-4"
                      >
                        <ExternalLink class="size-3" />
                        <span>{{ t('detail.meta.homepage') }}</span>
                      </a>
                    </div>
                  </div>

                  <template v-if="pkg.Uploader">
                    <Separator />
                    <div class="space-y-1">
                      <div class="text-sm text-muted-foreground">
                        {{ t('detail.meta.uploader') }}
                      </div>
                      <router-link
                        :to="`/uploaders/${pkg.Uploader.ID}`"
                        class="text-sm font-medium text-foreground hover:text-primary hover:underline underline-offset-4 break-words inline-block"
                      >
                        {{ uploaderDisplayName || `#${pkg.Uploader.ID}` }}
                      </router-link>
                      <div v-if="pkg.Uploader.Email" class="flex flex-wrap items-center gap-3 pt-0.5 text-sm">
                        <a
                          :href="`mailto:${pkg.Uploader.Email}`"
                          class="inline-flex items-center gap-1 text-primary hover:underline underline-offset-4"
                        >
                          <Mail class="size-3" />
                          <span>{{ t('detail.meta.email') }}</span>
                        </a>
                      </div>
                    </div>
                  </template>
                </div>

                <!-- 原创场景：只展示上传者并标记为作者 -->
                <div v-else-if="pkg.Uploader" class="space-y-1">
                  <div class="text-sm text-muted-foreground">
                    {{ t('detail.meta.author') }}
                  </div>
                  <router-link
                    :to="`/uploaders/${pkg.Uploader.ID}`"
                    class="text-sm font-medium text-foreground hover:text-primary hover:underline underline-offset-4 break-words inline-block"
                  >
                    {{ uploaderDisplayName || `#${pkg.Uploader.ID}` }}
                  </router-link>
                  <div class="flex flex-wrap items-center gap-3 pt-0.5 text-sm">
                    <a
                      v-if="pkg.Uploader.Email"
                      :href="`mailto:${pkg.Uploader.Email}`"
                      class="inline-flex items-center gap-1 text-primary hover:underline underline-offset-4"
                    >
                      <Mail class="size-3" />
                      <span>{{ t('detail.meta.email') }}</span>
                    </a>
                    <a
                      v-if="pkg.Uploader.Homepage"
                      :href="pkg.Uploader.Homepage"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex items-center gap-1 text-primary hover:underline underline-offset-4"
                    >
                      <ExternalLink class="size-3" />
                      <span>{{ t('detail.meta.homepage') }}</span>
                    </a>
                  </div>
                </div>
              </section>

              <Separator />

              <!-- 技术元数据 -->
              <section class="space-y-3">
                <h2 class="text-sm font-semibold uppercase trackingdisabled-wider text-muted-foreground">
                  {{ t('detail.meta.specsHeading') }}
                </h2>

                <dl class="space-y-3 text-sm">
                  <div class="space-y-0.5">
                    <dt class="text-muted-foreground">{{ t('detail.meta.packageId') }}</dt>
                    <dd class="font-mono text-foreground tabular-nums">#{{ pkg.ID }}</dd>
                  </div>

                  <div class="space-y-0.5">
                    <dt class="text-muted-foreground">{{ t('detail.meta.identifier') }}</dt>
                    <dd class="flex items-start justify-between gap-1.5">
                      <span class="font-mono text-foreground break-all select-all">
                        {{ pkg.Identifier }}
                      </span>
                      <button
                        type="button"
                        class="p-1 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                        :title="t('common.copy')"
                        @click="copyText('identifier', pkg.Identifier)"
                      >
                        <Check v-if="copied && copiedField === 'identifier'" class="size-3.5 text-primary" />
                        <Copy v-else class="size-3.5" />
                      </button>
                    </dd>
                  </div>

                  <div v-if="pkg.GUID" class="space-y-0.5">
                    <dt class="text-muted-foreground">{{ t('detail.meta.guid') }}</dt>
                    <dd class="flex items-start justify-between gap-1.5">
                      <span class="font-mono text-foreground break-all select-all">
                        {{ pkg.GUID }}
                      </span>
                      <button
                        type="button"
                        class="p-1 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                        :title="t('common.copy')"
                        @click="copyText('guid', pkg.GUID)"
                      >
                        <Check v-if="copied && copiedField === 'guid'" class="size-3.5 text-primary" />
                        <Copy v-else class="size-3.5" />
                      </button>
                    </dd>
                  </div>

                  <div v-if="pkg.Homepage" class="space-y-0.5">
                    <dt class="text-muted-foreground">{{ t('detail.meta.homepageUrl') }}</dt>
                    <dd class="space-y-1">
                      <a
                        :href="pkg.Homepage"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-primary hover:underline underline-offset-4 break-all inline-flex items-center gap-1"
                      >
                        <span>{{ pkg.Homepage }}</span>
                        <ExternalLink class="size-3 shrink-0" />
                      </a>
                    </dd>
                  </div>

                  <div class="space-y-0.5">
                    <dt class="text-muted-foreground">{{ t('detail.meta.updatedAt') }}</dt>
                    <dd class="text-foreground tabular-nums">
                      {{ formatLocalTimestamp(pkg.UpdatedAt) }}
                    </dd>
                  </div>

                  <div v-if="pkg.CreatedAt" class="space-y-0.5">
                    <dt class="text-muted-foreground">{{ t('detail.meta.createdAt') }}</dt>
                    <dd class="text-foreground tabular-nums">
                      {{ formatLocalTimestamp(pkg.CreatedAt) }}
                    </dd>
                  </div>

                  <div v-if="pkg.NeedValidation" class="space-y-0.5">
                    <dt class="text-muted-foreground">{{ t('detail.meta.validationStatus') }}</dt>
                    <dd
                      class="font-medium"
                      :class="
                        pkg.Validated
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-amber-700 dark:text-amber-400'
                      "
                    >
                      {{
                        pkg.Validated
                          ? t('detail.meta.validated')
                          : t('detail.meta.pendingValidation')
                      }}
                    </dd>
                  </div>
                </dl>
              </section>
            </div>
          </template>
        </SidebarLayout>
      </div>
    </template>

    <!-- 全屏可缩放拖动灯箱 -->
    <ImageLightbox
      v-model:open="lightboxOpen"
      :images="lightboxImages"
      :initial-index="lightboxIndex"
      :alt="primaryName"
    />
  </div>
</template>
