<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertCircle, CheckCircle2, Clock, Download, ExternalLink } from '@lucide/vue'
import type { PackageFile } from '@/types/models'
import { buildFileDownloadUrl, PLATFORM_ORDER } from '@/config/platforms'
import { compareVersionsDesc } from '@/utils/version'
import { usePreferencesStore } from '@/stores/preferences'
import PlatformBadge from './PlatformBadge.vue'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface Props {
  packageId: number
  files?: PackageFile[] | null
}

const props = withDefaults(defineProps<Props>(), {
  files: null,
})

const { t } = useI18n()
const preferences = usePreferencesStore()

const sortedFiles = computed(() => {
  const list = (props.files ?? []).filter((file) => !file.NeedValidation || file.Validated)
  if (list.length === 0) return []

  const sorted = [...list].sort((a, b) => {
    const cmp = compareVersionsDesc(a.Version, b.Version)
    if (cmp !== 0) return cmp
    const idxA = PLATFORM_ORDER.indexOf(a.Platform as (typeof PLATFORM_ORDER)[number])
    const idxB = PLATFORM_ORDER.indexOf(b.Platform as (typeof PLATFORM_ORDER)[number])
    if (idxA !== -1 && idxB !== -1 && idxA !== idxB) return idxA - idxB
    return b.ID - a.ID
  })

  const highestVersion = sorted[0]?.Version ?? ''

  return sorted.map((file) => {
    const platforms =
      file.Platforms && file.Platforms.length > 0
        ? file.Platforms
        : file.Platform
          ? [file.Platform]
          : []
    const primaryPlatform = platforms[0] ?? file.Platform
    return {
      ...file,
      platforms,
      primaryPlatform,
      isLatestVersion: file.Version === highestVersion,
      downloadUrl: buildFileDownloadUrl(
        props.packageId,
        primaryPlatform,
        file.FetchURL,
        preferences.locale,
      ),
    }
  })
})
</script>

<template>
  <div v-if="sortedFiles.length === 0" class="border border-dashed border-border py-12 px-6 text-center">
    <p class="text-sm text-muted-foreground">{{ t('detail.downloadsEmpty') }}</p>
  </div>

  <div v-else class="space-y-4">
    <div class="border border-border overflow-x-auto">
      <table class="w-full text-left border-collapse text-sm">
        <thead>
          <tr class="bg-muted/45 border-b border-border text-xs sm:text-sm font-semibold text-muted-foreground">
            <th scope="col" class="py-2.5 px-3.5 whitespace-nowrap">
              {{ t('detail.tableHeaders.version') }}
            </th>
            <th scope="col" class="py-2.5 px-3.5 whitespace-nowrap">
              {{ t('detail.tableHeaders.platform') }}
            </th>
            <th scope="col" class="py-2.5 px-3.5 whitespace-nowrap">
              {{ t('detail.tableHeaders.size') }}
            </th>
            <th scope="col" class="py-2.5 px-3.5 whitespace-nowrap">
              {{ t('detail.tableHeaders.status') }}
            </th>
            <th scope="col" class="py-2.5 px-3.5 text-right whitespace-nowrap w-20">
              {{ t('detail.tableHeaders.download') }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr
            v-for="file in sortedFiles"
            :key="file.ID"
            class="hover:bg-muted/35 transition-colors"
          >
            <td class="py-2.5 px-3.5 whitespace-nowrap">
              <div class="inline-flex items-center gap-2">
                <span class="font-mono font-semibold text-foreground tabular-nums">
                  v{{ file.Version }}
                </span>
                <span
                  v-if="file.isLatestVersion"
                  class="px-1.5 py-0.5 text-[10px] font-semibold uppercase trackingdisabled-wide bg-primary/10 text-primary border border-primary/20"
                >
                  {{ t('detail.downloadsLatest') }}
                </span>
              </div>
            </td>

            <td class="py-2.5 px-3.5 whitespace-nowrap">
              <PlatformBadge :platforms="file.platforms" variant="label" />
            </td>

            <td class="py-2.5 px-3.5 text-xs sm:text-sm text-muted-foreground tabular-nums whitespace-nowrap">
              {{ file.Size }}
            </td>

            <td class="py-2.5 px-3.5 text-xs sm:text-sm whitespace-nowrap">
              <span
                v-if="file.NeedValidation && !file.Validated && file.RejectReason"
                class="inline-flex items-center gap-1.5 text-destructive"
              >
                <AlertCircle class="size-3.5 shrink-0" />
                <span>{{ `${t('common.rejected')}: ${file.RejectReason}` }}</span>
              </span>
              <span
                v-else-if="file.NeedValidation && !file.Validated"
                class="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400"
              >
                <Clock class="size-3.5 shrink-0" />
                <span>{{ t('common.validationPending') }}</span>
              </span>
              <span
                v-else
                class="inline-flex items-center gap-1.5 text-muted-foreground"
              >
                <CheckCircle2 class="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{{ t('common.validated') }}</span>
              </span>
            </td>

            <td class="py-2 px-3.5 text-right whitespace-nowrap">
              <Tooltip v-if="file.downloadUrl">
                <TooltipTrigger as-child>
                  <Button
                    as-child
                    variant="ghost"
                    size="icon-sm"
                    class="rounded-none text-primary hover:text-primary hover:bg-primary/10"
                  >
                    <a
                      :href="file.downloadUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      :aria-label="
                        file.primaryPlatform === 'hmmsim'
                          ? t('detail.hmmsimInstallAction')
                          : t('detail.downloadAction')
                      "
                    >
                      <ExternalLink v-if="file.primaryPlatform === 'hmmsim'" class="size-4" />
                      <Download v-else class="size-4" />
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  {{
                    file.primaryPlatform === 'hmmsim'
                      ? t('detail.hmmsimInstallAction')
                      : t('detail.downloadAction')
                  }}
                </TooltipContent>
              </Tooltip>

              <Button
                v-else
                variant="ghost"
                size="icon-sm"
                disabled
                class="rounded-none"
                :aria-label="t('common.unavailable')"
              >
                <Download class="size-4" />
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
