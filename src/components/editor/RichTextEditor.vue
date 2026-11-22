<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { EditorContent, Node, mergeAttributes, useEditor, Extension } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import {
  Bold,
  Check,
  Code,
  CodeXml,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
  Upload,
  X,
} from '@lucide/vue'
import { uploadImageToLsky } from '@/api/lsky'
import { sanitizePackageHtmlForStorage } from '@/utils/sanitize'
import {
  ImageUploadPlaceholder,
  findPlaceholderPos,
  type UploadState,
} from './extensions/imageUploadPlaceholder'
import LinkPopover from './LinkPopover.vue'
import LinkBubbleMenu from './LinkBubbleMenu.vue'
import ImageBubbleMenu from './ImageBubbleMenu.vue'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface Props {
  modelValue: string
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { t } = useI18n()

/**
 * 轻量内置 Image 节点（支持 img[src] 与兼容旧版 CKEditor 的 <figure class="image"><img></figure>）
 */
const SimpleImage = Node.create({
  name: 'image',
  group: 'block',
  draggable: true,
  atom: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'figure.image',
        getAttrs(dom) {
          const img = (dom as HTMLElement).querySelector('img')
          if (!img) return false
          return {
            src: img.getAttribute('src'),
            alt: img.getAttribute('alt'),
            title: img.getAttribute('title'),
          }
        },
      },
      { tag: 'img[src]' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes)]
  },
})

const isSourceMode = ref(false)
const sourceHtml = ref(props.modelValue)
const editorTick = ref(0)

const linkPopoverOpen = ref(false)
const imageUrlPopoverOpen = ref(false)
const imageUrlInput = ref('')
const imageAltInput = ref('')
const isImageUrlValid = computed(() => imageUrlInput.value.trim().startsWith('https://'))
const isDraggingOver = ref(false)

const fileInputRef = ref<HTMLInputElement | null>(null)

/**
 * Ctrl+K 快捷键扩展 — toggle 链接 Popover
 */
const LinkKeyboardShortcut = Extension.create({
  name: 'linkKeyboardShortcut',
  addKeyboardShortcuts() {
    return {
      'Mod-k': () => {
        linkPopoverOpen.value = !linkPopoverOpen.value
        return true
      },
    }
  },
})

const editor = useEditor({
  content: props.modelValue || '',
  editable: !props.disabled,
  extensions: [
    StarterKit.configure({
      link: {
        openOnClick: false,
      },
    }),
    SimpleImage,
    ImageUploadPlaceholder,
    LinkKeyboardShortcut,
  ],
  editorProps: {
    attributes: {
      class: 'prose prose-sm sm:prose-base max-w-none package-prose min-h-[340px] px-4 py-3',
    },
    handleDrop(view, event, _slice, moved) {
      if (moved) return false
      const files = Array.from(event.dataTransfer?.files ?? [])
      const images = files.filter((f) => f.type.startsWith('image/'))
      if (!images.length) return false

      event.preventDefault()
      const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
      let dropPos = coords?.pos
      for (const file of images) {
        startImageUpload(file, dropPos)
        if (dropPos != null) dropPos += 1
      }
      isDraggingOver.value = false
      return true
    },
    handlePaste(_view, event) {
      const items = Array.from(event.clipboardData?.items ?? [])
      const hasText = items.some(
        (item) => item.type === 'text/html' || item.type === 'text/plain',
      )
      const imageItems = items.filter((item) => item.type.startsWith('image/'))
      if (hasText || !imageItems.length) return false

      event.preventDefault()
      for (const item of imageItems) {
        const file = item.getAsFile()
        if (file) startImageUpload(file)
      }
      return true
    },
  },
  onSelectionUpdate() {
    editorTick.value++
  },
  onUpdate({ editor: instance }) {
    editorTick.value++
    const html = instance.getHTML()
    const normalized = html === '<p></p>' ? '' : html
    sourceHtml.value = normalized
    emit('update:modelValue', normalized)
  },
})

function isActive(name: string, options?: Record<string, unknown>): boolean {
  void editorTick.value
  return editor.value?.isActive(name, options) ?? false
}

/* ---------- upload state ---------- */

function getUploadsMap(): Map<string, UploadState> | undefined {
  return (editor.value?.storage as any)?.imageUploadPlaceholder?.uploads
}

const activeUploadCount = computed(() => {
  const uploads = getUploadsMap()
  if (!uploads) return 0
  let count = 0
  for (const s of uploads.values()) {
    if (s.status === 'uploading') count++
  }
  return count
})

const hasActiveUploads = computed(() => activeUploadCount.value > 0)

const hasPendingOrBrokenPlaceholders = computed(() => {
  void editorTick.value
  const doc = editor.value?.state.doc
  if (!doc) return false
  let found = false
  doc.descendants((node) => {
    if (found) return false
    if (node.type.name === 'imageUploadPlaceholder') {
      found = true
      return false
    }
  })
  return found
})

const bubbleMenuError = ref('')

defineExpose({ hasActiveUploads, hasPendingOrBrokenPlaceholders })

/* ---------- image upload core ---------- */

function startImageUpload(file: File, insertPos?: number) {
  const instance = editor.value
  if (!instance) return

  const uploadId = crypto.randomUUID()
  const uploads = (instance.storage as any).imageUploadPlaceholder.uploads as Map<string, UploadState>

  uploads.set(uploadId, { status: 'uploading', fileName: file.name, file })

  if (insertPos != null) {
    instance
      .chain()
      .insertContentAt(insertPos, {
        type: 'imageUploadPlaceholder',
        attrs: { uploadId },
      })
      .run()
  } else {
    instance
      .chain()
      .focus()
      .insertContent({
        type: 'imageUploadPlaceholder',
        attrs: { uploadId },
      })
      .run()
  }

  void (async () => {
    try {
      const result = await uploadImageToLsky(file)
      const pos = findPlaceholderPos(instance, uploadId)
      if (pos !== null) {
        instance
          .chain()
          .deleteRange({ from: pos, to: pos + 1 })
          .insertContentAt(pos, { type: 'image', attrs: { src: result.fullUrl } })
          .run()
      }
      uploads.delete(uploadId)
    } catch (err) {
      const state = uploads.get(uploadId)
      if (state) {
        state.status = 'error'
        state.error = err instanceof Error ? err.message : t('editor.uploadError')
      }
    }
  })()
}

/* ---------- toolbar upload button ---------- */

function triggerImageUpload() {
  fileInputRef.value?.click()
}

function handleImageFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  for (const file of files) {
    if (file.type.startsWith('image/')) {
      startImageUpload(file)
    }
  }
}

/* ---------- image URL popover ---------- */

function insertImageUrl() {
  const instance = editor.value
  const src = imageUrlInput.value.trim()
  if (!instance || !src || !src.startsWith('https://')) return
  const attrs: Record<string, string> = { src }
  const alt = imageAltInput.value.trim()
  if (alt) attrs.alt = alt
  instance.chain().focus().insertContent({ type: 'image', attrs }).run()
  imageUrlInput.value = ''
  imageAltInput.value = ''
  imageUrlPopoverOpen.value = false
}

/* ---------- source mode ---------- */

function toggleSourceMode() {
  const instance = editor.value
  if (!isSourceMode.value) {
    sourceHtml.value = instance
      ? instance.getHTML() === '<p></p>'
        ? ''
        : instance.getHTML()
      : props.modelValue
    linkPopoverOpen.value = false
    imageUrlPopoverOpen.value = false
    isSourceMode.value = true
  } else {
    const safeHtml = sanitizePackageHtmlForStorage(sourceHtml.value)
    sourceHtml.value = safeHtml
    instance?.commands.setContent(safeHtml || '', { emitUpdate: false })
    emit('update:modelValue', safeHtml)
    isSourceMode.value = false
  }
}

function handleSourceInput(e: Event) {
  const val = (e.target as HTMLTextAreaElement).value
  sourceHtml.value = val
  emit('update:modelValue', val)
}

/* ---------- link bubble → popover bridge ---------- */

function handleEditLinkFromBubble() {
  setTimeout(() => {
    linkPopoverOpen.value = true
  }, 0)
}

/* ---------- drag visual ---------- */

function handleDragOver(e: DragEvent) {
  if (e.dataTransfer?.types.includes('Files')) {
    isDraggingOver.value = true
  }
}

function handleDragLeave() {
  isDraggingOver.value = false
}

function handleDropOnRoot() {
  isDraggingOver.value = false
}

/* ---------- watchers ---------- */

watch(
  () => props.disabled,
  (nextDisabled) => {
    editor.value?.setEditable(!nextDisabled)
  },
)

watch(
  () => props.modelValue,
  (nextVal) => {
    if (isSourceMode.value) {
      if (nextVal !== sourceHtml.value) {
        sourceHtml.value = nextVal
      }
      return
    }
    const instance = editor.value
    if (!instance) return
    const current = instance.getHTML() === '<p></p>' ? '' : instance.getHTML()
    if (nextVal !== current) {
      instance.commands.setContent(nextVal || '', { emitUpdate: false })
      sourceHtml.value = nextVal
    }
  },
)

onBeforeUnmount(() => {
  editor.value?.destroy()
})
</script>

<template>
  <div
    class="border border-border bg-background transition-colors"
    :class="isDraggingOver ? 'border-primary bg-primary/5' : ''"
    @dragover.prevent="handleDragOver"
    @dragleave.prevent="handleDragLeave"
    @drop.prevent="handleDropOnRoot"
  >
    <!-- 吸顶工具栏 -->
    <div
      class="sticky top-12 z-20 bg-muted/85 backdrop-blur-xs border-b border-border px-2 py-1.5 flex flex-wrap items-center justify-between gap-1.5"
    >
      <div v-if="editor && !isSourceMode" class="flex flex-wrap items-center gap-0.5">
        <!-- 段落 & 标题 -->
        <button
          type="button"
          class="h-7 px-2 inline-flex items-center justify-center text-xs transition-colors cursor-pointer"
          :class="isActive('paragraph') ? 'bg-primary/12 text-primary font-semibold' : 'text-foreground/80 hover:bg-muted'"
          :title="t('editor.paragraph')"
          :disabled="disabled"
          @click="editor.chain().focus().setParagraph().run()"
        >
          <Pilcrow class="size-3.5" />
        </button>
        <button
          type="button"
          class="h-7 px-2 inline-flex items-center justify-center text-xs transition-colors cursor-pointer"
          :class="isActive('heading', { level: 2 }) ? 'bg-primary/12 text-primary font-semibold' : 'text-foreground/80 hover:bg-muted'"
          :title="t('editor.heading2')"
          :disabled="disabled"
          @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
        >
          <Heading2 class="size-3.5" />
        </button>
        <button
          type="button"
          class="h-7 px-2 inline-flex items-center justify-center text-xs transition-colors cursor-pointer"
          :class="isActive('heading', { level: 3 }) ? 'bg-primary/12 text-primary font-semibold' : 'text-foreground/80 hover:bg-muted'"
          :title="t('editor.heading3')"
          :disabled="disabled"
          @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
        >
          <Heading3 class="size-3.5" />
        </button>

        <span class="mx-1 h-4 w-px bg-border" aria-hidden="true" />

        <!-- 文字格式 -->
        <button
          type="button"
          class="h-7 w-7 inline-flex items-center justify-center transition-colors cursor-pointer"
          :class="isActive('bold') ? 'bg-primary/12 text-primary' : 'text-foreground/80 hover:bg-muted'"
          :title="t('editor.bold')"
          :disabled="disabled"
          @click="editor.chain().focus().toggleBold().run()"
        >
          <Bold class="size-3.5" />
        </button>
        <button
          type="button"
          class="h-7 w-7 inline-flex items-center justify-center transition-colors cursor-pointer"
          :class="isActive('italic') ? 'bg-primary/12 text-primary' : 'text-foreground/80 hover:bg-muted'"
          :title="t('editor.italic')"
          :disabled="disabled"
          @click="editor.chain().focus().toggleItalic().run()"
        >
          <Italic class="size-3.5" />
        </button>
        <button
          type="button"
          class="h-7 w-7 inline-flex items-center justify-center transition-colors cursor-pointer"
          :class="isActive('underline') ? 'bg-primary/12 text-primary' : 'text-foreground/80 hover:bg-muted'"
          :title="t('editor.underline')"
          :disabled="disabled"
          @click="editor.chain().focus().toggleUnderline().run()"
        >
          <Underline class="size-3.5" />
        </button>
        <button
          type="button"
          class="h-7 w-7 inline-flex items-center justify-center transition-colors cursor-pointer"
          :class="isActive('strike') ? 'bg-primary/12 text-primary' : 'text-foreground/80 hover:bg-muted'"
          :title="t('editor.strike')"
          :disabled="disabled"
          @click="editor.chain().focus().toggleStrike().run()"
        >
          <Strikethrough class="size-3.5" />
        </button>
        <button
          type="button"
          class="h-7 w-7 inline-flex items-center justify-center transition-colors cursor-pointer"
          :class="isActive('code') ? 'bg-primary/12 text-primary' : 'text-foreground/80 hover:bg-muted'"
          :title="t('editor.inlineCode')"
          :disabled="disabled"
          @click="editor.chain().focus().toggleCode().run()"
        >
          <Code class="size-3.5" />
        </button>

        <span class="mx-1 h-4 w-px bg-border" aria-hidden="true" />

        <!-- 列表 & 引用 -->
        <button
          type="button"
          class="h-7 w-7 inline-flex items-center justify-center transition-colors cursor-pointer"
          :class="isActive('bulletList') ? 'bg-primary/12 text-primary' : 'text-foreground/80 hover:bg-muted'"
          :title="t('editor.bulletList')"
          :disabled="disabled"
          @click="editor.chain().focus().toggleBulletList().run()"
        >
          <List class="size-3.5" />
        </button>
        <button
          type="button"
          class="h-7 w-7 inline-flex items-center justify-center transition-colors cursor-pointer"
          :class="isActive('orderedList') ? 'bg-primary/12 text-primary' : 'text-foreground/80 hover:bg-muted'"
          :title="t('editor.orderedList')"
          :disabled="disabled"
          @click="editor.chain().focus().toggleOrderedList().run()"
        >
          <ListOrdered class="size-3.5" />
        </button>
        <button
          type="button"
          class="h-7 w-7 inline-flex items-center justify-center transition-colors cursor-pointer"
          :class="isActive('blockquote') ? 'bg-primary/12 text-primary' : 'text-foreground/80 hover:bg-muted'"
          :title="t('editor.blockquote')"
          :disabled="disabled"
          @click="editor.chain().focus().toggleBlockquote().run()"
        >
          <Quote class="size-3.5" />
        </button>
        <button
          type="button"
          class="h-7 w-7 inline-flex items-center justify-center text-foreground/80 hover:bg-muted transition-colors cursor-pointer"
          :title="t('editor.horizontalRule')"
          :disabled="disabled"
          @click="editor.chain().focus().setHorizontalRule().run()"
        >
          <Minus class="size-3.5" />
        </button>

        <span class="mx-1 h-4 w-px bg-border" aria-hidden="true" />

        <!-- 链接 Popover -->
        <LinkPopover v-model:open="linkPopoverOpen" :editor="editor" :disabled="disabled">
          <button
            type="button"
            class="h-7 w-7 inline-flex items-center justify-center transition-colors cursor-pointer"
            :class="isActive('link') || linkPopoverOpen ? 'bg-primary/12 text-primary' : 'text-foreground/80 hover:bg-muted'"
            :title="t('editor.link')"
            :disabled="disabled"
          >
            <Link2 class="size-3.5" />
          </button>
        </LinkPopover>

        <!-- 上传图片按钮 -->
        <button
          type="button"
          class="h-7 px-2 inline-flex items-center gap-1 text-xs text-foreground/80 hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
          :title="t('editor.uploadImage')"
          :disabled="disabled"
          @click="triggerImageUpload"
        >
          <Loader2 v-if="hasActiveUploads" class="size-3.5 animate-spin text-primary" />
          <Upload v-else class="size-3.5" />
          <span class="hidden sm:inline">
            {{ hasActiveUploads ? t('editor.uploading_count', { count: activeUploadCount }) : t('editor.uploadImageShort') }}
          </span>
        </button>

        <!-- 图片 URL Popover -->
        <Popover v-model:open="imageUrlPopoverOpen">
          <PopoverTrigger as-child>
            <button
              type="button"
              class="h-7 w-7 inline-flex items-center justify-center transition-colors cursor-pointer"
              :class="imageUrlPopoverOpen ? 'bg-primary/12 text-primary' : 'text-foreground/80 hover:bg-muted'"
              :title="t('editor.insertImageUrl')"
              :disabled="disabled"
            >
              <ImagePlus class="size-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="start"
            :collision-padding="8"
            class="w-80 p-3 rounded-none"
            @keydown.escape.prevent="imageUrlPopoverOpen = false; editor.commands.focus()"
          >
            <div class="space-y-2">
              <div class="space-y-1">
                <label class="text-[11px] font-medium text-muted-foreground">URL</label>
                <input
                  v-model="imageUrlInput"
                  type="url"
                  :placeholder="t('editor.imageUrlPlaceholder')"
                  class="w-full h-7 px-2 text-xs bg-background border border-input focus:border-primary focus:outline-none"
                  :class="imageUrlInput.trim() && !isImageUrlValid ? 'border-destructive' : ''"
                  @keydown.enter.prevent="insertImageUrl"
                />
                <p
                  v-if="imageUrlInput.trim() && !isImageUrlValid"
                  class="text-[11px] text-destructive"
                >
                  {{ t('editor.urlMustHttps') }}
                </p>
              </div>
              <div class="space-y-1">
                <label class="text-[11px] font-medium text-muted-foreground">
                  {{ t('editor.imageAlt') }}
                </label>
                <input
                  v-model="imageAltInput"
                  type="text"
                  :placeholder="t('editor.imageAlt')"
                  class="w-full h-7 px-2 text-xs bg-background border border-input focus:border-primary focus:outline-none"
                  @keydown.enter.prevent="insertImageUrl"
                />
              </div>
              <div class="flex items-center gap-1.5 pt-1">
                <button
                  type="button"
                  class="h-7 px-2.5 inline-flex items-center gap-1 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
                  :disabled="!isImageUrlValid"
                  @click="insertImageUrl"
                >
                  <Check class="size-3" />
                  {{ t('editor.insert') }}
                </button>
                <button
                  type="button"
                  class="h-7 w-7 ml-auto inline-flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                  @click="imageUrlPopoverOpen = false; editor.commands.focus()"
                >
                  <X class="size-3.5" />
                </button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <span class="mx-1 h-4 w-px bg-border" aria-hidden="true" />

        <!-- Undo / Redo -->
        <button
          type="button"
          class="h-7 w-7 inline-flex items-center justify-center text-foreground/80 hover:bg-muted transition-colors cursor-pointer disabled:opacity-35"
          :title="t('editor.undo')"
          :disabled="disabled || !editor.can().undo()"
          @click="editor.chain().focus().undo().run()"
        >
          <Undo2 class="size-3.5" />
        </button>
        <button
          type="button"
          class="h-7 w-7 inline-flex items-center justify-center text-foreground/80 hover:bg-muted transition-colors cursor-pointer disabled:opacity-35"
          :title="t('editor.redo')"
          :disabled="disabled || !editor.can().redo()"
          @click="editor.chain().focus().redo().run()"
        >
          <Redo2 class="size-3.5" />
        </button>
      </div>

      <div v-else class="text-xs font-mono text-muted-foreground px-1">
        {{ t('editor.htmlSourceLabel') }}
      </div>

      <!-- 源码切换 -->
      <button
        type="button"
        class="h-7 px-2 inline-flex items-center gap-1.5 text-xs border transition-colors cursor-pointer shrink-0"
        :class="
          isSourceMode
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-background text-foreground/85 border-border hover:bg-muted'
        "
        :disabled="disabled || hasActiveUploads"
        :title="hasActiveUploads ? t('editor.waitForUpload') : t('editor.sourceToggle')"
        @click="toggleSourceMode"
      >
        <CodeXml class="size-3.5" />
        <span>{{ t('editor.sourceToggle') }}</span>
      </button>
    </div>

    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      multiple
      class="hidden"
      @change="handleImageFileSelected"
    />

    <!-- 错误提示 -->
    <div
      v-if="bubbleMenuError"
      class="flex items-center gap-2 px-3 py-1.5 bg-destructive/10 text-destructive text-xs border-b"
    >
      <span class="flex-1">{{ bubbleMenuError }}</span>
      <button type="button" class="shrink-0 hover:opacity-70" @click="bubbleMenuError = ''">
        <X class="size-3" />
      </button>
    </div>

    <!-- 编辑主体 -->
    <textarea
      v-if="isSourceMode"
      :value="sourceHtml"
      :disabled="disabled"
      spellcheck="false"
      class="w-full min-h-[340px] p-4 font-mono text-xs leading-relaxed bg-background text-foreground focus:outline-none resize-y block"
      @input="handleSourceInput"
    />
    <template v-else-if="editor">
      <EditorContent :editor="editor" />
      <LinkBubbleMenu
        :editor="editor"
        :editor-tick="editorTick"
        :link-popover-open="linkPopoverOpen"
        @edit-link="handleEditLinkFromBubble"
      />
      <ImageBubbleMenu :editor="editor" @error="(msg: string) => { bubbleMenuError = msg }" />
    </template>
  </div>
</template>
