<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { EditorContent, Node, mergeAttributes, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import {
  Bold,
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
  Unlink,
  Upload,
} from '@lucide/vue'
import { uploadImageToLsky } from '@/api/lsky'
import { sanitizePackageHtml } from '@/utils/sanitize'
import { Button } from '@/components/ui/button'

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
 * 轻量内置 Image 节点（支持 img[src] 与兼容旧版 CKEditor 生成的 <figure class="image"><img ...></figure>）
 */
const SimpleImage = Node.create({
  name: 'image',
  group: 'block',
  draggable: true,
  atom: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
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
      {
        tag: 'img[src]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes)]
  },
})

const isSourceMode = ref(false)
const sourceHtml = ref(props.modelValue)
const isUploadingImage = ref(false)
const uploadError = ref('')

const showLinkBar = ref(false)
const linkUrlInput = ref('')

const showImageUrlBar = ref(false)
const imageUrlInput = ref('')

const fileInputRef = ref<HTMLInputElement | null>(null)

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
  ],
  editorProps: {
    attributes: {
      class: 'prose prose-sm sm:prose-base max-w-none package-prose min-h-[340px] px-4 py-3',
    },
  },
  onUpdate({ editor: instance }) {
    const html = instance.getHTML()
    const normalized = html === '<p></p>' ? '' : html
    sourceHtml.value = normalized
    emit('update:modelValue', normalized)
  },
})

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

function toggleSourceMode() {
  const instance = editor.value
  if (!isSourceMode.value) {
    sourceHtml.value = instance
      ? instance.getHTML() === '<p></p>'
        ? ''
        : instance.getHTML()
      : props.modelValue
    showLinkBar.value = false
    showImageUrlBar.value = false
    isSourceMode.value = true
  } else {
    const safeHtml = sanitizePackageHtml(sourceHtml.value)
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

function openLinkBar() {
  const instance = editor.value
  if (!instance) return
  showImageUrlBar.value = false
  const prevHref = (instance.getAttributes('link').href as string | undefined) ?? ''
  linkUrlInput.value = prevHref
  showLinkBar.value = !showLinkBar.value
}

function applyLink() {
  const instance = editor.value
  if (!instance) return
  const href = linkUrlInput.value.trim()
  if (!href) {
    instance.chain().focus().extendMarkRange('link').unsetLink().run()
  } else {
    instance.chain().focus().extendMarkRange('link').setLink({ href }).run()
  }
  showLinkBar.value = false
}

function removeLink() {
  editor.value?.chain().focus().extendMarkRange('link').unsetLink().run()
  showLinkBar.value = false
}

function insertImageUrl() {
  const instance = editor.value
  const src = imageUrlInput.value.trim()
  if (!instance || !src) return
  instance
    .chain()
    .focus()
    .insertContent({ type: 'image', attrs: { src } })
    .run()
  imageUrlInput.value = ''
  showImageUrlBar.value = false
}

function triggerImageUpload() {
  uploadError.value = ''
  fileInputRef.value?.click()
}

async function handleImageFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !editor.value) return

  isUploadingImage.value = true
  uploadError.value = ''
  try {
    const result = await uploadImageToLsky(file)
    editor.value
      .chain()
      .focus()
      .insertContent({ type: 'image', attrs: { src: result.fullUrl } })
      .run()
  } catch (err) {
    uploadError.value = err instanceof Error ? err.message : t('editor.uploadError')
  } finally {
    isUploadingImage.value = false
  }
}
</script>

<template>
  <div class="border border-border bg-background">
    <!-- 吸顶工具栏 -->
    <div
      class="sticky top-12 z-20 bg-muted/85 backdrop-blur-xs border-b border-border px-2 py-1.5 flex flex-wrap items-center justify-between gap-1.5"
    >
      <div v-if="editor && !isSourceMode" class="flex flex-wrap items-center gap-0.5">
        <button
          type="button"
          class="h-7 px-2 inline-flex items-center justify-center text-xs transition-colors cursor-pointer"
          :class="editor.isActive('paragraph') ? 'bg-primary/12 text-primary font-semibold' : 'text-foreground/80 hover:bg-muted'"
          :title="t('editor.paragraph')"
          :disabled="disabled"
          @click="editor.chain().focus().setParagraph().run()"
        >
          <Pilcrow class="size-3.5" />
        </button>
        <button
          type="button"
          class="h-7 px-2 inline-flex items-center justify-center text-xs transition-colors cursor-pointer"
          :class="editor.isActive('heading', { level: 2 }) ? 'bg-primary/12 text-primary font-semibold' : 'text-foreground/80 hover:bg-muted'"
          :title="t('editor.heading2')"
          :disabled="disabled"
          @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
        >
          <Heading2 class="size-3.5" />
        </button>
        <button
          type="button"
          class="h-7 px-2 inline-flex items-center justify-center text-xs transition-colors cursor-pointer"
          :class="editor.isActive('heading', { level: 3 }) ? 'bg-primary/12 text-primary font-semibold' : 'text-foreground/80 hover:bg-muted'"
          :title="t('editor.heading3')"
          :disabled="disabled"
          @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
        >
          <Heading3 class="size-3.5" />
        </button>

        <span class="mx-1 h-4 w-px bg-border" aria-hidden="true" />

        <button
          type="button"
          class="h-7 w-7 inline-flex items-center justify-center transition-colors cursor-pointer"
          :class="editor.isActive('bold') ? 'bg-primary/12 text-primary' : 'text-foreground/80 hover:bg-muted'"
          :title="t('editor.bold')"
          :disabled="disabled"
          @click="editor.chain().focus().toggleBold().run()"
        >
          <Bold class="size-3.5" />
        </button>
        <button
          type="button"
          class="h-7 w-7 inline-flex items-center justify-center transition-colors cursor-pointer"
          :class="editor.isActive('italic') ? 'bg-primary/12 text-primary' : 'text-foreground/80 hover:bg-muted'"
          :title="t('editor.italic')"
          :disabled="disabled"
          @click="editor.chain().focus().toggleItalic().run()"
        >
          <Italic class="size-3.5" />
        </button>
        <button
          type="button"
          class="h-7 w-7 inline-flex items-center justify-center transition-colors cursor-pointer"
          :class="editor.isActive('underline') ? 'bg-primary/12 text-primary' : 'text-foreground/80 hover:bg-muted'"
          :title="t('editor.underline')"
          :disabled="disabled"
          @click="editor.chain().focus().toggleUnderline().run()"
        >
          <Underline class="size-3.5" />
        </button>
        <button
          type="button"
          class="h-7 w-7 inline-flex items-center justify-center transition-colors cursor-pointer"
          :class="editor.isActive('strike') ? 'bg-primary/12 text-primary' : 'text-foreground/80 hover:bg-muted'"
          :title="t('editor.strike')"
          :disabled="disabled"
          @click="editor.chain().focus().toggleStrike().run()"
        >
          <Strikethrough class="size-3.5" />
        </button>
        <button
          type="button"
          class="h-7 w-7 inline-flex items-center justify-center transition-colors cursor-pointer"
          :class="editor.isActive('code') ? 'bg-primary/12 text-primary' : 'text-foreground/80 hover:bg-muted'"
          :title="t('editor.inlineCode')"
          :disabled="disabled"
          @click="editor.chain().focus().toggleCode().run()"
        >
          <Code class="size-3.5" />
        </button>

        <span class="mx-1 h-4 w-px bg-border" aria-hidden="true" />

        <button
          type="button"
          class="h-7 w-7 inline-flex items-center justify-center transition-colors cursor-pointer"
          :class="editor.isActive('bulletList') ? 'bg-primary/12 text-primary' : 'text-foreground/80 hover:bg-muted'"
          :title="t('editor.bulletList')"
          :disabled="disabled"
          @click="editor.chain().focus().toggleBulletList().run()"
        >
          <List class="size-3.5" />
        </button>
        <button
          type="button"
          class="h-7 w-7 inline-flex items-center justify-center transition-colors cursor-pointer"
          :class="editor.isActive('orderedList') ? 'bg-primary/12 text-primary' : 'text-foreground/80 hover:bg-muted'"
          :title="t('editor.orderedList')"
          :disabled="disabled"
          @click="editor.chain().focus().toggleOrderedList().run()"
        >
          <ListOrdered class="size-3.5" />
        </button>
        <button
          type="button"
          class="h-7 w-7 inline-flex items-center justify-center transition-colors cursor-pointer"
          :class="editor.isActive('blockquote') ? 'bg-primary/12 text-primary' : 'text-foreground/80 hover:bg-muted'"
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

        <button
          type="button"
          class="h-7 w-7 inline-flex items-center justify-center transition-colors cursor-pointer"
          :class="editor.isActive('link') || showLinkBar ? 'bg-primary/12 text-primary' : 'text-foreground/80 hover:bg-muted'"
          :title="t('editor.link')"
          :disabled="disabled"
          @click="openLinkBar"
        >
          <Link2 class="size-3.5" />
        </button>

        <button
          type="button"
          class="h-7 px-2 inline-flex items-center gap-1 text-xs text-foreground/80 hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
          :title="t('editor.uploadImage')"
          :disabled="disabled || isUploadingImage"
          @click="triggerImageUpload"
        >
          <Loader2 v-if="isUploadingImage" class="size-3.5 animate-spin text-primary" />
          <Upload v-else class="size-3.5" />
          <span class="hidden sm:inline">{{ t('editor.uploadImageShort') }}</span>
        </button>

        <button
          type="button"
          class="h-7 w-7 inline-flex items-center justify-center transition-colors cursor-pointer"
          :class="showImageUrlBar ? 'bg-primary/12 text-primary' : 'text-foreground/80 hover:bg-muted'"
          :title="t('editor.insertImageUrl')"
          :disabled="disabled"
          @click="() => { showLinkBar = false; showImageUrlBar = !showImageUrlBar }"
        >
          <ImagePlus class="size-3.5" />
        </button>

        <span class="mx-1 h-4 w-px bg-border" aria-hidden="true" />

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

      <button
        type="button"
        class="h-7 px-2 inline-flex items-center gap-1.5 text-xs border transition-colors cursor-pointer shrink-0"
        :class="
          isSourceMode
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-background text-foreground/85 border-border hover:bg-muted'
        "
        :disabled="disabled"
        @click="toggleSourceMode"
      >
        <CodeXml class="size-3.5" />
        <span>{{ t('editor.sourceToggle') }}</span>
      </button>
    </div>

    <!-- 链接内联输入条 -->
    <div
      v-if="showLinkBar && !isSourceMode"
      class="px-3 py-2 bg-muted/35 border-b border-border flex flex-wrap items-center gap-2 text-xs"
    >
      <input
        v-model="linkUrlInput"
        type="url"
        placeholder="https://..."
        class="flex-1 min-w-[200px] h-7 px-2 bg-background border border-input focus:border-primary focus:outline-none text-xs"
        @keydown.enter.prevent="applyLink"
      />
      <Button type="button" size="xs" class="rounded-none cursor-pointer" @click="applyLink">
        {{ t('editor.apply') }}
      </Button>
      <Button
        v-if="editor?.isActive('link')"
        type="button"
        variant="outline"
        size="xs"
        class="rounded-none cursor-pointer"
        @click="removeLink"
      >
        <Unlink class="size-3" />
        <span>{{ t('editor.unlink') }}</span>
      </Button>
    </div>

    <!-- 已有图片 URL 插入条 -->
    <div
      v-if="showImageUrlBar && !isSourceMode"
      class="px-3 py-2 bg-muted/35 border-b border-border flex flex-wrap items-center gap-2 text-xs"
    >
      <input
        v-model="imageUrlInput"
        type="url"
        :placeholder="t('editor.imageUrlPlaceholder')"
        class="flex-1 min-w-[200px] h-7 px-2 bg-background border border-input focus:border-primary focus:outline-none text-xs"
        @keydown.enter.prevent="insertImageUrl"
      />
      <Button type="button" size="xs" class="rounded-none cursor-pointer" @click="insertImageUrl">
        {{ t('editor.insert') }}
      </Button>
    </div>

    <!-- 图片上传错误提示 -->
    <div
      v-if="uploadError"
      role="alert"
      class="px-3 py-1.5 bg-destructive/10 border-b border-destructive/25 text-xs text-destructive"
    >
      {{ uploadError }}
    </div>

    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      class="hidden"
      @change="handleImageFileSelected"
    />

    <!-- 编辑主体 -->
    <textarea
      v-if="isSourceMode"
      :value="sourceHtml"
      :disabled="disabled"
      spellcheck="false"
      class="w-full min-h-[340px] p-4 font-mono text-xs leading-relaxed bg-background text-foreground focus:outline-none resize-y block"
      @input="handleSourceInput"
    />
    <EditorContent v-else :editor="editor" />
  </div>
</template>
