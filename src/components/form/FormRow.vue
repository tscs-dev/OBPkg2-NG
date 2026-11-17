<script setup lang="ts">
import { cn } from 'cn'

interface Props {
  label: string
  htmlFor?: string
  required?: boolean
  hint?: string
  error?: string | null
  stacked?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  required: false,
  stacked: false,
  error: null,
})
</script>

<template>
  <div
    :class="
      cn(
        'px-4 py-3',
        stacked
          ? 'flex flex-col gap-1.5'
          : 'grid grid-cols-1 sm:grid-cols-[150px_minmax(0,1fr)] gap-1.5 sm:gap-4 items-start',
        props.class,
      )
    "
  >
    <div :class="stacked ? '' : 'sm:pt-1.5'">
      <label
        :for="htmlFor"
        class="text-[13px] font-medium text-foreground leading-snug inline-flex items-center gap-0.5"
      >
        <span>{{ label }}</span>
        <span v-if="required" class="text-destructive" aria-hidden="true">*</span>
      </label>
    </div>

    <div class="min-w-0 space-y-1.5">
      <slot />
      <p v-if="error" class="text-xs text-destructive leading-snug" role="alert">
        {{ error }}
      </p>
      <p v-else-if="hint" class="text-xs text-muted-foreground leading-relaxed">
        {{ hint }}
      </p>
    </div>
  </div>
</template>
