<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import { ExternalLink, Pencil, Unlink } from '@lucide/vue'
import type { Editor } from '@tiptap/vue-3'

const props = defineProps<{
  editor: Editor
  editorTick: number
  linkPopoverOpen: boolean
}>()

const emit = defineEmits<{
  editLink: []
}>()

const { t } = useI18n()

const linkHref = computed(() => {
  void props.editorTick
  return (props.editor.getAttributes('link').href as string) ?? ''
})

const truncatedUrl = computed(() => {
  const url = linkHref.value
  if (url.length > 40) return `${url.slice(0, 37)}...`
  return url
})

function shouldShow({ editor: e }: any) {
  if (props.linkPopoverOpen) return false
  if (e.isActive('image')) return false
  return e.isActive('link')
}

function openLink() {
  const href = props.editor.getAttributes('link').href as string
  if (href) {
    window.open(href, '_blank', 'noopener')
  }
}

function handleEdit() {
  props.editor.chain().focus().extendMarkRange('link').run()
  emit('editLink')
}

function handleRemove() {
  props.editor.chain().focus().extendMarkRange('link').unsetLink().run()
}
</script>

<template>
  <BubbleMenu
    :editor="editor"
    :tippy-options="{ duration: 150, placement: 'bottom-start' }"
    :should-show="shouldShow"
  >
    <div
      class="flex items-center gap-0.5 bg-popover border border-border shadow-md px-1.5 py-1 text-xs"
    >
      <a
        :href="linkHref"
        target="_blank"
        rel="noopener"
        class="max-w-[200px] truncate px-1.5 py-0.5 text-primary hover:underline underline-offset-2 cursor-pointer"
        :title="linkHref"
        @click.prevent="openLink"
      >
        {{ truncatedUrl }}
      </a>

      <span class="h-4 w-px bg-border mx-0.5" aria-hidden="true" />

      <button
        type="button"
        class="h-6 w-6 inline-flex items-center justify-center text-foreground/80 hover:bg-muted transition-colors cursor-pointer"
        :title="t('editor.editLink')"
        @click="handleEdit"
      >
        <Pencil class="size-3" />
      </button>

      <button
        type="button"
        class="h-6 w-6 inline-flex items-center justify-center text-foreground/80 hover:bg-muted transition-colors cursor-pointer"
        :title="t('editor.openInNewTab')"
        @click="openLink"
      >
        <ExternalLink class="size-3" />
      </button>

      <button
        type="button"
        class="h-6 w-6 inline-flex items-center justify-center text-destructive/80 hover:bg-destructive/10 transition-colors cursor-pointer"
        :title="t('editor.removeLink')"
        @click="handleRemove"
      >
        <Unlink class="size-3" />
      </button>
    </div>
  </BubbleMenu>
</template>
