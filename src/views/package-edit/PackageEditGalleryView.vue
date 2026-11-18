<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Save,
  Trash2,
  Upload,
  ZoomIn,
} from '@lucide/vue'
import FormPanel from '@/components/form/FormPanel.vue'
import PackageThumbnail from '@/components/package/PackageThumbnail.vue'
import { usePackageCacheActions, usePackageDetailQuery } from '@/queries/packages'
import { uploadImageToLsky } from '@/api/lsky'
import { updatePackage } from '@/api/packages'
import { formatApiErrorMessage } from '@/api/auth'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const route = useRoute()
const { t, te } = useI18n()
const { invalidatePackage, invalidatePackageLists } = usePackageCacheActions()

const packageId = computed<number | null>(() => {
  const raw = String(route.params.id ?? '')
  const num = Number.parseInt(raw, 10)
  return Number.isInteger(num) && num > 0 ? num : null
})

const packageQuery = usePackageDetailQuery(packageId)

const thumbnail = ref('')
const thumbnailLq = ref('')
const isUploading = ref(false)
const isSaving = ref(false)
const errorMsg = ref('')
const saveSuccess = ref(false)
const isDragging = ref(false)
const lightboxOpen = ref(false)

const fileInputRef = ref<HTMLInputElement | null>(null)

watch(
  () => packageQuery.data.value,
  (data) => {
    if (!data) return
    thumbnail.value = data.Thumbnail ?? ''
    thumbnailLq.value = data.ThumbnailLQ ?? ''
    errorMsg.value = ''
    saveSuccess.value = false
  },
  { immediate: true },
)

const hasCover = computed(() => Boolean(thumbnail.value.trim()))

async function processFileUpload(file: File) {
  if (!file.type.startsWith('image/')) {
    errorMsg.value = t('packageEdit.gallery.invalidImageType')
    return
  }
  isUploading.value = true
  errorMsg.value = ''
  saveSuccess.value = false
  try {
    const result = await uploadImageToLsky(file)
    thumbnail.value = result.fullUrl
    thumbnailLq.value = result.thumbUrl
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : t('editor.uploadError')
  } finally {
    isUploading.value = false
  }
}

function handleFileInputChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) {
    void processFileUpload(file)
  }
}

function handleDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) {
    void processFileUpload(file)
  }
}

function handleRemoveCover() {
  thumbnail.value = ''
  thumbnailLq.value = ''
  saveSuccess.value = false
  errorMsg.value = ''
}

async function handleSave() {
  if (!packageId.value || isSaving.value || isUploading.value) return
  isSaving.value = true
  errorMsg.value = ''
  saveSuccess.value = false

  try {
    await updatePackage(packageId.value, {
      Thumbnail: thumbnail.value.trim(),
      ThumbnailLQ: thumbnail.value.trim() ? thumbnailLq.value.trim() : '',
    })
    await invalidatePackage(packageId.value)
    await invalidatePackageLists()
    saveSuccess.value = true
  } catch (err) {
    errorMsg.value = formatApiErrorMessage(err, t, te)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="handleSave">
    <FormPanel :title="t('packageEdit.gallery.panelTitle')">
      <div class="p-4 flex flex-col sm:flex-row items-start gap-5">
        <!-- 预览窗 -->
        <div
          class="relative w-[240px] h-[150px] shrink-0 border transition-colors"
          :class="
            isDragging
              ? 'border-primary bg-primary/8'
              : 'border-border bg-muted/25'
          "
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="handleDrop"
        >
          <button
            v-if="hasCover"
            type="button"
            class="group relative size-full cursor-zoom-in block focus-visible:outline-2 focus-visible:outline-ring"
            :title="t('detail.zoomImage')"
            @click="lightboxOpen = true"
          >
            <PackageThumbnail
              :thumbnail="thumbnail"
              :thumbnail-lq="thumbnailLq"
              :prefer-high-res="true"
              alt="Banner"
              class="size-full ring-0"
            />
            <span
              class="absolute bottom-1.5 right-1.5 p-1 bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ZoomIn class="size-3.5" />
            </span>
          </button>

          <button
            v-else
            type="button"
            class="size-full flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer px-3 text-center"
            :disabled="isUploading"
            @click="fileInputRef?.click()"
          >
            <Loader2 v-if="isUploading" class="size-5 animate-spin text-primary" />
            <Upload v-else class="size-5 text-muted-foreground/70" />
            <span>{{ t('packageEdit.gallery.dropOrClick') }}</span>
          </button>
        </div>

        <!-- 右侧上传操作区 -->
        <div class="space-y-3 min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              class="rounded-none cursor-pointer"
              :disabled="isUploading || isSaving"
              @click="fileInputRef?.click()"
            >
              <Loader2 v-if="isUploading" class="size-3.5 animate-spin" />
              <Upload v-else class="size-3.5" />
              <span>
                {{
                  isUploading
                    ? t('packageEdit.gallery.uploading')
                    : hasCover
                      ? t('packageEdit.gallery.replaceButton')
                      : t('packageEdit.gallery.uploadButton')
                }}
              </span>
            </Button>

            <Button
              v-if="hasCover"
              type="button"
              variant="outline"
              size="sm"
              class="rounded-none border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
              :disabled="isUploading || isSaving"
              @click="handleRemoveCover"
            >
              <Trash2 class="size-3.5" />
              <span>{{ t('packageEdit.gallery.removeButton') }}</span>
            </Button>
          </div>

          <p class="text-xs text-muted-foreground leading-relaxed">
            {{ t('packageEdit.gallery.hint') }}
          </p>
        </div>
      </div>

      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        class="hidden"
        @change="handleFileInputChange"
      />

      <template #footer>
        <div class="min-h-5 flex items-center text-xs">
          <span
            v-if="errorMsg"
            role="alert"
            class="inline-flex items-center gap-1.5 text-destructive"
          >
            <AlertCircle class="size-3.5 shrink-0" />
            <span>{{ errorMsg }}</span>
          </span>
          <span
            v-else-if="saveSuccess"
            role="status"
            class="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium"
          >
            <CheckCircle2 class="size-3.5 shrink-0" />
            <span>{{ t('common.saved') }}</span>
          </span>
        </div>

        <Button
          type="submit"
          size="sm"
          class="rounded-none cursor-pointer"
          :disabled="isSaving || isUploading"
        >
          <Loader2 v-if="isSaving" class="size-3.5 animate-spin" />
          <Save v-else class="size-3.5" />
          <span>{{ isSaving ? t('common.saving') : t('common.save') }}</span>
        </Button>
      </template>
    </FormPanel>

    <!-- 高清灯箱 -->
    <Dialog v-model:open="lightboxOpen">
      <DialogContent class="max-w-4xl rounded-none p-2 sm:p-3">
        <DialogHeader class="sr-only">
          <DialogTitle>{{ t('packageEdit.gallery.panelTitle') }}</DialogTitle>
          <DialogDescription>{{ t('detail.zoomImage') }}</DialogDescription>
        </DialogHeader>
        <div v-if="hasCover" class="flex items-center justify-center bg-black/5 max-h-[85vh] overflow-auto">
          <img :src="thumbnail" alt="Banner" class="max-w-full max-h-[82vh] object-contain" />
        </div>
      </DialogContent>
    </Dialog>
  </form>
</template>
