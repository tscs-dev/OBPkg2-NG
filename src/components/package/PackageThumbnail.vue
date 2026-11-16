<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { cn } from 'cn'

interface Props {
  thumbnail?: string
  thumbnailLq?: string
  preferHighRes?: boolean
  alt: string
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  thumbnail: '',
  thumbnailLq: '',
  preferHighRes: false,
})

const fallbackIndex = ref(0)

const candidateUrls = computed(() => {
  const urls = props.preferHighRes
    ? [props.thumbnail, props.thumbnailLq]
    : [props.thumbnailLq, props.thumbnail]
  const unique: string[] = []
  for (const url of urls) {
    const trimmed = url?.trim()
    if (trimmed && !unique.includes(trimmed)) {
      unique.push(trimmed)
    }
  }
  return unique
})

watch(
  () => [props.thumbnail, props.thumbnailLq, props.preferHighRes],
  () => {
    fallbackIndex.value = 0
  },
)

const activeSrc = computed(() => candidateUrls.value[fallbackIndex.value] ?? null)

function handleError() {
  fallbackIndex.value += 1
}
</script>

<template>
  <div
    :class="cn(
      'relative overflow-hidden bg-muted/60 ring-1 ring-inset ring-foreground/10 select-none',
      props.class,
    )"
  >
    <img
      v-if="activeSrc"
      :src="activeSrc"
      :alt="alt"
      loading="lazy"
      decoding="async"
      class="size-full object-cover transition-opacity duration-200"
      @error="handleError"
    />
    <!-- 无图或加载失败时的克制铁路几何占位图 -->
    <div
      v-else
      class="size-full flex items-center justify-center bg-muted/50 text-muted-foreground/35"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 120 75"
        fill="none"
        class="w-3/4 h-3/4"
      >
        <path
          d="M12 62 L48 16 M108 62 L72 16"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="square"
        />
        <path
          d="M22 52 H98 M31 40 H89 M39 29 H81 M45 20 H75"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="square"
          opacity="0.7"
        />
      </svg>
    </div>
  </div>
</template>
