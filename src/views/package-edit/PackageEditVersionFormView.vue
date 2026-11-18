<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FolderOpen,
  Loader2,
  Save,
} from '@lucide/vue'
import FormPanel from '@/components/form/FormPanel.vue'
import FormRow from '@/components/form/FormRow.vue'
import FileCartonPickerDialog from '@/components/editor/FileCartonPickerDialog.vue'
import FileAuditMenu from '@/components/admin/FileAuditMenu.vue'
import { PLATFORMS, PLATFORM_ORDER } from '@/config/platforms'
import { useAuthStore } from '@/stores/auth'
import { usePreferencesStore } from '@/stores/preferences'
import { usePackageCacheActions, usePackageDetailQuery } from '@/queries/packages'
import { useFileCacheActions } from '@/queries/files'
import { createFile, updateFile } from '@/api/files'
import { formatApiErrorMessage } from '@/api/auth'
import { buildWikiDocUrl } from '@/api/portal'
import {
  isValidEmailFormat,
  isValidPackageSizeFormat,
  isValidVersionFormat,
} from '@/utils/format'
import { hasTrimIssues } from '@/utils/string3'
import type { SaveFilePayload } from '@/types/models'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
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
const authStore = useAuthStore()
const preferences = usePreferencesStore()
const { invalidatePackage, invalidatePackageLists } = usePackageCacheActions()
const { invalidateFiles } = useFileCacheActions()

const packageId = computed<number | null>(() => {
  const raw = String(route.params.id ?? '')
  const num = Number.parseInt(raw, 10)
  return Number.isInteger(num) && num > 0 ? num : null
})

const isCreateMode = computed(() => route.name === 'package-edit-version-new')
const fileId = computed<number | null>(() => {
  if (isCreateMode.value) return null
  const raw = String(route.params.fileId ?? '')
  const num = Number.parseInt(raw, 10)
  return Number.isInteger(num) && num > 0 ? num : null
})

const packageQuery = usePackageDetailQuery(packageId)

const existingFile = computed(() => {
  if (isCreateMode.value || !fileId.value) return null
  return packageQuery.data.value?.Files?.find((f) => f.ID === fileId.value) ?? null
})

const platform = ref<'hmmsim' | 'openbve'>('hmmsim')
const version = ref('1.0')
const authEmail = ref('')
const storagePath = ref('')
const fileSize = ref('')

const manualOverride = ref(false)
const pickerOpen = ref(false)

const submittedOnce = ref(false)
const isSaving = ref(false)
const saveError = ref('')
const saveSuccess = ref(false)

const revalidateWarningOpen = ref(false)

const isModerator = computed(() => authStore.privilege >= 10)
const canManualEdit = computed(() => isModerator.value && manualOverride.value)

watch(
  [() => isCreateMode.value, existingFile, () => authStore.profile?.Email],
  ([creating, file, userEmail]) => {
    submittedOnce.value = false
    saveError.value = ''
    saveSuccess.value = false
    if (creating) {
      platform.value = 'hmmsim'
      version.value = '1.0'
      authEmail.value = userEmail ?? ''
      storagePath.value = ''
      fileSize.value = ''
      return
    }
    if (!file) return
    platform.value = file.Platform === 'openbve' ? 'openbve' : 'hmmsim'
    version.value = file.Version ?? ''
    authEmail.value = file.AuthParam ?? ''
    storagePath.value = file.URLParam ?? ''
    fileSize.value = file.Size ?? ''
  },
  { immediate: true },
)

const fileFieldsDocUrl = computed(() =>
  buildWikiDocUrl(preferences.locale, 'filefields'),
)

const hasConflict = computed(() => {
  const list = packageQuery.data.value?.Files ?? []
  const ver = version.value.trim()
  return list.some(
    (item) =>
      item.ID !== (fileId.value ?? 0) &&
      item.Platform === platform.value &&
      item.Version === ver,
  )
})

const versionError = computed(() => {
  if (!submittedOnce.value) return null
  const val = version.value
  if (!val || !val.trim()) return t('validation.required')
  if (hasTrimIssues(val)) return t('validation.noLeadingTrailingSpace')
  if (!isValidVersionFormat(val)) return t('validation.versionFormat')
  if (hasConflict.value) return t('errors.code_204')
  return null
})

const authEmailError = computed(() => {
  if (!submittedOnce.value) return null
  const val = authEmail.value
  if (!val || !val.trim()) return t('validation.required')
  if (hasTrimIssues(val)) return t('validation.noLeadingTrailingSpace')
  if (!isValidEmailFormat(val)) return t('validation.emailInvalid')
  return null
})

const storagePathError = computed(() => {
  if (!submittedOnce.value) return null
  const val = storagePath.value
  if (!val || !val.trim()) return t('packageEdit.versions.fileRequired')
  if (hasTrimIssues(val)) return t('validation.noLeadingTrailingSpace')
  if (!val.startsWith('/')) return t('validation.pathLeadingSlash')
  return null
})

const fileSizeError = computed(() => {
  if (!submittedOnce.value) return null
  const val = fileSize.value
  if (!val || !val.trim()) return t('packageEdit.versions.fileRequired')
  if (hasTrimIssues(val)) return t('validation.noLeadingTrailingSpace')
  if (!isValidPackageSizeFormat(val)) return t('validation.fileSizeFormat')
  return null
})

function handlePickerSelect(picked: { path: string; size: string }) {
  storagePath.value = picked.path
  fileSize.value = picked.size
  saveError.value = ''
  saveSuccess.value = false
}

async function performSave() {
  if (!packageId.value || isSaving.value) return

  const payload: SaveFilePayload = {
    PackageID: packageId.value,
    Platform: platform.value,
    Version: version.value.trim(),
    Size: fileSize.value.trim(),
    Service: 'bcstianjin',
    URLParam: storagePath.value.trim(),
    AuthParam: authEmail.value.trim(),
  }

  isSaving.value = true
  saveError.value = ''
  saveSuccess.value = false
  try {
    if (isCreateMode.value) {
      await createFile(payload)
      await invalidatePackage(packageId.value)
      await invalidatePackageLists()
      await invalidateFiles()
      await router.replace(`/packages/${packageId.value}/edit/versions`)
    } else if (fileId.value) {
      await updateFile(fileId.value, payload)
      await invalidatePackage(packageId.value)
      await invalidatePackageLists()
      await invalidateFiles()
      revalidateWarningOpen.value = false
      saveSuccess.value = true
    }
  } catch (err) {
    saveError.value = formatApiErrorMessage(err, t, te)
  } finally {
    isSaving.value = false
  }
}

function handleSubmit() {
  submittedOnce.value = true
  saveError.value = ''
  saveSuccess.value = false

  if (
    versionError.value ||
    authEmailError.value ||
    storagePathError.value ||
    fileSizeError.value
  ) {
    return
  }

  // 编辑已通过验证的文件时，先弹窗确认将取消验证并暂时下架
  if (
    !isCreateMode.value &&
    existingFile.value?.NeedValidation &&
    existingFile.value?.Validated
  ) {
    revalidateWarningOpen.value = true
    return
  }

  void performSave()
}

function handleAuditUpdated() {
  saveError.value = ''
  saveSuccess.value = true
}

function handleAuditDeleted() {
  if (packageId.value) {
    void router.replace(`/packages/${packageId.value}/edit/versions`)
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- 返回与文档栏 -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <router-link
        :to="`/packages/${packageId}/edit/versions`"
        class="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft class="size-3.5" />
        <span>{{ t('packageEdit.versions.backToVersions') }}</span>
      </router-link>

      <a
        :href="fileFieldsDocUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 text-xs text-primary hover:underline underline-offset-4"
      >
        <span>{{ t('settings.profile.namingGuideLink') }}</span>
        <ExternalLink class="size-3" />
      </a>
    </div>

    <!-- 找不到文件时 -->
    <div
      v-if="!isCreateMode && !existingFile"
      class="border border-border bg-muted/30 p-5 space-y-3"
    >
      <p class="text-sm font-medium text-foreground">{{ t('errors.notFound') }}</p>
      <Button as-child variant="outline" size="sm" class="rounded-none">
        <router-link :to="`/packages/${packageId}/edit/versions`">
          {{ t('packageEdit.versions.backToVersions') }}
        </router-link>
      </Button>
    </div>

    <form v-else novalidate class="space-y-4" @submit.prevent="handleSubmit">
      <!-- 退回原因提醒 -->
      <div
        v-if="existingFile?.RejectReason"
        role="alert"
        class="border border-destructive/35 bg-destructive/8 px-3.5 py-2.5 flex items-start gap-2 text-sm text-destructive leading-relaxed"
      >
        <AlertCircle class="size-4 shrink-0 mt-0.5" />
        <div>
          <span class="font-semibold">{{ t('common.rejected') }}: </span>
          <span>{{ existingFile.RejectReason }}</span>
        </div>
      </div>

      <!-- 编辑已验证文件提示 -->
      <div
        v-if="existingFile?.NeedValidation && existingFile?.Validated"
        class="border border-amber-500/35 bg-amber-500/8 px-3.5 py-2.5 flex items-start gap-2 text-sm text-amber-950 dark:text-amber-200 leading-relaxed"
      >
        <AlertTriangle class="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <span>{{ t('packageEdit.versions.validatedEditHint') }}</span>
      </div>

      <FormPanel
        :title="
          isCreateMode
            ? t('packageEdit.nav.createVersion')
            : t('packageEdit.nav.editVersionWithNum', { version: existingFile?.Version ?? '' })
        "
      >
        <template v-if="isModerator" #header-extra>
          <div class="flex items-center gap-2">
            <label class="inline-flex items-center gap-2 text-sm text-foreground/85 cursor-pointer select-none">
              <span>{{ t('packageEdit.versions.manualOverrideToggle') }}</span>
              <Switch
                :model-value="manualOverride"
                @update:model-value="(v) => { manualOverride = Boolean(v) }"
              />
            </label>

            <FileAuditMenu
              v-if="!isCreateMode && existingFile"
              :file="existingFile"
              context="version-form"
              @updated="handleAuditUpdated"
              @deleted="handleAuditDeleted"
            />
          </div>
        </template>

        <!-- 适用平台 -->
        <FormRow :label="t('packageEdit.versions.platformLabel')" required>
          <div class="flex flex-wrap items-center gap-4 pt-1 text-[13px]">
            <label
              v-for="pid in PLATFORM_ORDER"
              :key="pid"
              class="inline-flex items-center gap-2 cursor-pointer select-none"
            >
              <input
                v-model="platform"
                type="radio"
                :value="pid"
                :disabled="isSaving"
                class="accent-primary"
              />
              <span>{{ PLATFORMS[pid].name }}</span>
            </label>
          </div>
        </FormRow>

        <!-- 版本号 -->
        <FormRow
          :label="t('packageEdit.versions.versionLabel')"
          html-for="file-version"
          required
          :hint="t('packageEdit.versions.versionHint')"
          :error="versionError"
        >
          <input
            id="file-version"
            v-model="version"
            type="text"
            placeholder="1.0"
            :disabled="isSaving"
            class="w-full max-w-[200px] h-8 px-2.5 text-[13px] font-mono bg-background border border-input focus:border-primary focus:outline-none disabled:opacity-60"
            :class="versionError ? 'border-destructive focus:border-destructive' : ''"
          />
        </FormRow>

        <!-- 存储账号邮箱 -->
        <FormRow
          :label="t('packageEdit.versions.storageEmailLabel')"
          html-for="file-auth-email"
          required
          :error="authEmailError"
        >
          <input
            id="file-auth-email"
            v-model="authEmail"
            type="email"
            :readonly="!canManualEdit"
            :disabled="isSaving"
            class="w-full max-w-[340px] h-8 px-2.5 text-[13px] border focus:outline-none"
            :class="[
              canManualEdit
                ? 'bg-background border-input focus:border-primary'
                : 'bg-muted/50 text-muted-foreground border-border cursor-default',
              authEmailError ? 'border-destructive focus:border-destructive' : '',
            ]"
          />
        </FormRow>

        <!-- 文件选取与路径 / 大小 -->
        <template v-if="!canManualEdit">
          <FormRow
            :label="t('packageEdit.versions.fileSelectLabel')"
            required
            :error="storagePathError || fileSizeError"
          >
            <div class="flex flex-wrap items-center gap-2">
              <div
                class="flex-1 min-w-[220px] max-w-[440px] h-8 px-2.5 flex items-center justify-between gap-2 text-xs border border-border bg-muted/40"
              >
                <span
                  class="font-mono truncate"
                  :class="storagePath ? 'text-foreground' : 'text-muted-foreground'"
                >
                  {{ storagePath || t('packageEdit.versions.noFileSelected') }}
                </span>
                <span
                  v-if="fileSize"
                  class="text-muted-foreground tabular-nums shrink-0 border-l border-border pl-2"
                >
                  {{ fileSize }}
                </span>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                class="rounded-none h-8 cursor-pointer"
                :disabled="isSaving"
                @click="pickerOpen = true"
              >
                <FolderOpen class="size-3.5" />
                <span>{{ t('packageEdit.versions.pickFileButton') }}</span>
              </Button>
            </div>
          </FormRow>
        </template>

        <!-- 管理员手动编辑存储参数模式 -->
        <template v-else>
          <FormRow
            :label="t('packageEdit.versions.manualPathLabel')"
            html-for="file-manual-path"
            required
            :error="storagePathError"
          >
            <div class="flex flex-wrap items-center gap-2">
              <input
                id="file-manual-path"
                v-model="storagePath"
                type="text"
                placeholder="/route.zip"
                :disabled="isSaving"
                class="flex-1 min-w-[220px] max-w-[440px] h-8 px-2.5 text-[13px] font-mono bg-background border border-input focus:border-primary focus:outline-none"
                :class="storagePathError ? 'border-destructive focus:border-destructive' : ''"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                class="rounded-none h-8 cursor-pointer"
                :disabled="isSaving"
                @click="pickerOpen = true"
              >
                <FolderOpen class="size-3.5" />
                <span>{{ t('packageEdit.versions.pickFileButton') }}</span>
              </Button>
            </div>
          </FormRow>

          <FormRow
            :label="t('packageEdit.versions.manualSizeLabel')"
            html-for="file-manual-size"
            required
            :error="fileSizeError"
          >
            <input
              id="file-manual-size"
              v-model="fileSize"
              type="text"
              placeholder="72.10 MB"
              :disabled="isSaving"
              class="w-full max-w-[200px] h-8 px-2.5 text-[13px] font-mono bg-background border border-input focus:border-primary focus:outline-none"
              :class="fileSizeError ? 'border-destructive focus:border-destructive' : ''"
            />
          </FormRow>
        </template>

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
            :disabled="isSaving"
          >
            <Loader2 v-if="isSaving" class="size-3.5 animate-spin" />
            <Save v-else class="size-3.5" />
            <span>
              {{
                isSaving
                  ? t('common.saving')
                  : isCreateMode
                    ? t('packageEdit.versions.createSubmit')
                    : t('common.save')
              }}
            </span>
          </Button>
        </template>
      </FormPanel>
    </form>

    <!-- FileCarton Picker 对话框 -->
    <FileCartonPickerDialog
      v-model:open="pickerOpen"
      @select="handlePickerSelect"
    />

    <!-- 编辑已验证文件二次确认 -->
    <Dialog v-model:open="revalidateWarningOpen">
      <DialogContent class="max-w-md rounded-none">
        <DialogHeader>
          <DialogTitle class="text-base">{{ t('packageEdit.versions.revalidateConfirmTitle') }}</DialogTitle>
          <DialogDescription class="text-sm leading-relaxed">
            {{ t('packageEdit.versions.validatedEditHint') }}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            class="rounded-none cursor-pointer"
            :disabled="isSaving"
            @click="revalidateWarningOpen = false"
          >
            {{ t('common.cancel') }}
          </Button>
          <Button
            type="button"
            size="sm"
            class="rounded-none cursor-pointer"
            :disabled="isSaving"
            @click="performSave"
          >
            <Loader2 v-if="isSaving" class="size-3.5 animate-spin" />
            <span>{{ t('common.confirm') }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
