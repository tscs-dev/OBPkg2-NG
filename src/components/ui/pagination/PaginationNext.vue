<script setup lang="ts">
import type { PaginationNextProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import type { ButtonVariants } from '@/components/ui/button'
import { ChevronRightIcon } from "@lucide/vue"
import { reactiveOmit } from "@vueuse/core"
import { cn } from "cn"
import { useI18n } from "vue-i18n"
import { PaginationNext, useForwardProps } from "reka-ui"
import { buttonVariants } from '@/components/ui/button'

const props = withDefaults(defineProps<PaginationNextProps & {
  size?: ButtonVariants["size"]
  class?: HTMLAttributes["class"]
}>(), {
  size: "sm",
})

const { t } = useI18n()
const delegatedProps = reactiveOmit(props, "class", "size")
const forwarded = useForwardProps(delegatedProps)
</script>

<template>
  <PaginationNext
    data-slot="pagination-next"
    :class="cn(buttonVariants({ variant: 'outline', size }), 'rounded-none h-8 gap-1 px-2.5 cursor-pointer', props.class)"
    v-bind="forwarded"
  >
    <span class="hidden sm:block">{{ t('packages.paginationNext') }}</span>
    <ChevronRightIcon />
  </PaginationNext>
</template>
