import { Node } from '@tiptap/core'
import type { Editor } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import { reactive } from 'vue'
import ImageUploadPlaceholderView from '../ImageUploadPlaceholderView.vue'

export interface UploadState {
  status: 'uploading' | 'error'
  fileName: string
  file: File
  error?: string
}

export const ImageUploadPlaceholder = Node.create({
  name: 'imageUploadPlaceholder',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      uploadId: { default: null },
    }
  },

  parseHTML() {
    return []
  },

  renderHTML() {
    return ['div', { class: 'image-upload-placeholder' }]
  },

  addStorage() {
    return {
      uploads: reactive(new Map<string, UploadState>()),
    }
  },

  addNodeView() {
    return VueNodeViewRenderer(ImageUploadPlaceholderView as any)
  },
})

export function findPlaceholderPos(editor: Editor, uploadId: string): number | null {
  let found: number | null = null
  editor.state.doc.descendants((node: any, pos: number) => {
    if (
      node.type.name === 'imageUploadPlaceholder' &&
      node.attrs.uploadId === uploadId
    ) {
      found = pos
      return false
    }
  })
  return found
}
