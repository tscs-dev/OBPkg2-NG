<script setup lang="ts">
import { type ComponentPublicInstance, computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertCircle, CheckCircle2, Loader2, Save } from '@lucide/vue'
import FormPanel from '@/components/form/FormPanel.vue'
import RichTextEditor from '@/components/editor/RichTextEditor.vue'
import { useUploaderCacheActions, useUploaderDetailQuery } from '@/queries/uploaders'
import { updateUploaderProfile } from '@/api/uploaders'
import { formatApiErrorMessage } from '@/api/auth'
import { useSettingsTarget } from '@/composables/useSettingsTarget'
import { useUnsavedChangesGuard } from '@/composables/useUnsavedChangesGuard'
import { sanitizePackageHtmlForStorage } from '@/utils/sanitize'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const { t, te } = useI18n()
const { invalidateUploader } = useUploaderCacheActions()

const { targetUserId } = useSettingsTarget()
const uploaderQuery = useUploaderDetailQuery(targetUserId)
const { isDirty, markDirty, resetDirty } = useUnsavedChangesGuard()

const editorRef = ref<ComponentPublicInstance<{ hasActiveUploads: boolean; hasPendingOrBrokenPlaceholders: boolean }>>()
const isEditorBusy = computed(() =>
  (editorRef.value?.hasActiveUploads ?? false) || (editorRef.value?.hasPendingOrBrokenPlaceholders ?? false),
)

const bioHtml = ref('')
const isSaving = ref(false)
const saveError = ref('')
const saveSuccess = ref(false)
const lastFilledId = ref<number | null>(null)
let suppressDirty = false

watch(
  () => uploaderQuery.data.value,
  (data) => {
    if (!data) return
    if (data.ID === lastFilledId.value && isDirty.value) return
    lastFilledId.value = data.ID
    suppressDirty = true
    bioHtml.value = data.Description ?? ''
    saveError.value = ''
    saveSuccess.value = false
    void nextTick(() => {
      suppressDirty = false
      resetDirty()
    })
  },
  { immediate: true },
)

watch(bioHtml, () => {
  if (!suppressDirty) markDirty()
})

async function handleSave() {
  if (!targetUserId.value || isSaving.value) return
  isSaving.value = true
  const uid = targetUserId.value
  saveError.value = ''
  saveSuccess.value = false

  try {
    await updateUploaderProfile(uid, {
      Description: sanitizePackageHtmlForStorage(bioHtml.value),
    })
    await invalidateUploader(uid)
    resetDirty()
    saveSuccess.value = true
  } catch (err) {
    saveError.value = formatApiErrorMessage(err, t, te)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div v-if="uploaderQuery.isLoading.value">
    <FormPanel :title="t('settings.bio.panelTitle')">
      <div class="p-4 space-y-3">
        <Skeleton class="h-9 w-full rounded-none" />
        <Skeleton class="h-64 w-full rounded-none" />
      </div>
    </FormPanel>
  </div>

  <div
    v-else-if="uploaderQuery.isError.value"
    class="border border-border bg-muted/30 p-5 space-y-3"
  >
    <p class="text-sm font-medium text-foreground">{{ t('uploader.notFoundTitle') }}</p>
    <p class="text-sm text-muted-foreground">
      {{ formatApiErrorMessage(uploaderQuery.error.value, t, te) }}
    </p>
    <Button
      variant="outline"
      size="sm"
      class="rounded-none cursor-pointer"
      @click="() => uploaderQuery.refetch()"
    >
      {{ t('common.retry') }}
    </Button>
  </div>

  <form v-else-if="uploaderQuery.data.value" class="space-y-4" @submit.prevent="handleSave">
    <FormPanel :title="t('settings.bio.panelTitle')">
      <div class="p-3">
        <RichTextEditor ref="editorRef" v-model="bioHtml" :disabled="isSaving" />
      </div>

      <template #footer>
        <div class="min-h-5 flex items-center text-sm">
          <span
            v-if="saveError"
            role="alert"
            class="inline-flex items-center gap-1.5 text-destructive"
          >
            <AlertCircle class="size-3.5 shrink-0" />
            <span>{{ saveError }}</span>
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
          :disabled="isSaving || isEditorBusy"
        >
          <Loader2 v-if="isSaving" class="size-3.5 animate-spin" />
          <Save v-else class="size-3.5" />
          <span>{{ isSaving ? t('common.saving') : t('common.save') }}</span>
        </Button>
      </template>
    </FormPanel>
  </form>
</template>
