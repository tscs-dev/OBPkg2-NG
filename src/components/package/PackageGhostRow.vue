<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePreferencesStore } from '@/stores/preferences'
import type { PackageSummary } from '@/types/models'
import { formatDateShort, formatUtcTimestamp } from '@/utils/date'
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
  preferences.formatSecondaryS3(props.pkg.Name, props.pkg.Identifier),
)

const authorName = computed(() => {
  if (!props.pkg.Author) return ''
  return preferences.formatS3(props.pkg.Author.Name)
})

const shortDate = computed(() => formatDateShort(props.pkg.UpdatedAt))
const fullUtcDate = computed(() => formatUtcTimestamp(props.pkg.UpdatedAt))
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
        <div class="flex items-start justify-between gap-2">
          <h3 class="text-[15px] font-semibold leading-snug text-foreground group-hover:text-primary transition-colors truncate">
            {{ primaryName }}
          </h3>
          <PlatformBadge :platforms="pkg.Platforms" compact class="shrink-0 hidden sm:inline-flex" />
        </div>

        <p
          v-if="secondaryName || authorName"
          class="text-xs text-muted-foreground truncate flex items-center gap-1.5"
        >
          <span v-if="secondaryName" class="truncate">{{ secondaryName }}</span>
          <span v-if="secondaryName && authorName" aria-hidden="true">·</span>
          <span v-if="authorName" class="shrink-0">
            {{ t('common.repost') }}: {{ authorName }}
          </span>
        </p>

        <PlatformBadge :platforms="pkg.Platforms" compact class="pt-1 sm:hidden" />
      </div>

      <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
        <span class="font-mono text-[11px] truncate max-w-[240px] sm:max-w-[340px]">
          {{ pkg.Identifier }}
        </span>
        <span aria-hidden="true">·</span>
        <Tooltip>
          <TooltipTrigger as-child>
            <time :datetime="pkg.UpdatedAt" class="whitespace-nowrap">
              {{ shortDate }}
            </time>
          </TooltipTrigger>
          <TooltipContent side="top">
            {{ fullUtcDate }}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  </router-link>
</template>
