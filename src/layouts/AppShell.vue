<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  AlertCircle,
  ChevronDown,
  FileCheck2,
  Globe,
  Home,
  Info,
  LogIn,
  LogOut,
  Menu,
  Package,
  Plus,
  Settings,
  User,
  X,
} from '@lucide/vue'
import { SUPPORTED_LOCALES } from '@/i18n'
import { usePreferencesStore } from '@/stores/preferences'
import { useAuthStore } from '@/stores/auth'
import { usePendingFilesCountQuery } from '@/queries/files'
import { useBreadcrumb } from '@/composables/useBreadcrumb'
import type { SupportedLocale } from '@/api/portal'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { TooltipProvider } from '@/components/ui/tooltip'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const preferences = usePreferencesStore()
const authStore = useAuthStore()
const { items: breadcrumbItems } = useBreadcrumb()
const mobileMenuOpen = ref(false)

const isModerator = computed(() => authStore.isLoggedIn && authStore.privilege >= 10)
const pendingFilesQuery = usePendingFilesCountQuery(isModerator)
const pendingFilesCount = computed(() => pendingFilesQuery.data.value ?? 0)

const displayUsername = computed(() => {
  if (!authStore.profile) return ''
  return preferences.formatS3(authStore.profile.Name) || `#${authStore.profile.ID}`
})

const loginLocation = computed(() => {
  if (route.path.startsWith('/auth/')) {
    return { name: 'login' as const, query: route.query }
  }
  return {
    name: 'login' as const,
    query: route.fullPath && route.fullPath !== '/' ? { redirect: route.fullPath } : undefined,
  }
})

function isNavActive(target: 'home' | 'packages' | 'about'): boolean {
  if (target === 'home') return route.name === 'home'
  if (target === 'about') return route.name === 'about'
  return (
    route.name === 'packages' ||
    route.name === 'package-detail' ||
    route.name === 'package-new' ||
    String(route.name ?? '').startsWith('package-edit-')
  )
}

function handleLocaleChange(value: unknown) {
  if (value === 'zh-CN' || value === 'zh-TW' || value === 'en' || value === 'ja' || value === 'ko') {
    preferences.setLocale(value as SupportedLocale)
  }
}

function handleLogout() {
  authStore.logout()
  if (route.meta.requiresAuth) {
    void router.push({ name: 'home' })
  }
}
</script>

<template>
  <TooltipProvider :delay-duration="250">
    <div class="min-h-svh flex flex-col bg-background text-foreground overflow-x-clip">
      <!-- Solid 顶部工具条 (Sticky) -->
      <header class="sticky top-0 z-40 h-12 bg-toolbar-bg text-white shrink-0 border-b border-black/10">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-4">
          <div class="flex items-center gap-2.5 sm:gap-5 min-w-0">
            <router-link
              to="/"
              class="flex items-baseline gap-2 shrink-0 hover:opacity-90 transition-opacity"
            >
              <span class="text-sm sm:text-[15px] font-bold tracking-tight">{{ t('brand.title') }}</span>
              <span class="hidden sm:inline text-xs text-white/75 font-normal">
                {{ t('brand.subtitle') }}
              </span>
            </router-link>

            <!-- 汉堡菜单按钮（仅 < sm 显示） -->
            <button
              type="button"
              class="sm:hidden h-8 px-2 flex items-center justify-center text-white/90 hover:text-white hover:bg-black/10 transition-colors cursor-pointer"
              :aria-label="t('nav.menu')"
              @click="mobileMenuOpen = true"
            >
              <Menu class="size-4" />
            </button>

            <nav class="hidden sm:flex items-center h-12" aria-label="Main navigation">
              <router-link
                to="/"
                class="relative h-full px-2 sm:px-3 flex items-center gap-1.5 text-[13px] font-medium transition-colors"
                :class="
                  isNavActive('home')
                    ? 'bg-black/15 text-white'
                    : 'text-white/80 hover:text-white hover:bg-black/10'
                "
              >
                <Home class="size-3.5 shrink-0" />
                <span>{{ t('nav.home') }}</span>
                <span
                  v-if="isNavActive('home')"
                  class="absolute inset-x-0 bottom-0 h-0.5 bg-white"
                />
              </router-link>

              <router-link
                to="/packages"
                class="relative h-full px-2 sm:px-3 flex items-center gap-1.5 text-[13px] font-medium transition-colors"
                :class="
                  isNavActive('packages')
                    ? 'bg-black/15 text-white'
                    : 'text-white/80 hover:text-white hover:bg-black/10'
                "
              >
                <Package class="size-3.5 shrink-0" />
                <span>{{ t('nav.packages') }}</span>
                <span
                  v-if="isNavActive('packages')"
                  class="absolute inset-x-0 bottom-0 h-0.5 bg-white"
                />
              </router-link>

              <router-link
                to="/about"
                class="relative h-full px-2 sm:px-3 flex items-center gap-1.5 text-[13px] font-medium transition-colors"
                :class="
                  isNavActive('about')
                    ? 'bg-black/15 text-white'
                    : 'text-white/80 hover:text-white hover:bg-black/10'
                "
              >
                <Info class="size-3.5 shrink-0" />
                <span>{{ t('nav.about') }}</span>
                <span
                  v-if="isNavActive('about')"
                  class="absolute inset-x-0 bottom-0 h-0.5 bg-white"
                />
              </router-link>
            </nav>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <!-- 界面语言切换 -->
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <button
                  type="button"
                  class="h-8 px-2.5 flex items-center gap-1.5 text-sm font-medium bg-black/10 text-white/90 hover:bg-black/20 hover:text-white border border-white/20 transition-colors cursor-pointer"
                  :aria-label="t('nav.language')"
                >
                  <Globe class="size-3.5 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" class="w-40 rounded-none">
                <DropdownMenuRadioGroup
                  :model-value="preferences.locale"
                  @update:model-value="handleLocaleChange"
                >
                  <DropdownMenuRadioItem
                    v-for="loc in SUPPORTED_LOCALES"
                    :key="loc.code"
                    :value="loc.code"
                    class="rounded-none cursor-pointer"
                  >
                    {{ loc.label }}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <!-- 已登录用户菜单 -->
            <DropdownMenu v-if="authStore.isLoggedIn && authStore.profile">
              <DropdownMenuTrigger as-child>
                <button
                  type="button"
                  class="h-8 px-2.5 flex items-center gap-1.5 text-sm font-medium bg-black/15 text-white hover:bg-black/25 border border-white/25 transition-colors cursor-pointer max-w-[120px] sm:max-w-[170px]"
                >
                  <User class="size-3.5 shrink-0" />
                  <span class="truncate">{{ displayUsername }}</span>
                  <ChevronDown class="size-3 opacity-80 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" class="w-56 rounded-none">
                <DropdownMenuLabel class="font-normal py-2">
                  <div class="text-sm font-semibold text-foreground truncate">
                    {{ displayUsername }}
                  </div>
                  <div class="text-[11px] text-muted-foreground truncate mt-0.5">
                    {{ authStore.profile.Email }}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem as-child class="rounded-none cursor-pointer">
                  <router-link :to="`/uploaders/${authStore.profile.ID}`">
                    <User class="size-3.5" />
                    <span>{{ t('nav.myUploaderPage') }}</span>
                  </router-link>
                </DropdownMenuItem>
                <DropdownMenuItem as-child class="rounded-none cursor-pointer">
                  <router-link to="/packages/new">
                    <Plus class="size-3.5" />
                    <span>{{ t('nav.newPackage') }}</span>
                  </router-link>
                </DropdownMenuItem>
                <DropdownMenuItem as-child class="rounded-none cursor-pointer">
                  <router-link to="/settings/profile">
                    <Settings class="size-3.5" />
                    <span>{{ t('nav.settings') }}</span>
                  </router-link>
                </DropdownMenuItem>
                <template v-if="isModerator">
                  <DropdownMenuSeparator />
                  <DropdownMenuItem as-child class="rounded-none cursor-pointer">
                    <router-link to="/admin/files" class="flex items-center justify-between gap-2">
                      <span class="inline-flex items-center gap-2">
                        <FileCheck2 class="size-3.5" />
                        <span>{{ t('nav.adminFiles') }}</span>
                      </span>
                      <span
                        v-if="pendingFilesCount > 0"
                        class="px-1.5 py-0.5 text-[10px] font-semibold tabular-nums bg-primary text-primary-foreground leading-none"
                      >
                        {{ pendingFilesCount }}
                      </span>
                    </router-link>
                  </DropdownMenuItem>
                </template>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  class="rounded-none text-destructive focus:text-destructive cursor-pointer"
                  @click="handleLogout"
                >
                  <LogOut class="size-3.5" />
                  <span>{{ t('nav.logout') }}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <!-- 未登录：登录与注册入口 -->
            <template v-else>
              <router-link
                :to="loginLocation"
                class="h-8 px-2.5 flex items-center gap-1.5 text-sm font-medium bg-black/15 text-white hover:bg-black/25 border border-white/25 transition-colors"
              >
                <LogIn class="size-3.5 shrink-0" />
                <span>{{ t('nav.login') }}</span>
              </router-link>
            </template>
          </div>
        </div>
      </header>

      <!-- 移动端导航抽屉 -->
      <Sheet v-model:open="mobileMenuOpen">
        <SheetContent side="left" class="w-64 p-0">
          <SheetHeader class="px-5 pt-5 pb-3">
            <SheetTitle class="text-sm font-bold tracking-tight">
              {{ t('brand.title') }}
            </SheetTitle>
          </SheetHeader>
          <Separator />
          <nav class="flex flex-col py-2" aria-label="Mobile navigation">
            <router-link
              to="/"
              class="px-5 py-2.5 flex items-center gap-3 text-sm font-medium transition-colors"
              :class="
                isNavActive('home')
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground/85 hover:bg-muted/80 hover:text-foreground'
              "
              @click="mobileMenuOpen = false"
            >
              <Home class="size-4 shrink-0" />
              <span>{{ t('nav.home') }}</span>
            </router-link>
            <router-link
              to="/packages"
              class="px-5 py-2.5 flex items-center gap-3 text-sm font-medium transition-colors"
              :class="
                isNavActive('packages')
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground/85 hover:bg-muted/80 hover:text-foreground'
              "
              @click="mobileMenuOpen = false"
            >
              <Package class="size-4 shrink-0" />
              <span>{{ t('nav.packages') }}</span>
            </router-link>
            <router-link
              to="/about"
              class="px-5 py-2.5 flex items-center gap-3 text-sm font-medium transition-colors"
              :class="
                isNavActive('about')
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground/85 hover:bg-muted/80 hover:text-foreground'
              "
              @click="mobileMenuOpen = false"
            >
              <Info class="size-4 shrink-0" />
              <span>{{ t('nav.about') }}</span>
            </router-link>
          </nav>
        </SheetContent>
      </Sheet>

      <!-- Breadcrumb 导航栏 -->
      <div class="h-9 bg-muted/35 border-b border-border shrink-0">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-4">
          <Breadcrumb class="min-w-0">
            <BreadcrumbList class="flex-nowrap text-sm">
              <template v-for="(item, idx) in breadcrumbItems" :key="`${idx}-${item.label}`">
                <BreadcrumbSeparator v-if="idx > 0" />
                <BreadcrumbItem class="min-w-0">
                  <BreadcrumbLink v-if="item.to && idx < breadcrumbItems.length - 1" as-child>
                    <router-link :to="item.to" class="truncate hover:text-foreground">
                      {{ item.label }}
                    </router-link>
                  </BreadcrumbLink>
                  <BreadcrumbPage v-else class="truncate font-medium">
                    {{ item.label }}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </template>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>

      <!-- 会话过期非模态提示条 -->
      <div
        v-if="authStore.sessionExpiredNotice"
        role="status"
        class="bg-amber-500/10 border-b border-amber-500/30 text-amber-950 dark:text-amber-200"
      >
        <div class="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between gap-3 text-sm">
          <div class="flex items-center gap-2 min-w-0">
            <AlertCircle class="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span class="leading-snug">{{ t('nav.sessionExpiredBanner') }}</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <router-link
              :to="loginLocation"
              class="font-semibold text-primary hover:underline underline-offset-4 whitespace-nowrap"
              @click="authStore.dismissExpiredNotice"
            >
              {{ t('nav.reloginNow') }}
            </router-link>
            <button
              type="button"
              class="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
              :aria-label="t('common.close')"
              @click="authStore.dismissExpiredNotice"
            >
              <X class="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      <!-- 主内容区 -->
      <main class="flex-1">
        <slot />
      </main>
    </div>
  </TooltipProvider>
</template>
