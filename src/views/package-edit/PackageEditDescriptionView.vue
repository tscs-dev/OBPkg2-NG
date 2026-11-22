<script setup lang="ts">
import { type ComponentPublicInstance, computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { AlertCircle, CheckCircle2, Loader2, Save } from '@lucide/vue'
import FormPanel from '@/components/form/FormPanel.vue'
import RichTextEditor from '@/components/editor/RichTextEditor.vue'
import { usePackageCacheActions, usePackageDetailQuery } from '@/queries/packages'
import { updatePackage } from '@/api/packages'
import { formatApiErrorMessage } from '@/api/auth'
import { useUnsavedChangesGuard } from '@/composables/useUnsavedChangesGuard'
import { sanitizePackageHtml } from '@/utils/sanitize'
import { Button } from '@/components/ui/button'

const route = useRoute()
const { t, te } = useI18n()
const { invalidatePackage } = usePackageCacheActions()

const packageId = computed<number | null>(() => {
  const raw = String(route.params.id ?? '')
  const num = Number.parseInt(raw, 10)
  return Number.isInteger(num) && num > 0 ? num : null
})

const packageQuery = usePackageDetailQuery(packageId)

const editorRef = ref<ComponentPublicInstance<{ hasActiveUploads: boolean; hasPendingOrBrokenPlaceholders: boolean }>>()
const isEditorBusy = computed(() =>
  (editorRef.value?.hasActiveUploads ?? false) || (editorRef.value?.hasPendingOrBrokenPlaceholders ?? false),
)

const descriptionHtml = ref('')
const isSaving = ref(false)
const saveError = ref('')
const saveSuccess = ref(false)
const lastFilledId = ref<number | null>(null)
let suppressDirty = false
const { isDirty, markDirty, resetDirty } = useUnsavedChangesGuard()

watch(
  () => packageQuery.data.value,
  (data) => {
    if (!data) return
    if (data.ID === lastFilledId.value && isDirty.value) return
    lastFilledId.value = data.ID
    suppressDirty = true
    descriptionHtml.value = data.Description ?? ''
    saveError.value = ''
    saveSuccess.value = false
    void nextTick(() => { suppressDirty = false; resetDirty() })
  },
  { immediate: true },
)

watch(descriptionHtml, () => {
  if (!suppressDirty) markDirty()
})

async function handleSave() {
  if (!packageId.value || isSaving.value) return
  isSaving.value = true
  const pkgId = packageId.value
  saveError.value = ''
  saveSuccess.value = false

  try {
    await updatePackage(pkgId, {
      Description: sanitizePackageHtml(descriptionHtml.value),
    })
    if (packageId.value !== pkgId) return
    resetDirty()
    await invalidatePackage(pkgId)
    saveSuccess.value = true
  } catch (err) {
    if (packageId.value !== pkgId) return
    saveError.value = formatApiErrorMessage(err, t, te)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="handleSave">
    <FormPanel :title="t('packageEdit.description.panelTitle')">
      <div class="p-3">
        <RichTextEditor ref="editorRef" v-model="descriptionHtml" :disabled="isSaving" />
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
