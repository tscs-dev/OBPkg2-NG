<script setup lang="ts">
import { computed } from 'vue'
import { NodeViewWrapper } from '@tiptap/vue-3'
import { AlertCircle, Loader2, RefreshCw, Trash2 } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { uploadImageToLsky } from '@/api/lsky'
import { findPlaceholderPos, type UploadState } from './extensions/imageUploadPlaceholder'

const props = defineProps<{
  node: { attrs: { uploadId: string } }
  editor: any
  deleteNode: () => void
}>()

const { t } = useI18n()

const uploads = computed(
  () => props.editor.storage.imageUploadPlaceholder.uploads as Map<string, UploadState>,
)

const state = computed(() => uploads.value.get(props.node.attrs.uploadId))

async function handleRetry() {
  const current = state.value
  if (!current || current.status !== 'error') return

  current.status = 'uploading'
  current.error = undefined

  try {
    const result = await uploadImageToLsky(current.file)
    const pos = findPlaceholderPos(props.editor, props.node.attrs.uploadId)
    if (pos !== null) {
      props.editor
        .chain()
        .deleteRange({ from: pos, to: pos + 1 })
        .insertContentAt(pos, { type: 'image', attrs: { src: result.fullUrl } })
        .run()
    }
    uploads.value.delete(props.node.attrs.uploadId)
  } catch (err) {
    const s = uploads.value.get(props.node.attrs.uploadId)
    if (s) {
      s.status = 'error'
      s.error = err instanceof Error ? err.message : t('editor.uploadError')
    }
  }
}

function handleRemove() {
  uploads.value.delete(props.node.attrs.uploadId)
  props.deleteNode()
}
</script>

<template>
  <NodeViewWrapper>
    <div
      class="image-upload-placeholder"
      :class="{ 'is-error': state?.status === 'error' }"
    >
      <template v-if="state?.status === 'uploading'">
        <Loader2 class="size-4 animate-spin text-primary shrink-0" />
        <span class="truncate">{{ state.fileName }}</span>
        <span class="text-muted-foreground/70">{{ t('editor.uploading') }}</span>
      </template>

      <template v-else-if="state?.status === 'error'">
        <AlertCircle class="size-4 text-destructive shrink-0" />
        <span class="truncate text-destructive">{{ state.error || t('editor.uploadError') }}</span>
        <div class="ml-auto flex items-center gap-1 shrink-0">
          <button
            type="button"
            class="h-6 px-2 inline-flex items-center gap-1 text-xs text-primary hover:bg-primary/10 transition-colors cursor-pointer"
            @click.stop="handleRetry"
          >
            <RefreshCw class="size-3" />
            {{ t('editor.retryUpload') }}
          </button>
          <button
            type="button"
            class="h-6 px-2 inline-flex items-center gap-1 text-xs text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
            @click.stop="handleRemove"
          >
            <Trash2 class="size-3" />
            {{ t('editor.removeUpload') }}
          </button>
        </div>
      </template>

      <template v-else>
        <AlertCircle class="size-4 text-muted-foreground shrink-0" />
        <span class="text-muted-foreground">{{ t('editor.uploadOrphan') }}</span>
        <button
          type="button"
          class="ml-auto h-6 px-2 inline-flex items-center gap-1 text-xs text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0"
          @click.stop="handleRemove"
        >
          <Trash2 class="size-3" />
          {{ t('editor.removeUpload') }}
        </button>
      </template>
    </div>
  </NodeViewWrapper>
</template>
