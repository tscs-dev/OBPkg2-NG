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

  // 记录当前选中图片的位置，上传期间选区可能移动
  const { from } = props.editor.state.selection

  isReplacing.value = true
  try {
    const result = await uploadImageToLsky(file)
    // 写回原位置的图片节点，而非当时的选区
    const node = props.editor.state.doc.nodeAt(from)
    if (node?.type.name === 'image') {
      props.editor.chain().setNodeSelection(from).updateAttributes('image', { src: result.fullUrl }).run()
    } else {
      // 回退：如果原位置不再是图片，尝试当前选区
      props.editor.chain().focus().updateAttributes('image', { src: result.fullUrl }).run()
    }
  } catch {
    // 替换失败，图片保持原样
  } finally {
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
