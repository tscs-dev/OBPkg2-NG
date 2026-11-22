<script setup lang="ts">
import type { PaginationPrevProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import type { ButtonVariants } from '@/components/ui/button'
import { ChevronLeftIcon } from "@lucide/vue"
import { reactiveOmit } from "@vueuse/core"
import { cn } from "cn"
import { useI18n } from "vue-i18n"
import { PaginationPrev, useForwardProps } from "reka-ui"
import { buttonVariants } from '@/components/ui/button'

const props = withDefaults(defineProps<PaginationPrevProps & {
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
  <PaginationPrev
    data-slot="pagination-previous"
    :class="cn(buttonVariants({ variant: 'outline', size }), 'rounded-none h-8 gap-1 px-2.5 cursor-pointer', props.class)"
    v-bind="forwarded"
  >
    <ChevronLeftIcon />
    <span class="hidden sm:block">{{ t('packages.paginationPrev') }}</span>
  </PaginationPrev>
</template>
