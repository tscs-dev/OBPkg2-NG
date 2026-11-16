<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { getPlatformMeta } from '@/config/platforms'
import { cn } from 'cn'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface Props {
  platforms?: string[] | null
  variant?: 'tile' | 'label'
  showEmpty?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  platforms: null,
  variant: 'label',
  showEmpty: true,
})

const { t } = useI18n()

const resolvedPlatforms = computed(() =>
  (props.platforms ?? []).map((p) => getPlatformMeta(p)).sort((a, b) => a.id > b.id ? 1 : -1),
)
</script>

<template>
  <div
    v-if="resolvedPlatforms.length > 0"
    :class="cn(
      'inline-flex flex-wrap items-center',
      variant === 'tile' ? '' : 'gap-1', 
      props.class
    )"
  >
    <template v-if="variant === 'tile'">
      <Tooltip v-for="meta in resolvedPlatforms" :key="meta.name">
        <TooltipTrigger as-child>
          <span
            class="inline-flex items-center justify-center size-7 px-1.5 text-sm font-mono font-bold leading-none tracking-tight text-white select-none whitespace-nowrap"
            :style="{ backgroundColor: meta.color }"
          >
            {{ meta.shortCode }}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          {{ meta.name }}
        </TooltipContent>
      </Tooltip>
    </template>

    <template v-else>
      <span
        v-for="meta in resolvedPlatforms"
        :key="meta.name"
        class="inline-flex items-center justify-center px-2 py-0.5 text-[11px] font-semibold leading-tight text-white whitespace-nowrap select-none"
        :style="{ backgroundColor: meta.color }"
      >
        {{ meta.name }}
      </span>
    </template>
  </div>

  <span
    v-else-if="showEmpty"
    :class="
      cn(
        'inline-flex items-center border border-dashed border-border px-1.5 py-0.5 text-[11px] leading-none text-muted-foreground whitespace-nowrap',
        props.class,
      )
    "
  >
    {{ t('common.unavailable') }}
  </span>
</template>
