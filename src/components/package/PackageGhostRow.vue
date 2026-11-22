<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePreferencesStore } from '@/stores/preferences'
import type { PackageSummary } from '@/types/models'
import { formatDateShort, formatLocalTimestamp } from '@/utils/date'
import { hasValidAuthor } from '@/utils/package'
import PackageThumbnail from './PackageThumbnail.vue'
import PlatformBadge from './PlatformBadge.vue'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface Props {
  pkg: PackageSummary
}

const props = defineProps<Props>()

const { t } = useI18n()
const preferences = usePreferencesStore()

const primaryName = computed(
  () => preferences.formatS3(props.pkg.Name) || props.pkg.Identifier,
)

const secondaryName = computed(() =>
  preferences.formatSecondaryS3(props.pkg.Name),
)

const attributionText = computed(() => {
  if (hasValidAuthor(props.pkg.Author)) {
    const authorName = preferences.formatS3(props.pkg.Author.Name)
    return authorName ? `${t('common.repostLabel')}: ${authorName}` : t('common.repostLabel')
  }
  if (props.pkg.Uploader) {
    const uploaderName = preferences.formatS3(props.pkg.Uploader.Name)
    if (uploaderName) {
      return `${t('common.authorLabel')}: ${uploaderName}`
    }
  }
  return t('common.original')
})

const shortDate = computed(() => formatDateShort(props.pkg.UpdatedAt))
const fullLocalDate = computed(() => formatLocalTimestamp(props.pkg.UpdatedAt))
</script>

<template>
  <router-link
    :to="`/packages/${pkg.ID}`"
    class="group -mx-3 px-3 py-3 flex items-start gap-3.5 transition-colors duration-150 hover:bg-muted/75 focus-visible:bg-muted/75 focus-visible:outline-2 focus-visible:outline-ring"
  >
    <PackageThumbnail
      :thumbnail="pkg.Thumbnail"
      :thumbnail-lq="pkg.ThumbnailLQ"
      :alt="primaryName"
      class="w-[104px] h-[68px] sm:w-[144px] sm:h-[90px] shrink-0"
    />

    <div class="min-w-0 flex-1 flex flex-col justify-between min-h-[68px] sm:min-h-[90px] gap-1">
      <div class="space-y-0.5 min-w-0">
        <PlatformBadge :platforms="pkg.Platforms" variant="tile" class="pt-1 float-end" />
        <div class="flex items-start justify-between gap-2">
          <h3 class="text-[15px] font-semibold leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
            {{ primaryName }}
          </h3>
        </div>

        <p v-if="secondaryName" class="text-xs text-muted-foreground truncate flex items-center gap-1.5">
          <span class="truncate">{{ secondaryName }}</span>
        </p>
        <p class="text-xs text-muted-foreground truncate flex items-center gap-1.5">
          <span class="shrink-0">{{ attributionText }}</span>
        </p>
      </div>

      <div class="flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
        <Tooltip>
          <TooltipTrigger as-child>
            <time :datetime="pkg.UpdatedAt" class="whitespace-nowrap">
              {{ shortDate }}
            </time>
          </TooltipTrigger>
          <TooltipContent side="top">
            {{ fullLocalDate }}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  </router-link>
</template>
