<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { FolderOpen, Loader2 } from '@lucide/vue'
import { ENV } from '@/config/env'
import { useAuthStore } from '@/stores/auth'
import { formatBytesToPackageSize, normalizeStoragePath } from '@/utils/format'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface FileCartonPickedItem {
  path: string
  name: string
  isDir: boolean
  size?: number
}

interface Props {
  open: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  select: [payload: { path: string; size: string }]
}>()

const { t } = useI18n()
const authStore = useAuthStore()

const iframeRef = ref<HTMLIFrameElement | null>(null)
const isLoading = ref(true)
const errorNotice = ref('')
let authDispatched = false
let openGen = 0

async function sendJwtToIframe() {
  if (authDispatched) return
  const gen = openGen
  const targetWindow = iframeRef.value?.contentWindow
  if (!targetWindow) return

  const jwt = await authStore.ensureValidToken()
  if (gen !== openGen || !props.open) return
  if (!jwt) {
    errorNotice.value = t('nav.sessionExpiredBanner')
    return
  }

  authDispatched = true
  targetWindow.postMessage(
    {
      type: 'auth:jwt',
      jwt,
    },
    ENV.filePickerOrigin,
  )
}

function handleIframeLoad() {
  isLoading.value = false
  void sendJwtToIframe()
}

function handleWindowMessage(event: MessageEvent) {
  if (!props.open) return
  if (event.origin !== ENV.filePickerOrigin) return

  const data = event.data as { type?: string; files?: FileCartonPickedItem[] } | null
  if (!data || typeof data.type !== 'string') return

  if (data.type === 'filecarton:pick' && Array.isArray(data.files) && data.files.length > 0) {
    const picked = data.files.find((item) => !item.isDir)
    if (!picked) {
      errorNotice.value = t('packageEdit.versions.pickerSelectFileOnly')
      return
    }
    const path = normalizeStoragePath(picked.path)
    const size = typeof picked.size === 'number' && picked.size > 0
      ? formatBytesToPackageSize(picked.size)
      : ''
    emit('select', { path, size })
    emit('update:open', false)
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      openGen++
      isLoading.value = true
      errorNotice.value = ''
      authDispatched = false
      window.addEventListener('message', handleWindowMessage)
    } else {
      window.removeEventListener('message', handleWindowMessage)
    }
  },
)

onBeforeUnmount(() => {
  window.removeEventListener('message', handleWindowMessage)
})
</script>

<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent
      class="p-0 flex flex-col gap-0 rounded-none overflow-hidden sm:w-[calc(100vw-4rem)] sm:max-w-5xl sm:h-[min(78vh,720px)] max-sm:inset-0 max-sm:w-screen max-sm:h-svh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:border-0"
    >
      <DialogHeader class="px-4 py-2.5 bg-muted/40 border-b border-border pr-10 shrink-0 text-left">
        <DialogTitle class="text-sm font-semibold trackingdisabled-wide flex items-center gap-2">
          <FolderOpen class="size-3.5 text-primary shrink-0" />
          <span>{{ t('packageEdit.versions.pickerTitle') }}</span>
        </DialogTitle>
        <DialogDescription class="sr-only">
          {{ t('packageEdit.versions.pickerTitle') }}
        </DialogDescription>
      </DialogHeader>

      <div
        v-if="errorNotice"
        role="alert"
        class="px-4 py-2 bg-destructive/10 border-b border-destructive/25 text-sm text-destructive shrink-0"
      >
        {{ errorNotice }}
      </div>

      <div class="relative flex-1 min-h-0 bg-muted/15">
        <div
          v-if="isLoading"
          class="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground bg-background/80 z-10 pointer-events-none"
        >
          <Loader2 class="size-4 animate-spin text-primary" />
          <span>{{ t('common.loading') }}</span>
        </div>

        <iframe
          v-if="open"
          ref="iframeRef"
          :src="ENV.filePickerUrl"
          class="w-full h-full border-0 block"
          @load="handleIframeLoad"
        />
      </div>
    </DialogContent>
  </Dialog>
</template>
