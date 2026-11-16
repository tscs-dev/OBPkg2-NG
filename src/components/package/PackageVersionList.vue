<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertCircle, Clock, Download, ExternalLink } from '@lucide/vue'
import type { PackageFile } from '@/types/models'
import { buildFileDownloadUrl, getPlatformMeta, PLATFORM_ORDER } from '@/config/platforms'
import { compareVersionsDesc } from '@/utils/version'
import { usePreferencesStore } from '@/stores/preferences'
import { Button } from '@/components/ui/button'

interface Props {
  packageId: number
  files?: PackageFile[] | null
}

const props = withDefaults(defineProps<Props>(), {
  files: null,
})

const { t } = useI18n()
const preferences = usePreferencesStore()

interface PlatformFileGroup {
  platform: string
  meta: ReturnType<typeof getPlatformMeta>
  items: (PackageFile & { downloadUrl: string | null })[]
}

const groupedFiles = computed<PlatformFileGroup[]>(() => {
  const list = props.files ?? []
  if (list.length === 0) return []

  const groups = new Map<string, PackageFile[]>()
  for (const file of list) {
    const key = file.Platform || 'other'
    const existing = groups.get(key)
    if (existing) {
      existing.push(file)
    } else {
      groups.set(key, [file])
    }
  }

  const orderedKeys = Array.from(groups.keys()).sort((a, b) => {
    const idxA = PLATFORM_ORDER.indexOf(a as (typeof PLATFORM_ORDER)[number])
    const idxB = PLATFORM_ORDER.indexOf(b as (typeof PLATFORM_ORDER)[number])
    if (idxA !== -1 && idxB !== -1) return idxA - idxB
    if (idxA !== -1) return -1
    if (idxB !== -1) return 1
    return a.localeCompare(b)
  })

  return orderedKeys.map((platform) => {
    const sorted = [...(groups.get(platform) ?? [])].sort((a, b) =>
      compareVersionsDesc(a.Version, b.Version),
    )
    return {
      platform,
      meta: getPlatformMeta(platform),
      items: sorted.map((file) => ({
        ...file,
        downloadUrl: buildFileDownloadUrl(
          props.packageId,
          file.Platform,
          file.FetchURL,
          preferences.locale,
        ),
      })),
    }
  })
})
</script>

<template>
  <div v-if="groupedFiles.length === 0" class="border border-dashed border-border py-12 px-6 text-center">
    <p class="text-sm text-muted-foreground">{{ t('detail.downloadsEmpty') }}</p>
  </div>

  <div v-else class="space-y-6">
    <section
      v-for="group in groupedFiles"
      :key="group.platform"
      class="border border-border"
    >
      <header class="px-4 py-2.5 bg-muted/45 border-b border-border flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span
            class="size-2 rounded-full shrink-0"
            :style="{ backgroundColor: group.meta.color }"
            aria-hidden="true"
          />
          <h3 class="text-sm font-semibold text-foreground">{{ group.meta.name }}</h3>
        </div>
        <span class="text-xs text-muted-foreground tabular-nums">
          {{ group.items.length }}
        </span>
      </header>

      <ul class="divide-y divide-border">
        <li
          v-for="(file, idx) in group.items"
          :key="file.ID"
          class="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-muted/30 transition-colors"
        >
          <div class="min-w-0 space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-mono text-sm font-semibold text-foreground tabular-nums">
                v{{ file.Version }}
              </span>
              <span
                v-if="idx === 0"
                class="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-primary/10 text-primary border border-primary/20"
              >
                {{ t('detail.downloadsLatest') }}
              </span>
              <span class="text-xs text-muted-foreground tabular-nums">
                {{ file.Size }}
              </span>
            </div>

            <div
              v-if="file.NeedValidation && !file.Validated"
              class="flex items-center gap-1.5 text-xs"
              :class="file.RejectReason ? 'text-destructive' : 'text-amber-700 dark:text-amber-400'"
            >
              <AlertCircle v-if="file.RejectReason" class="size-3.5 shrink-0" />
              <Clock v-else class="size-3.5 shrink-0" />
              <span>
                {{
                  file.RejectReason
                    ? `${t('common.rejected')}: ${file.RejectReason}`
                    : t('common.validationPending')
                }}
              </span>
            </div>
          </div>

          <div class="shrink-0">
            <Button
              v-if="file.downloadUrl"
              as-child
              size="sm"
              class="rounded-none w-full sm:w-auto"
            >
              <a
                :href="file.downloadUrl"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink v-if="file.Platform === 'hmmsim'" class="size-3.5" />
                <Download v-else class="size-3.5" />
                <span>
                  {{
                    file.Platform === 'hmmsim'
                      ? t('detail.hmmsimInstallAction')
                      : t('detail.downloadAction')
                  }}
                </span>
              </a>
            </Button>
            <Button
              v-else
              size="sm"
              variant="outline"
              disabled
              class="rounded-none w-full sm:w-auto"
            >
              {{ t('common.unavailable') }}
            </Button>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>
