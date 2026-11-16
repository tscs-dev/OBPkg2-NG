<script setup lang="ts">
import { computed } from 'vue'
import { cn } from 'cn'

interface Props {
  side?: 'left' | 'right'
  hideSidebarOnMobile?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  side: 'left',
  hideSidebarOnMobile: false,
})

const gridClass = computed(() =>
  props.side === 'left'
    ? 'lg:grid-cols-[var(--layout-sidebar-width)_minmax(0,1fr)]'
    : 'lg:grid-cols-[minmax(0,1fr)_var(--layout-sidebar-width)]',
)

const asideClass = computed(() =>
  cn(
    'min-w-0 lg:sticky lg:top-[4.5rem] lg:self-start',
    props.side === 'left'
      ? 'lg:border-r lg:border-border lg:pr-6'
      : 'lg:border-l lg:border-border lg:pl-6',
    props.hideSidebarOnMobile ? 'hidden lg:block' : 'block',
  ),
)
</script>

<template>
  <div :class="cn('grid grid-cols-1 gap-8', gridClass, props.class)">
    <template v-if="side === 'left'">
      <aside :class="asideClass">
        <slot name="sidebar" />
      </aside>
      <div class="min-w-0">
        <slot />
      </div>
    </template>

    <template v-else>
      <div class="min-w-0">
        <slot />
      </div>
      <aside :class="asideClass">
        <slot name="sidebar" />
      </aside>
    </template>
  </div>
</template>
