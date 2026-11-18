<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Unlink, X } from '@lucide/vue'
import type { Editor } from '@tiptap/vue-3'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const props = defineProps<{
  editor: Editor
  disabled?: boolean
}>()

const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()

const linkTextInput = ref('')
const linkUrlInput = ref('')
const savedSelection = ref<{ from: number; to: number; empty: boolean } | null>(null)
const urlInputRef = ref<HTMLInputElement | null>(null)
const textInputRef = ref<HTMLInputElement | null>(null)

type LinkMode = 'insert' | 'set' | 'edit'

const mode = computed<LinkMode>(() => {
  if (!savedSelection.value) return 'insert'
  const sel = savedSelection.value
  const isCollapsed = sel.empty
  const isInLink = !!props.editor.getAttributes('link').href
  if (isInLink) return 'edit'
  if (isCollapsed) return 'insert'
  return 'set'
})

const isUrlValid = computed(() => {
  const url = linkUrlInput.value.trim()
  return url.startsWith('https://')
})

const canApply = computed(() => {
  if (!isUrlValid.value) return false
  if (mode.value === 'insert') {
    return !!linkTextInput.value.trim()
  }
  return true
})

watch(open, (isOpen) => {
  if (isOpen) {
    savedSelection.value = props.editor.state.selection
    const prevHref = (props.editor.getAttributes('link').href as string | undefined) ?? ''
    linkUrlInput.value = prevHref

    if (mode.value === 'insert') {
      linkTextInput.value = ''
    }

    nextTick(() => {
      if (mode.value === 'insert') {
        textInputRef.value?.focus()
      } else {
        urlInputRef.value?.focus()
      }
    })
  }
})

function applyLink() {
  if (!canApply.value) return
  const href = linkUrlInput.value.trim()
  const sel = savedSelection.value

  if (mode.value === 'insert') {
    const text = linkTextInput.value.trim()
    props.editor
      .chain()
      .focus()
      .insertContent({
        type: 'text',
        text,
        marks: [{ type: 'link', attrs: { href } }],
      })
      .run()
  } else if (mode.value === 'set') {
    if (sel) {
      props.editor.chain().focus().setTextSelection(sel).setLink({ href }).run()
    } else {
      props.editor.chain().focus().setLink({ href }).run()
    }
  } else {
    if (sel) {
      props.editor
        .chain()
        .focus()
        .setTextSelection(sel)
        .extendMarkRange('link')
        .setLink({ href })
        .run()
    } else {
      props.editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    }
  }

  open.value = false
}

function removeLink() {
  const sel = savedSelection.value
  if (sel) {
    props.editor
      .chain()
      .focus()
      .setTextSelection(sel)
      .extendMarkRange('link')
      .unsetLink()
      .run()
  } else {
    props.editor.chain().focus().extendMarkRange('link').unsetLink().run()
  }
  open.value = false
}

function handleClose() {
  open.value = false
  props.editor.commands.focus()
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    handleClose()
  }
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <slot />
    </PopoverTrigger>
    <PopoverContent
      side="bottom"
      align="start"
      :collision-padding="8"
      class="w-80 p-3 rounded-none"
      @keydown="handleKeydown"
    >
      <div class="space-y-2">
        <!-- Insert mode: link text field -->
        <div v-if="mode === 'insert'" class="space-y-1">
          <label class="text-[11px] font-medium text-muted-foreground">
            {{ t('editor.linkText') }}
          </label>
          <input
            ref="textInputRef"
            v-model="linkTextInput"
            type="text"
            class="w-full h-7 px-2 text-xs bg-background border border-input focus:border-primary focus:outline-none"
            :placeholder="t('editor.linkText')"
            @keydown.enter.prevent="urlInputRef?.focus()"
          />
        </div>

        <!-- URL field (all modes) -->
        <div class="space-y-1">
          <label class="text-[11px] font-medium text-muted-foreground">
            {{ t('editor.linkUrl') }}
          </label>
          <input
            ref="urlInputRef"
            v-model="linkUrlInput"
            type="url"
            class="w-full h-7 px-2 text-xs bg-background border border-input focus:border-primary focus:outline-none"
            :class="linkUrlInput.trim() && !isUrlValid ? 'border-destructive' : ''"
            placeholder="https://..."
            @keydown.enter.prevent="applyLink"
          />
          <p
            v-if="linkUrlInput.trim() && !isUrlValid"
            class="text-[11px] text-destructive"
          >
            {{ t('editor.urlMustHttps') }}
          </p>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-1.5 pt-1">
          <button
            type="button"
            class="h-7 px-2.5 inline-flex items-center gap-1 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
            :disabled="!canApply"
            @click="applyLink"
          >
            <Check class="size-3" />
            {{ t('editor.apply') }}
          </button>

          <button
            v-if="mode === 'edit'"
            type="button"
            class="h-7 px-2.5 inline-flex items-center gap-1 text-xs text-destructive hover:bg-destructive/10 border border-destructive/40 transition-colors cursor-pointer"
            @click="removeLink"
          >
            <Unlink class="size-3" />
            {{ t('editor.removeLink') }}
          </button>

          <button
            type="button"
            class="h-7 w-7 ml-auto inline-flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
            :title="t('common.cancel')"
            @click="handleClose"
          >
            <X class="size-3.5" />
          </button>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
