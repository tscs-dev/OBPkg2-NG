<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { getPlatformMeta } from '@/config/platforms'
import { cn } from 'cn'

interface Props {
  platforms?: string[] | null
  compact?: boolean
  showEmpty?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  platforms: null,
  compact: false,
  showEmpty: true,
})

const { t } = useI18n()

const resolvedPlatforms = computed(() =>
  (props.platforms ?? []).map((p) => getPlatformMeta(p)),
)
</script>

<template>
  <div v-if="resolvedPlatforms.length > 0" :class="cn('inline-flex flex-wrap items-center gap-1', props.class)">
    <span
      v-for="meta in resolvedPlatforms"
      :key="meta.name"
      class="inline-flex items-center gap-1.5 border border-border bg-muted/45 text-foreground font-medium whitespace-nowrap"
      :class="compact ? 'px-1.5 py-0.5 text-[11px] leading-none' : 'px-2 py-0.5 text-xs'"
    >
      <span
        class="size-1.5 rounded-full shrink-0"
        :style="{ backgroundColor: meta.color }"
        aria-hidden="true"
      />
      <span>{{ meta.name }}</span>
    </span>
  </div>
  <span
    v-else-if="showEmpty"
    :class="cn('inline-flex items-center border border-dashed border-border px-1.5 py-0.5 text-[11px] leading-none text-muted-foreground whitespace-nowrap', props.class)"
  >
    {{ t('common.unavailable') }}
  </span>
</template>
