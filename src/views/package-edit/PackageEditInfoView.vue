<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, Save, Trash2 } from '@lucide/vue'
import FormPanel from '@/components/form/FormPanel.vue'
import FormRow from '@/components/form/FormRow.vue'
import String3Fields from '@/components/form/String3Fields.vue'
import { usePreferencesStore } from '@/stores/preferences'
import { usePackageCacheActions, usePackageDetailQuery } from '@/queries/packages'
import { createPackage, deletePackage, updatePackage } from '@/api/packages'
import { formatApiErrorMessage } from '@/api/auth'
import { buildWikiDocUrl } from '@/api/portal'
import { hasValidAuthor } from '@/utils/package'
import { hasTrimIssues, isString3Valid, normalizeString3ForSubmit, validateString3 } from '@/utils/string3'
import { isValidEmailFormat, isValidHttpUrl, isValidIdentifierFormat } from '@/utils/format'
import { useUnsavedChangesGuard } from '@/composables/useUnsavedChangesGuard'
import type { SavePackageInfoPayload, String3 } from '@/types/models'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const route = useRoute()
const router = useRouter()
const { t, te } = useI18n()
const preferences = usePreferencesStore()
const { invalidatePackage, invalidatePackageLists, removePackageDetail } = usePackageCacheActions()

const isCreateMode = computed(() => route.name === 'package-new')

const packageId = computed<number | null>(() => {
  if (isCreateMode.value) return null
  const raw = String(route.params.id ?? '')
  if (!/^\d+$/.test(raw)) return null
  const num = Number.parseInt(raw, 10)
  return num > 0 ? num : null
})

const packageQuery = usePackageDetailQuery(packageId)

const identifier = ref('')
const preservedGuid = ref<string | undefined>(undefined)
const nameForm = ref<String3>({ Local: '', English: '', Tag: '' })
const isRepost = ref(false)
const authorNameForm = ref<String3>({ Local: '', English: '', Tag: '' })
const authorEmail = ref('')
const authorHomepage = ref('')
const homepage = ref('')
const forcePopup = ref(false)

const submittedOnce = ref(false)
const isSaving = ref(false)
const saveError = ref('')
const saveSuccess = ref(false)

const deleteDialogOpen = ref(false)
const isDeleting = ref(false)
const deleteError = ref('')
const lastFilledId = ref<number | null>(null)
let suppressDirty = false
const { isDirty, markDirty, resetDirty } = useUnsavedChangesGuard()

watch(
  [() => isCreateMode.value, () => packageQuery.data.value],
  ([creating, data]) => {
    suppressDirty = true
    if (creating) {
      lastFilledId.value = null
      identifier.value = ''
      preservedGuid.value = undefined
      nameForm.value = { Local: '', English: '', Tag: '' }
      isRepost.value = false
      authorNameForm.value = { Local: '', English: '', Tag: '' }
      authorEmail.value = ''
      authorHomepage.value = ''
      homepage.value = ''
      forcePopup.value = false
      submittedOnce.value = false
      saveError.value = ''
      saveSuccess.value = false
      void nextTick(() => { suppressDirty = false; resetDirty() })
      return
    }
    if (!data) { suppressDirty = false; return }
    if (data.ID === lastFilledId.value && isDirty.value) { suppressDirty = false; return }
    lastFilledId.value = data.ID
    identifier.value = data.Identifier ?? ''
    preservedGuid.value = data.GUID
    nameForm.value = {
      Local: data.Name?.Local ?? '',
      English: data.Name?.English ?? '',
      Tag: data.Name?.Tag ?? '',
    }
    const repost = hasValidAuthor(data.Author)
    isRepost.value = repost
    if (repost && data.Author) {
      authorNameForm.value = {
        Local: data.Author.Name?.Local ?? '',
        English: data.Author.Name?.English ?? '',
        Tag: data.Author.Name?.Tag ?? '',
      }
      authorEmail.value = data.Author.Email ?? ''
      authorHomepage.value = data.Author.Homepage ?? ''
    } else {
      authorNameForm.value = { Local: '', English: '', Tag: '' }
      authorEmail.value = ''
      authorHomepage.value = ''
    }
    homepage.value = data.Homepage ?? ''
    forcePopup.value = Boolean(data.ForcePopup)
    saveError.value = ''
    saveSuccess.value = false
    void nextTick(() => { suppressDirty = false; resetDirty() })
  },
  { immediate: true },
)

watch(
  [identifier, nameForm, isRepost, authorNameForm, authorEmail, authorHomepage, homepage, forcePopup],
  () => { if (!suppressDirty) markDirty() },
  { deep: true },
)

const canModifyIdentifier = computed(
  () => isCreateMode.value,
)

const packFieldsDocUrl = computed(() =>
  buildWikiDocUrl(preferences.locale, 'packfields'),
)

const identifierError = computed(() => {
  if (!submittedOnce.value) return null
  const err = isValidIdentifierFormat(identifier.value)
  if (err === 'empty') return t('validation.required')
  if (err === 'trim') return t('validation.noLeadingTrailingSpace')
  if (err === 'chars') return t('validation.identifierChars')
  if (err === 'spaces') return t('validation.identifierMultipleSpaces')
  return null
})

const nameErrors = computed(() => validateString3(nameForm.value, (key) => t(key)))
const authorNameErrors = computed(() =>
  isRepost.value
    ? validateString3(authorNameForm.value, (key) => t(key))
    : { local: null, english: null, tag: null },
)

const authorEmailError = computed(() => {
  if (!submittedOnce.value || !isRepost.value) return null
  const val = authorEmail.value
  if (!val) return null
  if (hasTrimIssues(val)) return t('validation.noLeadingTrailingSpace')
  if (!isValidEmailFormat(val)) return t('validation.emailInvalid')
  return null
})

const authorHomepageError = computed(() => {
  if (!submittedOnce.value || !isRepost.value) return null
  const val = authorHomepage.value
  if (!val) return null
  if (hasTrimIssues(val)) return t('validation.noLeadingTrailingSpace')
  if (!isValidHttpUrl(val)) return t('validation.urlInvalid')
  return null
})

const homepageError = computed(() => {
  if (!submittedOnce.value) return null
  const val = homepage.value
  if (!val) return null
  if (hasTrimIssues(val)) return t('validation.noLeadingTrailingSpace')
  if (!isValidHttpUrl(val)) return t('validation.urlInvalid')
  return null
})

async function handleSubmit() {
  if (isSaving.value) return
  submittedOnce.value = true
  saveError.value = ''
  saveSuccess.value = false

  if (
    identifierError.value ||
    !isString3Valid(nameErrors.value) ||
    !isString3Valid(authorNameErrors.value) ||
    authorEmailError.value ||
    authorHomepageError.value ||
    homepageError.value
  ) {
    return
  }

  const payload: SavePackageInfoPayload = {
    Identifier: identifier.value.trim(),
    Name: normalizeString3ForSubmit(nameForm.value),
    Homepage: homepage.value.trim(),
    ForcePopup: forcePopup.value,
  }

  if (preservedGuid.value) {
    payload.GUID = preservedGuid.value
  }

  if (isRepost.value) {
    payload.Author = {
      Name: normalizeString3ForSubmit(authorNameForm.value),
      Email: authorEmail.value.trim(),
      Homepage: authorHomepage.value.trim(),
    }
  } else {
    payload.Author = null
  }

  isSaving.value = true
  const currentPkgId = packageId.value
  const wasCreateMode = isCreateMode.value
  try {
    if (wasCreateMode) {
      const created = await createPackage(payload)
      resetDirty()
      await invalidatePackageLists()
      if (route.name === 'package-new') {
        await router.replace(`/packages/${created.ID}/edit/info`)
      }
    } else if (currentPkgId) {
      const updated = await updatePackage(currentPkgId, payload)
      resetDirty()
      await invalidatePackageLists()
      await invalidatePackage(updated.ID)
      if (updated.ID !== currentPkgId && route.params.id === String(currentPkgId)) {
        await router.replace(`/packages/${updated.ID}/edit/info`)
      } else {
        saveSuccess.value = true
      }
    }
  } catch (err) {
    saveError.value = formatApiErrorMessage(err, t, te)
  } finally {
    isSaving.value = false
  }
}

async function handleDeletePackage() {
  if (!packageId.value || isDeleting.value) return
  isDeleting.value = true
  deleteError.value = ''
  const pkgId = packageId.value
  try {
    await deletePackage(pkgId)
    resetDirty()
    removePackageDetail(pkgId)
    await invalidatePackageLists()
    deleteDialogOpen.value = false
    if (String(route.params.id) === String(pkgId)) {
      await router.replace('/packages')
    }
  } catch (err) {
    deleteError.value = formatApiErrorMessage(err, t, te)
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <form novalidate class="space-y-5" @submit.prevent="handleSubmit">
    <!-- 唯一标识 -->
    <FormPanel :title="t('packageEdit.info.identPanelTitle')">
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

      <FormRow
        :label="t('packageEdit.info.identifierLabel')"
        html-for="pack-identifier"
        required
        :hint="
          canModifyIdentifier
            ? t('packageEdit.info.identifierHint')
            : t('packageEdit.info.identifierLockedHint')
        "
        :error="identifierError"
      >
        <input
          id="pack-identifier"
          v-model="identifier"
          type="text"
          :readonly="!canModifyIdentifier"
          :disabled="isSaving"
          placeholder="CSSSC-Guangzhou Metro Line 1"
          class="w-full max-w-[340px] h-8 px-2.5 text-[13px] font-mono border focus:outline-none"
          :class="[
            canModifyIdentifier
              ? 'bg-background border-input focus:border-primary'
              : 'bg-muted/50 text-muted-foreground border-border cursor-default',
            identifierError ? 'border-destructive focus:border-destructive' : '',
          ]"
        />
      </FormRow>
    </FormPanel>

    <!-- 显示名称 -->
    <FormPanel :title="t('packageEdit.info.namePanelTitle')">
      <String3Fields
        v-model="nameForm"
        id-prefix="pack-name"
        :show-errors="submittedOnce"
        :disabled="isSaving"
      />
    </FormPanel>

    <!-- 作品来源 -->
    <FormPanel :title="t('packageEdit.info.originPanelTitle')">
      <FormRow :label="t('packageEdit.info.originTypeLabel')" required>
        <div class="flex flex-wrap items-center gap-4 pt-1 text-[13px]">
          <label class="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              v-model="isRepost"
              type="radio"
              :value="false"
              :disabled="isSaving"
              class="accent-primary"
            />
            <span>{{ t('packageEdit.info.originOriginal') }}</span>
          </label>
          <label class="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              v-model="isRepost"
              type="radio"
              :value="true"
              :disabled="isSaving"
              class="accent-primary"
            />
            <span>{{ t('packageEdit.info.originRepost') }}</span>
          </label>
        </div>
      </FormRow>

      <template v-if="isRepost">
        <div class="px-4 py-2 bg-muted/25 text-sm font-semibold text-muted-foreground">
          {{ t('packageEdit.info.authorNameSection') }}
        </div>

        <String3Fields
          v-model="authorNameForm"
          id-prefix="pack-author-name"
          :show-errors="submittedOnce"
          :disabled="isSaving"
        />

        <FormRow
          :label="t('packageEdit.info.authorEmailLabel')"
          html-for="pack-author-email"
          :error="authorEmailError"
        >
          <input
            id="pack-author-email"
            v-model="authorEmail"
            type="email"
            :disabled="isSaving"
            class="w-full max-w-[340px] h-8 px-2.5 text-[13px] bg-background border border-input focus:border-primary focus:outline-none disabled:opacity-60"
            :class="authorEmailError ? 'border-destructive focus:border-destructive' : ''"
          />
        </FormRow>

        <FormRow
          :label="t('packageEdit.info.authorHomepageLabel')"
          html-for="pack-author-homepage"
          :error="authorHomepageError"
        >
          <input
            id="pack-author-homepage"
            v-model="authorHomepage"
            type="url"
            placeholder="https://..."
            :disabled="isSaving"
            class="w-full max-w-[440px] h-8 px-2.5 text-[13px] bg-background border border-input focus:border-primary focus:outline-none disabled:opacity-60"
            :class="authorHomepageError ? 'border-destructive focus:border-destructive' : ''"
          />
        </FormRow>
      </template>
    </FormPanel>

    <!-- 相关信息页 -->
    <FormPanel :title="t('packageEdit.info.homepagePanelTitle')">
      <FormRow
        :label="t('packageEdit.info.homepageLabel')"
        html-for="pack-homepage"
        :error="homepageError"
      >
        <input
          id="pack-homepage"
          v-model="homepage"
          type="url"
          placeholder="https://..."
          :disabled="isSaving"
          class="w-full max-w-[440px] h-8 px-2.5 text-[13px] bg-background border border-input focus:border-primary focus:outline-none disabled:opacity-60"
          :class="homepageError ? 'border-destructive focus:border-destructive' : ''"
        />
      </FormRow>

      <FormRow :label="t('packageEdit.info.forcePopupLabel')">
        <label class="inline-flex items-start gap-2 pt-1 text-[13px] cursor-pointer select-none">
          <input
            v-model="forcePopup"
            type="checkbox"
            :disabled="isSaving"
            class="mt-0.5 accent-primary"
          />
          <span class="text-sm text-muted-foreground leading-relaxed">
            {{ t('packageEdit.info.forcePopupHint') }}
          </span>
        </label>
      </FormRow>
    </FormPanel>

    <!-- 底部操作面板 -->
    <FormPanel>
      <template #footer>
        <div class="flex flex-wrap items-center gap-3">
          <Button
            v-if="!isCreateMode"
            type="button"
            variant="outline"
            size="sm"
            class="rounded-none border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
            :disabled="isSaving"
            @click="deleteDialogOpen = true"
          >
            <Trash2 class="size-3.5" />
            <span>{{ t('packageEdit.info.deleteButton') }}</span>
          </Button>

          <span
            v-if="saveError"
            role="alert"
            class="inline-flex items-center gap-1.5 text-sm text-destructive"
          >
            <AlertCircle class="size-3.5 shrink-0" />
            <span>{{ saveError }}</span>
          </span>
          <span
            v-else-if="saveSuccess"
            role="status"
            class="inline-flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400 font-medium"
          >
            <CheckCircle2 class="size-3.5 shrink-0" />
            <span>{{ t('common.saved') }}</span>
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
          <span>
            {{
              isSaving
                ? t('common.saving')
                : isCreateMode
                  ? t('packageEdit.info.createSubmit')
                  : t('common.save')
            }}
          </span>
        </Button>
      </template>
    </FormPanel>

    <!-- 删除作品确认对话框 -->
    <Dialog v-model:open="deleteDialogOpen">
      <DialogContent
        class="max-w-md rounded-none"
        :show-close-button="!isDeleting"
        @interact-outside="(e: Event) => { if (isDeleting) e.preventDefault() }"
        @escape-key-down="(e: Event) => { if (isDeleting) e.preventDefault() }"
      >
        <DialogHeader>
          <DialogTitle class="text-base">{{ t('packageEdit.info.deleteConfirmTitle') }}</DialogTitle>
          <DialogDescription class="text-sm leading-relaxed">
            {{ t('packageEdit.info.deleteConfirmDesc') }}
          </DialogDescription>
        </DialogHeader>

        <p v-if="deleteError" class="text-sm text-destructive" role="alert">
          {{ deleteError }}
        </p>

        <DialogFooter class="gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            class="rounded-none cursor-pointer"
            :disabled="isDeleting"
            @click="deleteDialogOpen = false"
          >
            {{ t('common.cancel') }}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            class="rounded-none cursor-pointer"
            :disabled="isDeleting"
            @click="handleDeletePackage"
          >
            <Loader2 v-if="isDeleting" class="size-3.5 animate-spin" />
            <span>{{ t('packageEdit.info.deleteConfirmAction') }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </form>
</template>
