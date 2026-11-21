<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  Maximize2,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from '@lucide/vue'
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'

export interface LightboxImageItem {
  src: string
  alt?: string
}

interface Props {
  open: boolean
  src?: string | null
  alt?: string
  images?: LightboxImageItem[]
  initialIndex?: number
}

const props = withDefaults(defineProps<Props>(), {
  src: null,
  alt: '',
  images: () => [],
  initialIndex: 0,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { t } = useI18n()

const MIN_SCALE = 0.25
const MAX_SCALE = 8

const stageRef = ref<HTMLElement | null>(null)
const imgRef = ref<HTMLImageElement | null>(null)

const currentIndex = ref(0)
const scale = ref(1)
const panX = ref(0)
const panY = ref(0)
const isDragging = ref(false)
const isLoading = ref(true)
const hasError = ref(false)

const naturalWidth = ref(0)
const naturalHeight = ref(0)
const renderedFitWidth = ref(0)

// 多点触控追踪（支持单指平移 & 双指捏合缩放）
const activePointers = new Map<number, { x: number; y: number }>()
let pointerStartPanX = 0
let pointerStartPanY = 0
let pointerStartCenterX = 0
let pointerStartCenterY = 0
let pointerMovedDistance = 0
let pinchStartDistance = 0
let pinchStartScale = 1
let skipNextBackdropClick = false

const normalizedImages = computed<LightboxImageItem[]>(() => {
  if (props.images && props.images.length > 0) {
    return props.images.filter((item) => Boolean(item.src?.trim()))
  }
  if (props.src?.trim()) {
    return [{ src: props.src.trim(), alt: props.alt }]
  }
  return []
})

const currentItem = computed<LightboxImageItem | null>(() => {
  const list = normalizedImages.value
  if (list.length === 0) return null
  const idx = Math.max(0, Math.min(currentIndex.value, list.length - 1))
  return list[idx] ?? null
})

const hasMultiple = computed(() => normalizedImages.value.length > 1)

const displayTitle = computed(() => currentItem.value?.alt || props.alt || '')

const displayPercent = computed(() => {
  if (naturalWidth.value > 0 && renderedFitWidth.value > 0) {
    const actualRatio = (renderedFitWidth.value * scale.value) / naturalWidth.value
    return Math.round(actualRatio * 100)
  }
  return Math.round(scale.value * 100)
})

const imageTransformStyle = computed(() => ({
  transform: `translate3d(${panX.value}px, ${panY.value}px, 0) scale(${scale.value})`,
  transition: isDragging.value ? 'none' : 'transform 120ms cubic-bezier(0.2, 0, 0, 1)',
}))

function resetTransform() {
  scale.value = 1
  panX.value = 0
  panY.value = 0
}

function clampScale(next: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, next))
}

function measureFitWidth() {
  const img = imgRef.value
  if (!img) return
  const rect = img.getBoundingClientRect()
  if (scale.value > 0) {
    renderedFitWidth.value = rect.width / scale.value
  }
}

function zoomAtClientPoint(targetScale: number, clientX?: number, clientY?: number) {
  const prevScale = scale.value
  const nextScale = clampScale(targetScale)
  if (nextScale === prevScale) return

  const stage = stageRef.value
  if (stage && clientX !== undefined && clientY !== undefined) {
    const rect = stage.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const dx = clientX - centerX
    const dy = clientY - centerY
    const factor = nextScale / prevScale
    panX.value = dx - (dx - panX.value) * factor
    panY.value = dy - (dy - panY.value) * factor
  } else {
    const factor = nextScale / prevScale
    panX.value *= factor
    panY.value *= factor
  }

  scale.value = nextScale
  if (Math.abs(nextScale - 1) < 0.02 && nextScale <= 1) {
    panX.value = 0
    panY.value = 0
  }
}

function zoomStep(direction: 1 | -1) {
  const factor = direction > 0 ? 1.35 : 1 / 1.35
  zoomAtClientPoint(scale.value * factor)
}

function toggleActualPixels() {
  if (naturalWidth.value > 0 && renderedFitWidth.value > 0) {
    const oneToOneScale = naturalWidth.value / renderedFitWidth.value
    if (Math.abs(scale.value - oneToOneScale) < 0.08) {
      resetTransform()
    } else {
      scale.value = clampScale(oneToOneScale)
      panX.value = 0
      panY.value = 0
    }
  } else {
    if (Math.abs(scale.value - 2) < 0.1) {
      resetTransform()
    } else {
      scale.value = 2
      panX.value = 0
      panY.value = 0
    }
  }
}

function handleWheel(e: WheelEvent) {
  if (!currentItem.value || hasError.value) return
  e.preventDefault()
  const delta = -e.deltaY
  const intensity = e.deltaMode === 1 ? 0.12 : 0.0018
  const factor = Math.exp(Math.max(-0.5, Math.min(0.5, delta * intensity)))
  zoomAtClientPoint(scale.value * factor, e.clientX, e.clientY)
}

function handleDoubleClick(e: MouseEvent) {
  if (!currentItem.value || hasError.value) return
  if (scale.value > 1.15) {
    resetTransform()
  } else {
    let target = 2.5
    if (naturalWidth.value > 0 && renderedFitWidth.value > 0) {
      const oneToOne = naturalWidth.value / renderedFitWidth.value
      target = oneToOne > 1.25 ? Math.min(4, oneToOne) : 2.2
    }
    zoomAtClientPoint(target, e.clientX, e.clientY)
  }
}

function getPinchDistance(): number {
  const pts = Array.from(activePointers.values())
  if (pts.length < 2) return 0
  const dx = pts[0]!.x - pts[1]!.x
  const dy = pts[0]!.y - pts[1]!.y
  return Math.hypot(dx, dy)
}

function getPointersCenter(): { x: number; y: number } {
  const pts = Array.from(activePointers.values())
  if (pts.length === 0) return { x: 0, y: 0 }
  let sumX = 0
  let sumY = 0
  for (const pt of pts) {
    sumX += pt.x
    sumY += pt.y
  }
  return { x: sumX / pts.length, y: sumY / pts.length }
}

function handlePointerDown(e: PointerEvent) {
  if (e.button !== 0 && e.pointerType === 'mouse') return
  const target = e.currentTarget as HTMLElement
  target.setPointerCapture?.(e.pointerId)

  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  isDragging.value = true
  pointerMovedDistance = 0

  const center = getPointersCenter()
  pointerStartCenterX = center.x
  pointerStartCenterY = center.y
  pointerStartPanX = panX.value
  pointerStartPanY = panY.value

  if (activePointers.size === 2) {
    pinchStartDistance = getPinchDistance()
    pinchStartScale = scale.value
  }
}

function handlePointerMove(e: PointerEvent) {
  if (!activePointers.has(e.pointerId)) return
  const prev = activePointers.get(e.pointerId)!
  pointerMovedDistance += Math.hypot(e.clientX - prev.x, e.clientY - prev.y)
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

  const center = getPointersCenter()

  if (activePointers.size === 1) {
    panX.value = pointerStartPanX + (center.x - pointerStartCenterX)
    panY.value = pointerStartPanY + (center.y - pointerStartCenterY)
  } else if (activePointers.size >= 2 && pinchStartDistance > 0) {
    const dist = getPinchDistance()
    const nextScale = clampScale(pinchStartScale * (dist / pinchStartDistance))
    const stage = stageRef.value
    if (stage) {
      const rect = stage.getBoundingClientRect()
      const stageCenterX = rect.left + rect.width / 2
      const stageCenterY = rect.top + rect.height / 2
      const dx = center.x - stageCenterX
      const dy = center.y - stageCenterY
      const factor = nextScale / pinchStartScale
      panX.value =
        dx - (dx - pointerStartPanX) * factor + (center.x - pointerStartCenterX)
      panY.value =
        dy - (dy - pointerStartPanY) * factor + (center.y - pointerStartCenterY)
    }
    scale.value = nextScale
  }
}

function handlePointerUp(e: PointerEvent) {
  if (!activePointers.has(e.pointerId)) return
  activePointers.delete(e.pointerId)

  if (pointerMovedDistance > 5) {
    skipNextBackdropClick = true
  }

  if (activePointers.size === 0) {
    isDragging.value = false
  } else {
    const center = getPointersCenter()
    pointerStartCenterX = center.x
    pointerStartCenterY = center.y
    pointerStartPanX = panX.value
    pointerStartPanY = panY.value
    if (activePointers.size === 2) {
      pinchStartDistance = getPinchDistance()
      pinchStartScale = scale.value
    }
  }
}

function handleStageClick(e: MouseEvent) {
  if (skipNextBackdropClick) {
    skipNextBackdropClick = false
    return
  }
  // 仅当点击空白画布背景且未放大拖拽时关闭，避免看细节误关
  if (e.target === stageRef.value && scale.value <= 1.05) {
    emit('update:open', false)
  }
}

function handleImageLoad() {
  isLoading.value = false
  hasError.value = false
  const img = imgRef.value
  if (img) {
    naturalWidth.value = img.naturalWidth
    naturalHeight.value = img.naturalHeight
    requestAnimationFrame(measureFitWidth)
  }
}

function handleImageError() {
  isLoading.value = false
  hasError.value = true
}

function goPrev() {
  if (!hasMultiple.value) return
  const len = normalizedImages.value.length
  currentIndex.value = (currentIndex.value - 1 + len) % len
}

function goNext() {
  if (!hasMultiple.value) return
  const len = normalizedImages.value.length
  currentIndex.value = (currentIndex.value + 1) % len
}

function handleKeydown(e: KeyboardEvent) {
  if (!props.open) return
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    goPrev()
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    goNext()
  } else if (e.key === '+' || e.key === '=') {
    e.preventDefault()
    zoomStep(1)
  } else if (e.key === '-' || e.key === '_') {
    e.preventDefault()
    zoomStep(-1)
  } else if (e.key === '0') {
    e.preventDefault()
    resetTransform()
  }
}

watch(
  () => props.open,
  (isOpen, wasOpen) => {
    if (isOpen) {
      const len = normalizedImages.value.length
      const idx = Math.max(0, Math.min(props.initialIndex ?? 0, Math.max(0, len - 1)))
      currentIndex.value = idx
      resetTransform()
      isLoading.value = true
      hasError.value = false
      naturalWidth.value = 0
      renderedFitWidth.value = 0
      if (!wasOpen) {
        window.addEventListener('keydown', handleKeydown)
        window.addEventListener('resize', measureFitWidth)
      }
    } else {
      activePointers.clear()
      isDragging.value = false
      window.removeEventListener('keydown', handleKeydown)
      window.removeEventListener('resize', measureFitWidth)
    }
  },
  { immediate: true },
)

watch(normalizedImages, (imgs) => {
  if (imgs.length === 0) {
    emit('update:open', false)
    return
  }
  if (currentIndex.value >= imgs.length) {
    currentIndex.value = imgs.length - 1
  }
})

watch(
  () => currentItem.value?.src,
  () => {
    resetTransform()
    hasError.value = false
    naturalWidth.value = 0
    renderedFitWidth.value = 0
    nextTick(() => {
      const img = imgRef.value
      if (img && img.complete && img.naturalWidth > 0) {
        isLoading.value = false
        naturalWidth.value = img.naturalWidth
        measureFitWidth()
      } else {
        isLoading.value = true
      }
    })
  },
)

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', measureFitWidth)
})
</script>

<template>
  <DialogRoot :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/92 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <DialogContent
        class="fixed inset-0 z-50 w-screen h-dvh flex flex-col bg-transparent text-white outline-none select-none"
      >
        <DialogTitle class="sr-only">
          {{ displayTitle || 'Image Preview' }}
        </DialogTitle>
        <DialogDescription class="sr-only">
          {{ t('detail.zoomImage') }}
        </DialogDescription>

        <!-- 顶部控制条 -->
        <header class="h-12 px-3 sm:px-5 bg-black/75 border-b border-white/12 flex items-center justify-between gap-3 shrink-0 z-20">
          <div class="min-w-0 flex items-center gap-3 text-xs">
            <span
              v-if="hasMultiple"
              class="px-2 py-0.5 bg-white/10 font-mono tabular-nums shrink-0"
            >
              {{ currentIndex + 1 }} / {{ normalizedImages.length }}
            </span>
            <span v-if="displayTitle" class="text-white/85 truncate">
              {{ displayTitle }}
            </span>
            <span
              v-if="naturalWidth > 0 && naturalHeight > 0"
              class="hidden md:inline font-mono text-[11px] text-white/50 tabular-nums shrink-0"
            >
              {{ naturalWidth }} × {{ naturalHeight }}
            </span>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <button
              type="button"
              class="h-8 w-8 inline-flex items-center justify-center text-white/80 hover:text-white hover:bg-white/12 transition-colors cursor-pointer"
              :title="t('lightbox.zoomOut')"
              @click="zoomStep(-1)"
            >
              <ZoomOut class="size-4" />
            </button>

            <span class="min-w-12 text-center font-mono text-xs text-white/85 tabular-nums">
              {{ displayPercent }}%
            </span>

            <button
              type="button"
              class="h-8 w-8 inline-flex items-center justify-center text-white/80 hover:text-white hover:bg-white/12 transition-colors cursor-pointer"
              :title="t('lightbox.zoomIn')"
              @click="zoomStep(1)"
            >
              <ZoomIn class="size-4" />
            </button>

            <span class="mx-1 h-4 w-px bg-white/15" aria-hidden="true" />

            <button
              type="button"
              class="h-8 px-2 hidden sm:inline-flex items-center gap-1 text-xs font-mono text-white/80 hover:text-white hover:bg-white/12 transition-colors cursor-pointer"
              :title="t('lightbox.actualSize')"
              @click="toggleActualPixels"
            >
              <Maximize2 class="size-3.5" />
              <span>1:1</span>
            </button>

            <button
              type="button"
              class="h-8 w-8 inline-flex items-center justify-center text-white/80 hover:text-white hover:bg-white/12 transition-colors cursor-pointer"
              :title="t('lightbox.resetView')"
              @click="resetTransform"
            >
              <RotateCcw class="size-3.5" />
            </button>

            <a
              v-if="currentItem"
              :href="currentItem.src"
              target="_blank"
              rel="noopener noreferrer"
              class="h-8 w-8 inline-flex items-center justify-center text-white/80 hover:text-white hover:bg-white/12 transition-colors"
              :title="t('lightbox.openOriginal')"
            >
              <ExternalLink class="size-3.5" />
            </a>

            <span class="mx-1 h-4 w-px bg-white/15" aria-hidden="true" />

            <button
              type="button"
              class="h-8 w-8 inline-flex items-center justify-center text-white/85 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
              :title="t('common.close')"
              @click="emit('update:open', false)"
            >
              <X class="size-4" />
            </button>
          </div>
        </header>

        <!-- 主看图画布 -->
        <div
          ref="stageRef"
          class="relative flex-1 min-h-0 overflow-hidden flex items-center justify-center touch-none"
          :class="isDragging ? 'cursor-grabbing' : 'cursor-grab'"
          @wheel="handleWheel"
          @dblclick="handleDoubleClick"
          @pointerdown="handlePointerDown"
          @pointermove="handlePointerMove"
          @pointerup="handlePointerUp"
          @pointercancel="handlePointerUp"
          @click="handleStageClick"
        >
          <div
            v-if="isLoading"
            class="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
          >
            <Loader2 class="size-7 animate-spin text-white/75" />
          </div>

          <div
            v-if="hasError && currentItem"
            class="px-5 py-4 border border-white/20 bg-black/75 text-center space-y-2.5 z-10 max-w-sm"
          >
            <p class="text-xs text-white/85 leading-relaxed">
              {{ t('lightbox.loadError') }}
            </p>
            <a
              :href="currentItem.src"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1.5 text-xs text-white underline underline-offset-4"
            >
              <span>{{ t('lightbox.openOriginal') }}</span>
              <ExternalLink class="size-3.5" />
            </a>
          </div>

          <img
            v-if="currentItem && !hasError"
            :key="currentItem.src"
            ref="imgRef"
            :src="currentItem.src"
            :alt="displayTitle"
            draggable="false"
            class="max-w-[calc(100vw-3rem)] max-h-[calc(100dvh-4.5rem)] object-contain will-change-transform"
            :style="imageTransformStyle"
            @load="handleImageLoad"
            @error="handleImageError"
          />

          <!-- 多图左右翻页按钮 -->
          <button
            v-if="hasMultiple"
            type="button"
            class="absolute left-3 top-1/2 -translate-y-1/2 size-10 bg-black/60 hover:bg-black/85 border border-white/15 inline-flex items-center justify-center text-white transition-colors cursor-pointer z-20"
            :title="t('lightbox.prev')"
            @pointerdown.stop
            @click.stop="goPrev"
          >
            <ChevronLeft class="size-5" />
          </button>

          <button
            v-if="hasMultiple"
            type="button"
            class="absolute right-3 top-1/2 -translate-y-1/2 size-10 bg-black/60 hover:bg-black/85 border border-white/15 inline-flex items-center justify-center text-white transition-colors cursor-pointer z-20"
            :title="t('lightbox.next')"
            @pointerdown.stop
            @click.stop="goNext"
          >
            <ChevronRight class="size-5" />
          </button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
