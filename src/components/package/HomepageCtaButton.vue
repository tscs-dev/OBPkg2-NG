<script setup lang="ts">
import { computed } from 'vue'
import { ArrowUpRight, Globe } from '@lucide/vue'
import { cn } from 'cn'

interface Props {
  href: string
  label: string
  class?: string
}

const props = defineProps<Props>()

const displayHost = computed(() => {
  const raw = props.href.trim()
  if (!raw) return ''
  try {
    const parsed = new URL(raw)
    return parsed.hostname.replace(/^www\./i, '') || raw
  } catch {
    return raw.replace(/^https?:\/\//i, '').split('/')[0] ?? raw
  }
})
</script>

<template>
  <a
    :href="href"
    target="_blank"
    rel="noopener noreferrer"
    :class="
      cn(
        'group h-11 px-3 inline-flex items-center gap-2.5 bg-primary text-background hover:bg-primary/90 border border-foreground transition-colors focus-visible:outline-2 focus-visible:outline-ring select-none',
        props.class,
      )
    "
  >
    <span
      class="size-7 bg-background/12 flex items-center justify-center shrink-0"
      aria-hidden="true"
    >
      <Globe class="size-4" />
    </span>

    <span class="min-w-0 flex flex-col items-start text-left">
      <span class="text-xs font-semibold leading-tight tracking-wide whitespace-nowrap">
        {{ label }}
      </span>
      <span class="text-[11px] font-mono opacity-80 leading-tight truncate max-w-[180px]">
        {{ displayHost }}
      </span>
    </span>

    <ArrowUpRight
      class="size-4 shrink-0 ml-0.5 opacity-80 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
      aria-hidden="true"
    />
  </a>
</template>
