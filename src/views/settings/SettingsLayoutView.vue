<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowRight, FileText, Shield, User, UserCog } from '@lucide/vue'
import SidebarLayout from '@/layouts/SidebarLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { usePreferencesStore } from '@/stores/preferences'
import { useUploaderDetailQuery } from '@/queries/uploaders'
import { useBreadcrumbState, usePageBreadcrumbCleanup } from '@/composables/useBreadcrumb'
import { Separator } from '@/components/ui/separator'

const route = useRoute()
const { t } = useI18n()
const authStore = useAuthStore()
const preferences = usePreferencesStore()
const { setBreadcrumb } = useBreadcrumbState()
usePageBreadcrumbCleanup()

const targetUserId = computed<number | null>(() => {
  const rawUid = route.query.uid
  if (rawUid && authStore.privilege >= 50) {
    const parsed = Number.parseInt(String(rawUid), 10)
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed
    }
  }
  return authStore.currentUserId
})

const isEditingOther = computed(
  () =>
    targetUserId.value !== null &&
    authStore.currentUserId !== null &&
    targetUserId.value !== authStore.currentUserId,
)

const targetQuery = computed(() =>
  isEditingOther.value && targetUserId.value
    ? { uid: String(targetUserId.value) }
    : undefined,
)

const uploaderQuery = useUploaderDetailQuery(targetUserId)

const accountDisplayName = computed(() => {
  const target = uploaderQuery.data.value
  if (target) {
    return preferences.formatS3(target.Name) || `#${target.ID}`
  }
  if (!isEditingOther.value && authStore.profile) {
    return preferences.formatS3(authStore.profile.Name) || `#${authStore.profile.ID}`
  }
  return targetUserId.value ? `#${targetUserId.value}` : ''
})

const accountEmail = computed(() => {
  if (uploaderQuery.data.value?.Email) return uploaderQuery.data.value.Email
  if (!isEditingOther.value) return authStore.profile?.Email ?? ''
  return ''
})

const navItems = computed(() => {
  const list = [
    {
      name: 'settings-profile',
      label: t('settings.nav.profile'),
      icon: User,
      to: { name: 'settings-profile', query: targetQuery.value },
    },
    {
      name: 'settings-bio',
      label: t('settings.nav.bio'),
      icon: FileText,
      to: { name: 'settings-bio', query: targetQuery.value },
    },
  ]
  if (!isEditingOther.value) {
    list.push({
      name: 'settings-security',
      label: t('settings.nav.security'),
      icon: Shield,
      to: { name: 'settings-security', query: undefined },
    })
  }
  return list
})

watchEffect(() => {
  const currentTabLabel =
    navItems.value.find((item) => item.name === route.name)?.label ?? t('settings.breadcrumb')
  setBreadcrumb(
    [
      { label: t('nav.home'), to: '/' },
      { label: t('settings.breadcrumb'), to: '/settings/profile' },
      { label: currentTabLabel },
    ],
    targetUserId.value ? `#${targetUserId.value}` : '',
  )
})
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 py-6">
    <SidebarLayout side="left">
      <!-- 左侧设置导航栏 -->
      <template #sidebar>
        <div class="flex flex-col gap-4">
          <div class="space-y-1">
            <div class="text-sm font-semibold text-foreground truncate">
              {{ accountDisplayName }}
            </div>
            <div v-if="accountEmail" class="text-xs text-muted-foreground truncate">
              {{ accountEmail }}
            </div>
            <div
              v-if="isEditingOther && targetUserId"
              class="mt-2 px-2.5 py-1.5 border border-amber-500/35 bg-amber-500/8 text-[11px] font-medium text-amber-900 dark:text-amber-200 flex items-center gap-1.5"
            >
              <UserCog class="size-3.5 shrink-0" />
              <span>{{ t('settings.adminEditingNotice', { id: targetUserId }) }}</span>
            </div>
          </div>

          <Separator />

          <nav :aria-label="t('settings.breadcrumb')" class="space-y-0.5">
            <router-link
              v-for="item in navItems"
              :key="item.name"
              :to="item.to"
              class="w-full px-2.5 py-2 flex items-center gap-2 text-sm transition-colors"
              :class="
                route.name === item.name
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-foreground/85 hover:bg-muted/80 hover:text-foreground'
              "
            >
              <component :is="item.icon" class="size-4 shrink-0" />
              <span>{{ item.label }}</span>
            </router-link>
          </nav>

          <template v-if="targetUserId">
            <Separator />
            <router-link
              :to="`/uploaders/${targetUserId}`"
              class="px-2.5 py-1.5 inline-flex items-center justify-between gap-2 text-sm font-medium text-primary hover:bg-muted/60 transition-colors"
            >
              <span>{{ t('settings.viewPublicProfile') }}</span>
              <ArrowRight class="size-3.5 shrink-0" />
            </router-link>
          </template>
        </div>
      </template>

      <!-- 右侧设置子页面 -->
      <div :class="route.name === 'settings-bio' ? '' : 'max-w-3xl'">
        <router-view />
      </div>
    </SidebarLayout>
  </div>
</template>
