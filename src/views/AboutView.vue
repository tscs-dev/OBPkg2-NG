<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { ExternalLink, Globe, Mail } from '@lucide/vue'
import SidebarLayout from '@/layouts/SidebarLayout.vue'
import { useBreadcrumbState, usePageBreadcrumbCleanup } from '@/composables/useBreadcrumb'
import { formatLocalTimestamp } from '@/utils/date'
import { Separator } from '@/components/ui/separator'

const { t } = useI18n()
const { setBreadcrumb } = useBreadcrumbState()
usePageBreadcrumbCleanup()

const appVersion = __APP_VERSION__
const buildTimeFormatted = computed(() => formatLocalTimestamp(__BUILD_TIME__))
const currentYear = new Date().getFullYear()
const copyrightText = computed(() => t('about.copyright', { year: currentYear }))

const techStackItems = [
  { name: 'Vue 3', role: 'UI Framework' },
  { name: 'TypeScript', role: 'Type System' },
  { name: 'Tailwind CSS v4', role: 'Styling & Typography' },
  { name: 'shadcn-vue / Reka UI', role: 'Accessible Primitives' },
  { name: 'TanStack Vue Query', role: 'Server State & Cache' },
  { name: 'Pinia', role: 'Client Store' },
  { name: 'ofetch', role: 'HTTP Client' },
  { name: 'vue-i18n', role: 'Localization (ZH / EN / JA)' },
  { name: 'DOMPurify', role: 'HTML Sanitization' },
  { name: 'Lucide Icons', role: 'Iconography' },
]

watchEffect(() => {
  setBreadcrumb(
    [
      { label: t('nav.home'), to: '/' },
      { label: t('nav.about') },
    ],
    `v${appVersion}`,
  )
})
</script>

<template>
  <div>
    <!-- 全宽标题与软件铭牌区 -->
    <section class="bg-muted/35 border-b border-border">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div class="space-y-1">
          <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {{ t('about.systemTitle') }}
          </h1>
          <p class="text-xs sm:text-sm text-muted-foreground">
            {{ t('about.systemSubtitle') }}
          </p>
        </div>
      </div>
    </section>

    <!-- 下部双栏主体 -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <SidebarLayout side="right">
        <!-- 左主栏 -->
        <div class="flex flex-col gap-6">
          <section class="space-y-2.5">
            <h2 class="text-sm font-semibold tracking-tight text-foreground">
              {{ t('about.overviewTitle') }}
            </h2>
            <p class="text-sm text-foreground/85 leading-relaxed">
              {{ t('about.overviewBody1') }}
            </p>
          </section>

          <Separator />

          <section class="space-y-2.5">
            <h2 class="text-sm font-semibold tracking-tight text-foreground">
              {{ t('about.copyrightSectionTitle') }}
            </h2>
            <p class="text-sm font-semibold text-foreground">
              {{ copyrightText }}
            </p>
            <p class="text-sm text-foreground/85 leading-relaxed">
              {{ t('about.copyrightBody1') }}
            </p>
          </section>

          <Separator />

          <section class="space-y-3">
            <div class="space-y-1">
              <h2 class="text-sm font-semibold tracking-tight text-foreground">
                {{ t('about.stackTitle') }}
              </h2>
              <p class="text-xs text-muted-foreground">
                {{ t('about.stackSubtitle') }}
              </p>
            </div>

            <dl class="grid grid-cols-1 sm:grid-cols-2 border-t border-l border-border">
              <div
                v-for="item in techStackItems"
                :key="item.name"
                class="px-3.5 py-2.5 border-r border-b border-border flex items-baseline justify-between gap-3"
              >
                <dt class="text-xs font-medium text-foreground">{{ item.name }}</dt>
                <dd class="text-[11px] font-mono text-muted-foreground text-right">{{ item.role }}</dd>
              </div>
            </dl>
          </section>
        </div>

        <!-- 右侧铭牌与端点侧栏 -->
        <template #sidebar>
          <div class="flex flex-col gap-5">
            <!-- 软件铭牌 -->
            <section class="space-y-3">
              <h2 class="text-xs font-semibold mb-1">
                {{ t('about.softwareName') }}
              </h2>
              <p class="text-muted-foreground text-xs">
                Omni-purpose platform for professionally Built Packages
              </p>

              <dl class="space-y-2.5 text-xs">
                <div class="space-y-0.5">
                  <dt class="text-muted-foreground">{{ t('about.meta.versionLabel') }}</dt>
                  <dd class="font-mono text-foreground tabular-nums">v{{ appVersion }}</dd>
                </div>

                <div class="space-y-0.5">
                  <dt class="text-muted-foreground">{{ t('about.meta.buildTimeLabel') }}</dt>
                  <dd class="text-foreground tabular-nums">{{ buildTimeFormatted }}</dd>
                </div>

                <div class="space-y-0.5">
                  <dt class="text-muted-foreground">{{ t('about.meta.copyrightLabel') }}</dt>
                  <dd class="font-medium text-foreground tabular-nums">{{ copyrightText }}</dd>
                </div>
              </dl>
            </section>

            <Separator />

            <!-- 维护与联络 -->
            <section class="space-y-3">
              <h2 class="text-xs font-semibold uppercase trackingdisabled-wider text-muted-foreground">
                {{ t('about.meta.contactHeading') }}
              </h2>

              <dl class="space-y-2.5 text-xs">
                <div class="space-y-0.5">
                  <dt class="text-muted-foreground">{{ t('about.meta.maintainerLabel') }}</dt>
                  <dd class="font-medium text-foreground">Zbx1425</dd>
                </div>

                <div class="space-y-0.5">
                  <dt class="text-muted-foreground">{{ t('about.meta.emailLabel') }}</dt>
                  <dd>
                    <a
                      href="mailto:support@zbx1425.cn"
                      class="inline-flex items-center gap-1.5 text-primary hover:underline underline-offset-4"
                    >
                      <Mail class="size-3 shrink-0" />
                      <span>support@zbx1425.cn</span>
                    </a>
                  </dd>
                </div>

                <div class="space-y-0.5">
                  <dt class="text-muted-foreground">{{ t('about.meta.websiteLabel') }}</dt>
                  <dd>
                    <a
                      href="https://www.zbx1425.cn"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex items-center gap-1.5 text-primary hover:underline underline-offset-4"
                    >
                      <Globe class="size-3 shrink-0" />
                      <span>www.zbx1425.cn</span>
                      <ExternalLink class="size-3 shrink-0" />
                    </a>
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        </template>
      </SidebarLayout>
    </div>
  </div>
</template>
