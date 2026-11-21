<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import { Loader2, RefreshCw, Trash2 } from '@lucide/vue'
import type { Editor } from '@tiptap/vue-3'
import { uploadImageToLsky } from '@/api/lsky'

const props = defineProps<{
  editor: Editor
}>()

const emit = defineEmits<{
  error: [message: string]
}>()

const { t } = useI18n()

const fileInputRef = ref<HTMLInputElement | null>(null)
const isReplacing = ref(false)

function shouldShow({ editor: e }: any) {
  return e.isActive('image')
}

function handleReplace() {
  fileInputRef.value?.click()
}

async function handleFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !file.type.startsWith('image/')) return

  const originalNode = props.editor.state.doc.nodeAt(props.editor.state.selection.from)
  if (!originalNode || originalNode.type.name !== 'image') return

  let trackedPos = props.editor.state.selection.from
  const onTransaction = ({ transaction: tr }: { transaction: any }) => {
    trackedPos = tr.mapping.map(trackedPos, 1)
  }
  props.editor.on('transaction', onTransaction)

  isReplacing.value = true
  try {
    const result = await uploadImageToLsky(file)
    const currentNode = props.editor.state.doc.nodeAt(trackedPos)
    if (currentNode === originalNode) {
      props.editor.chain().setNodeSelection(trackedPos).updateAttributes('image', { src: result.fullUrl }).run()
    } else {
      emit('error', t('editor.replaceTargetLost'))
    }
  } catch (err) {
    emit('error', err instanceof Error ? err.message : t('editor.uploadError'))
  } finally {
    props.editor.off('transaction', onTransaction)
    isReplacing.value = false
  }
}

function handleDelete() {
  props.editor.chain().focus().deleteSelection().run()
}
</script>

<template>
  <BubbleMenu
    :editor="editor"
    :tippy-options="{ duration: 150, placement: 'top' }"
    :should-show="shouldShow"
  >
    <div
      class="flex items-center gap-0.5 bg-popover border border-border shadow-md px-1.5 py-1 text-xs"
    >
      <button
        type="button"
        class="h-6 px-2 inline-flex items-center gap-1 text-foreground/80 hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
        :title="t('editor.replaceImage')"
        :disabled="isReplacing"
        @click="handleReplace"
      >
        <Loader2 v-if="isReplacing" class="size-3 animate-spin" />
        <RefreshCw v-else class="size-3" />
        <span>{{ t('editor.replaceImage') }}</span>
      </button>

      <span class="h-4 w-px bg-border" aria-hidden="true" />

      <button
        type="button"
        class="h-6 px-2 inline-flex items-center gap-1 text-destructive/80 hover:bg-destructive/10 transition-colors cursor-pointer"
        :title="t('editor.deleteImage')"
        @click="handleDelete"
      >
        <Trash2 class="size-3" />
        <span>{{ t('editor.deleteImage') }}</span>
      </button>
    </div>

    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      class="hidden"
      @change="handleFileSelected"
    />
  </BubbleMenu>
</template>
