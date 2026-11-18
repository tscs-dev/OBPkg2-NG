<script setup lang="ts">
import { watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, Compass, Home } from '@lucide/vue'
import { useBreadcrumbState, usePageBreadcrumbCleanup } from '@/composables/useBreadcrumb'
import { Button } from '@/components/ui/button'

const route = useRoute()
const { t } = useI18n()
const { setBreadcrumb } = useBreadcrumbState()
usePageBreadcrumbCleanup()

watchEffect(() => {
  setBreadcrumb(
    [
      { label: t('nav.home'), to: '/' },
      { label: '404' },
    ],
    '404',
  )
})
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
    <div class="max-w-xl border border-border bg-card">
      <div class="px-5 py-3 bg-muted/40 border-b border-border flex items-center justify-between gap-3">
        <span class="font-mono text-xs font-semibold trackingdisabled-wider text-muted-foreground">
          HTTP 404 · NOT FOUND
        </span>
        <span class="font-mono text-xs text-muted-foreground truncate max-w-[260px]">
          {{ route.fullPath }}
        </span>
      </div>

      <div class="p-6 space-y-3">
        <h1 class="text-lg font-bold tracking-tight text-foreground">
          {{ t('notFound.title') }}
        </h1>
        <p class="text-sm text-muted-foreground leading-relaxed">
          {{ t('notFound.desc') }}
        </p>
      </div>

      <div class="px-5 py-3 bg-muted/25 border-t border-border flex flex-wrap items-center gap-2">
        <Button as-child size="sm" class="rounded-none">
          <router-link to="/">
            <Home class="size-3.5" />
            <span>{{ t('notFound.backHome') }}</span>
          </router-link>
        </Button>
        <Button as-child variant="outline" size="sm" class="rounded-none">
          <router-link to="/packages">
            <Compass class="size-3.5" />
            <span>{{ t('notFound.browsePackages') }}</span>
          </router-link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          class="rounded-none cursor-pointer ml-auto"
          @click="$router.back()"
        >
          <ArrowLeft class="size-3.5" />
          <span>{{ t('notFound.goBack') }}</span>
        </Button>
      </div>
    </div>
  </div>
</template>
