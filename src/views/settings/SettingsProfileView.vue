<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, Save } from '@lucide/vue'
import FormPanel from '@/components/form/FormPanel.vue'
import FormRow from '@/components/form/FormRow.vue'
import String3Fields from '@/components/form/String3Fields.vue'
import { useAuthStore } from '@/stores/auth'
import { usePreferencesStore } from '@/stores/preferences'
import { useUploaderCacheActions, useUploaderDetailQuery } from '@/queries/uploaders'
import { updateUploaderProfile } from '@/api/uploaders'
import { formatApiErrorMessage } from '@/api/auth'
import { buildWikiDocUrl } from '@/api/portal'
import { hasTrimIssues, isString3Valid, normalizeString3ForSubmit, validateString3 } from '@/utils/string3'
import type { String3 } from '@/types/models'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const route = useRoute()
const { t, te } = useI18n()
const authStore = useAuthStore()
const preferences = usePreferencesStore()
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

const nameForm = ref<String3>({ Local: '', English: '', Tag: '' })
const homepageForm = ref('')

const submittedOnce = ref(false)
const isSaving = ref(false)
const saveError = ref('')
const saveSuccess = ref(false)

watch(
  () => uploaderQuery.data.value,
  (data) => {
    if (!data) return
    nameForm.value = {
      Local: data.Name?.Local ?? '',
      English: data.Name?.English ?? '',
      Tag: data.Name?.Tag ?? '',
    }
    homepageForm.value = data.Homepage ?? ''
    saveSuccess.value = false
    saveError.value = ''
  },
  { immediate: true },
)

const s3Errors = computed(() => validateString3(nameForm.value, (key) => t(key)))

const homepageError = computed(() => {
  if (!submittedOnce.value) return null
  const val = homepageForm.value
  if (!val) return null
  if (hasTrimIssues(val)) return t('validation.noLeadingTrailingSpace')
  try {
    const parsed = new URL(val)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return t('validation.urlInvalid')
    }
    return null
  } catch {
    return t('validation.urlInvalid')
  }
})

const packFieldsDocUrl = computed(() =>
  buildWikiDocUrl(preferences.locale, 'packfields'),
)

async function handleSubmit() {
  if (!targetUserId.value || isSaving.value) return
  submittedOnce.value = true
  saveError.value = ''
  saveSuccess.value = false

  if (!isString3Valid(s3Errors.value) || homepageError.value) {
    return
  }

  isSaving.value = true
  try {
    const updated = await updateUploaderProfile(targetUserId.value, {
      Name: normalizeString3ForSubmit(nameForm.value),
      Homepage: homepageForm.value.trim(),
    })

    if (authStore.currentUserId === targetUserId.value) {
      // 深拷贝隔离：防止编辑器输入引用直接影响顶栏显示
      authStore.updateProfile(JSON.parse(JSON.stringify(updated)))
    }
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
  <!-- 加载骨架 -->
  <div v-if="uploaderQuery.isPending.value" class="space-y-5">
    <FormPanel :title="t('settings.profile.namePanelTitle')">
      <div class="p-4 space-y-3">
        <Skeleton class="h-8 w-80 rounded-none" />
        <Skeleton class="h-8 w-80 rounded-none" />
        <Skeleton class="h-8 w-80 rounded-none" />
      </div>
    </FormPanel>
  </div>

  <!-- 错误态 -->
  <div
    v-else-if="uploaderQuery.isError.value"
    class="border border-border bg-muted/30 p-5 space-y-3"
  >
    <p class="text-sm font-medium text-foreground">{{ t('uploader.notFoundTitle') }}</p>
    <p class="text-xs text-muted-foreground">
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

  <!-- 基本信息水平属性表单 -->
  <form v-else-if="uploaderQuery.data.value" novalidate class="space-y-5" @submit.prevent="handleSubmit">
    <FormPanel
      :title="t('settings.profile.namePanelTitle')"
    >
      <template #header-extra>
        <a
          :href="packFieldsDocUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 text-[11px] text-primary hover:underline underline-offset-4"
        >
          <span>{{ t('settings.profile.namingGuideLink') }}</span>
          <ExternalLink class="size-3" />
        </a>
      </template>

      <String3Fields
        v-model="nameForm"
        id-prefix="profile-s3"
        :show-errors="submittedOnce"
        :disabled="isSaving"
      />
    </FormPanel>

    <FormPanel :title="t('settings.profile.contactPanelTitle')">
      <FormRow
        :label="t('settings.profile.emailLabel')"
        :hint="t('settings.profile.emailReadonlyHint')"
      >
        <input
          :value="uploaderQuery.data.value.Email"
          type="text"
          readonly
          tabindex="-1"
          class="w-full max-w-[340px] h-8 px-2.5 text-[13px] bg-muted/50 text-muted-foreground border border-border cursor-default focus:outline-none"
        />
      </FormRow>

      <FormRow
        :label="t('settings.profile.homepageLabel')"
        html-for="profile-homepage"
        :hint="t('settings.profile.homepageHint')"
        :error="homepageError"
      >
        <input
          id="profile-homepage"
          v-model="homepageForm"
          type="url"
          placeholder="https://example.com"
          :disabled="isSaving"
          class="w-full max-w-[440px] h-8 px-2.5 text-[13px] bg-background border border-input focus:border-primary focus:outline-none disabled:opacity-60"
          :class="homepageError ? 'border-destructive focus:border-destructive' : ''"
        />
      </FormRow>
    </FormPanel>

    <FormPanel title="">
      <template #footer>
        <div class="min-h-5 flex items-center text-xs">
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
            <span>{{ t('settings.profile.saveSuccess') }}</span>
          </span>
        </div>

        <Button
          type="submit"
          size="sm"
          class="rounded-none cursor-pointer"
          :disabled="isSaving"
        >
          <Loader2 v-if="isSaving" class="size-3.5 animate-spin" />
          <Save v-else class="size-3.5" />
          <span>{{ isSaving ? t('common.saving') : t('common.save') }}</span>
        </Button>
      </template>
    </FormPanel>
  </form>
</template>
