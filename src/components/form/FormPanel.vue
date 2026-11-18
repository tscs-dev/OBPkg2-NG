<script setup lang="ts">
import { cn } from 'cn'

interface Props {
  title?: string
  description?: string
  class?: string
}

const props = defineProps<Props>()
</script>

<template>
  <section :class="cn('border border-border bg-card', props.class)">
    <header v-if="title" class="min-h-9 px-4 py-2 bg-muted/40 border-b border-border flex flex-wrap items-center justify-between gap-2">
      <div class="min-w-0">
        <h2 class="text-sm font-semibold trackingdisabled-wide text-foreground">
          {{ title }}
        </h2>
        <p v-if="description" class="text-[11px] text-muted-foreground mt-0.5">
          {{ description }}
        </p>
      </div>
      <div v-if="$slots['header-extra']" class="shrink-0">
        <slot name="header-extra" />
      </div>
    </header>

    <div class="divide-y divide-border/60">
      <slot />
    </div>

    <footer
      v-if="$slots.footer"
      class="px-4 py-2.5 bg-muted/25 border-t border-border flex flex-wrap items-center justify-between gap-3"
    >
      <slot name="footer" />
    </footer>
  </section>
</template>
