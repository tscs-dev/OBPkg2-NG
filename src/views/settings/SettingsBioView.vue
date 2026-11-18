<script setup lang="ts">
import { type ComponentPublicInstance, computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { AlertCircle, CheckCircle2, Loader2, Save } from '@lucide/vue'
import FormPanel from '@/components/form/FormPanel.vue'
import RichTextEditor from '@/components/editor/RichTextEditor.vue'
import { useAuthStore } from '@/stores/auth'
import { useUploaderCacheActions, useUploaderDetailQuery } from '@/queries/uploaders'
import { updateUploaderProfile } from '@/api/uploaders'
import { formatApiErrorMessage } from '@/api/auth'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const route = useRoute()
const { t, te } = useI18n()
const authStore = useAuthStore()
const { invalidateUploader } = useUploaderCacheActions()

const targetUserId = computed<number | null>(() => {
  const rawUid = route.query.uid
  if (rawUid && authStore.privilege >= 50) {
    const parsed = Number.parseInt(String(rawUid), 10)
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed
    }
  }
  return authStore.currentUserId
})

const uploaderQuery = useUploaderDetailQuery(targetUserId)

const editorRef = ref<ComponentPublicInstance<{ hasActiveUploads: boolean }>>()
const isEditorBusy = computed(() => editorRef.value?.hasActiveUploads ?? false)

const bioHtml = ref('')
const isSaving = ref(false)
const saveError = ref('')
const saveSuccess = ref(false)

watch(
  () => uploaderQuery.data.value,
  (data) => {
    if (!data) return
    bioHtml.value = data.Description ?? ''
    saveError.value = ''
    saveSuccess.value = false
  },
  { immediate: true },
)

async function handleSave() {
  if (!targetUserId.value || isSaving.value) return
  isSaving.value = true
  saveError.value = ''
  saveSuccess.value = false

  try {
    await updateUploaderProfile(targetUserId.value, {
      Description: bioHtml.value,
    })
    await invalidateUploader(targetUserId.value)
    saveSuccess.value = true
  } catch (err) {
    saveError.value = formatApiErrorMessage(err, t, te)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div v-if="uploaderQuery.isPending.value">
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
      {{ uploaderQuery.error.value?.message || t('errors.network') }}
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
