<script setup lang="ts">
import { computed, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
  CornerDownRight,
  FileText,
  Image as ImageIcon,
  Info,
  Layers,
  Lock,
  RefreshCw,
} from '@lucide/vue'
import SidebarLayout from '@/layouts/SidebarLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { usePreferencesStore } from '@/stores/preferences'
import { usePackageDetailQuery } from '@/queries/packages'
import { hasSubstantialHtmlContent } from '@/utils/format'
import { useBreadcrumbState, usePageBreadcrumbCleanup } from '@/composables/useBreadcrumb'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const authStore = useAuthStore()
const preferences = usePreferencesStore()
const { setBreadcrumb } = useBreadcrumbState()
usePageBreadcrumbCleanup()

const isCreateMode = computed(() => route.name === 'package-new')

const packageId = computed<number | null>(() => {
  if (isCreateMode.value) return null
  const raw = String(route.params.id ?? '')
  if (!/^\d+$/.test(raw)) return null
  const num = Number.parseInt(raw, 10)
  return num > 0 ? num : null
})

const packageQuery = usePackageDetailQuery(packageId)
const pkg = computed(() => (isCreateMode.value ? null : packageQuery.data.value ?? null))

// 无编辑权限时跳回作品详情页
watch(
  [pkg, () => authStore.isLoggedIn, () => authStore.privilege, () => authStore.currentUserId],
  ([data]) => {
    if (!isCreateMode.value && data && !authStore.canEditPackage(data)) {
      void router.replace(`/packages/${data.ID}`)
    }
  },
  { immediate: true },
)

const displayTitle = computed(() => {
  if (isCreateMode.value) return t('packageEdit.newTitle')
  if (!pkg.value) return packageId.value ? `#${packageId.value}` : ''
  return preferences.formatS3(pkg.value.Name) || pkg.value.Identifier
})

const filesCount = computed(() => pkg.value?.Files?.length ?? 0)

const isVersionSubRoute = computed(
  () =>
    route.name === 'package-edit-version-new' ||
    route.name === 'package-edit-version-edit',
)

const activeFileLabel = computed(() => {
  if (route.name === 'package-edit-version-new') {
    return t('packageEdit.nav.createVersion')
  }
  const rawFileId = Number.parseInt(String(route.params.fileId ?? ''), 10)
  const found = pkg.value?.Files?.find((f) => f.ID === rawFileId)
  if (found) {
    return t('packageEdit.nav.editVersionWithNum', { version: found.Version })
  }
  return t('packageEdit.nav.editVersion')
})

const isVersionActive = computed(
  () => route.name === 'package-edit-versions' || isVersionSubRoute.value,
)

// Publishing Checklist 状态推演
const checklistItems = computed(() => {
  const data = pkg.value
  if (!data) return []

  const hasCover = Boolean(data.Thumbnail?.trim())
  const hasDescription = hasSubstantialHtmlContent(data.Description)
  const files = data.Files ?? []
  const hasRejected = files.some((f) => f.NeedValidation && !f.Validated && Boolean(f.RejectReason))
  const hasValidated = files.some((f) => !f.NeedValidation || f.Validated)

  let versionStatus: 'ok' | 'warn' | 'error' | 'empty' = 'empty'
  let versionDetail = t('packageEdit.checklist.versionEmpty')
  if (files.length > 0) {
    if (hasRejected) {
      versionStatus = 'error'
      versionDetail = t('packageEdit.checklist.versionRejected')
    } else if (hasValidated) {
      versionStatus = 'ok'
      versionDetail = t('packageEdit.checklist.versionPublished')
    } else {
      versionStatus = 'warn'
      versionDetail = t('packageEdit.checklist.versionPending')
    }
  }

  return [
    {
      key: 'info',
      label: t('packageEdit.checklist.info'),
      detail: t('packageEdit.checklist.ready'),
      status: 'ok' as const,
    },
    {
      key: 'gallery',
      label: t('packageEdit.checklist.gallery'),
      detail: hasCover
        ? t('packageEdit.checklist.ready')
        : t('packageEdit.checklist.optionalUnset'),
      status: hasCover ? ('ok' as const) : ('empty' as const),
    },
    {
      key: 'description',
      label: t('packageEdit.checklist.description'),
      detail: hasDescription
        ? t('packageEdit.checklist.ready')
        : t('packageEdit.checklist.optionalUnset'),
      status: hasDescription ? ('ok' as const) : ('empty' as const),
    },
    {
      key: 'versions',
      label: t('packageEdit.checklist.versions'),
      detail: versionDetail,
      status: versionStatus,
    },
  ]
})

watchEffect(() => {
  if (isCreateMode.value) {
    setBreadcrumb(
      [
        { label: t('nav.home'), to: '/' },
        { label: t('packages.breadcrumb'), to: '/packages' },
        { label: t('packageEdit.newTitle') },
      ],
      '',
    )
    return
  }

  const label = displayTitle.value || `#${packageId.value ?? ''}`
  setBreadcrumb(
    [
      { label: t('nav.home'), to: '/' },
      { label: t('packages.breadcrumb'), to: '/packages' },
      { label, to: packageId.value ? `/packages/${packageId.value}` : undefined },
      { label: t('packageEdit.editBreadcrumb') },
    ],
    packageId.value ? `#${packageId.value}` : '',
  )
})
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 py-6">
    <!-- 编辑模式无效 ID 或加载失败 -->
    <div
      v-if="!isCreateMode && (packageId === null || packageQuery.isError.value)"
      class="border border-border bg-muted/30 p-6 max-w-xl space-y-3"
    >
      <h1 class="text-base font-semibold text-foreground">
        {{ packageId === null ? t('detail.invalidIdTitle') : t('detail.notFoundTitle') }}
      </h1>
      <p class="text-sm text-muted-foreground">
        {{ packageQuery.error.value?.message || t('errors.notFound') }}
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
          @click="() => packageQuery.refetch()"
        >
          <RefreshCw class="size-3.5" />
          <span>{{ t('common.retry') }}</span>
        </Button>
      </div>
    </div>

    <SidebarLayout v-else side="left">
      <template #sidebar>
        <div class="flex flex-col gap-4">
          <!-- 顶部摘要 -->
          <div class="space-y-1">
            <div class="text-sm font-semibold text-foreground truncate">
              {{ displayTitle }}
            </div>
            <div
              v-if="pkg"
              class="text-xs font-mono text-muted-foreground truncate tabular-nums"
            >
              {{ pkg.Identifier }}
            </div>
          </div>

          <Separator />

          <!-- 主编辑导航 -->
          <nav :aria-label="t('packageEdit.editBreadcrumb')" class="space-y-0.5">
            <!-- 基本信息 -->
            <router-link
              :to="isCreateMode ? '/packages/new' : `/packages/${packageId}/edit/info`"
              class="w-full px-2.5 py-2 flex items-center gap-2 text-sm transition-colors"
              :class="
                route.name === 'package-new' || route.name === 'package-edit-info'
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-foreground/85 hover:bg-muted/80 hover:text-foreground'
              "
            >
              <Info class="size-4 shrink-0" />
              <span>{{ t('packageEdit.nav.info') }}</span>
            </router-link>

            <!-- 图库 -->
            <span
              v-if="isCreateMode"
              class="w-full px-2.5 py-2 flex items-center justify-between gap-2 text-sm text-muted-foreground/55 cursor-not-allowed select-none"
            >
              <span class="flex items-center gap-2">
                <ImageIcon class="size-4 shrink-0" />
                <span>{{ t('packageEdit.nav.gallery') }}</span>
              </span>
              <Lock class="size-3 shrink-0" />
            </span>
            <router-link
              v-else
              :to="`/packages/${packageId}/edit/gallery`"
              class="w-full px-2.5 py-2 flex items-center gap-2 text-sm transition-colors"
              :class="
                route.name === 'package-edit-gallery'
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-foreground/85 hover:bg-muted/80 hover:text-foreground'
              "
            >
              <ImageIcon class="size-4 shrink-0" />
              <span>{{ t('packageEdit.nav.gallery') }}</span>
            </router-link>

            <!-- 文字介绍 -->
            <span
              v-if="isCreateMode"
              class="w-full px-2.5 py-2 flex items-center justify-between gap-2 text-sm text-muted-foreground/55 cursor-not-allowed select-none"
            >
              <span class="flex items-center gap-2">
                <FileText class="size-4 shrink-0" />
                <span>{{ t('packageEdit.nav.description') }}</span>
              </span>
              <Lock class="size-3 shrink-0" />
            </span>
            <router-link
              v-else
              :to="`/packages/${packageId}/edit/description`"
              class="w-full px-2.5 py-2 flex items-center gap-2 text-sm transition-colors"
              :class="
                route.name === 'package-edit-description'
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-foreground/85 hover:bg-muted/80 hover:text-foreground'
              "
            >
              <FileText class="size-4 shrink-0" />
              <span>{{ t('packageEdit.nav.description') }}</span>
            </router-link>

            <div class="py-1.5">
              <Separator />
            </div>

            <!-- 版本 -->
            <span
              v-if="isCreateMode"
              class="w-full px-2.5 py-2 flex items-center justify-between gap-2 text-sm text-muted-foreground/55 cursor-not-allowed select-none"
            >
              <span class="flex items-center gap-2">
                <Layers class="size-4 shrink-0" />
                <span>{{ t('packageEdit.nav.versions') }}</span>
              </span>
              <Lock class="size-3 shrink-0" />
            </span>
            <template v-else>
              <router-link
                :to="`/packages/${packageId}/edit/versions`"
                class="w-full px-2.5 py-2 flex items-center justify-between gap-2 text-sm transition-colors"
                :class="
                  route.name === 'package-edit-versions'
                    ? 'bg-primary/10 text-primary font-medium'
                    : isVersionActive
                      ? 'text-foreground font-medium hover:bg-muted/80'
                      : 'text-foreground/85 hover:bg-muted/80 hover:text-foreground'
                "
              >
                <span class="flex items-center gap-2">
                  <Layers class="size-4 shrink-0" />
                  <span>{{ t('packageEdit.nav.versions') }}</span>
                </span>
                <span class="text-xs text-muted-foreground tabular-nums">
                  {{ filesCount }}
                </span>
              </router-link>

              <!-- 动态子项：创建/编辑版本 -->
              <div
                v-if="isVersionSubRoute"
                class="pl-5 pr-2.5 py-1.5 flex items-center gap-1.5 text-xs bg-primary/10 text-primary font-medium border-l-2 border-primary ml-2.5"
              >
                <CornerDownRight class="size-3.5 shrink-0" />
                <span class="truncate">{{ activeFileLabel }}</span>
              </div>
            </template>
          </nav>

          <!-- Publishing Checklist -->
          <template v-if="!isCreateMode && pkg">
            <Separator />

            <section class="space-y-2.5 px-1">
              <h2 class="text-[11px] font-semibold uppercase trackingdisabled-wider text-muted-foreground">
                {{ t('packageEdit.checklist.title') }}
              </h2>
              <ul class="space-y-2 text-xs">
                <li
                  v-for="item in checklistItems"
                  :key="item.key"
                  class="flex items-start gap-2"
                >
                  <CheckCircle2
                    v-if="item.status === 'ok'"
                    class="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
                  />
                  <Clock
                    v-else-if="item.status === 'warn'"
                    class="size-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
                  />
                  <AlertCircle
                    v-else-if="item.status === 'error'"
                    class="size-3.5 text-destructive shrink-0 mt-0.5"
                  />
                  <Circle
                    v-else
                    class="size-3.5 text-muted-foreground/50 shrink-0 mt-0.5"
                  />
                  <div class="min-w-0 leading-snug">
                    <div class="font-medium text-foreground">{{ item.label }}</div>
                    <div
                      class="text-[11px]"
                      :class="
                        item.status === 'error'
                          ? 'text-destructive'
                          : item.status === 'warn'
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-muted-foreground'
                      "
                    >
                      {{ item.detail }}
                    </div>
                  </div>
                </li>
              </ul>
            </section>

            <Separator />

            <router-link
              :to="`/packages/${packageId}`"
              class="px-2.5 py-1.5 inline-flex items-center justify-between gap-2 text-xs font-medium text-primary hover:bg-muted/60 transition-colors"
            >
              <span>{{ t('packageEdit.viewPublicPackage') }}</span>
              <ArrowRight class="size-3.5 shrink-0" />
            </router-link>
          </template>
        </div>
      </template>

      <!-- 右侧内容区 -->
      <div class="max-w-3xl">
        <div v-if="!isCreateMode && packageQuery.isPending.value" class="space-y-4">
          <Skeleton class="h-10 w-full rounded-none" />
          <Skeleton class="h-44 w-full rounded-none" />
        </div>
        <router-view v-else />
      </div>
    </SidebarLayout>
  </div>
</template>
