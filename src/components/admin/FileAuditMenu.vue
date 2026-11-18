<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Check,
  Download,
  ExternalLink,
  Loader2,
  MessageSquareWarning,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
} from '@lucide/vue'
import { useFileCacheActions } from '@/queries/files'
import { usePackageCacheActions } from '@/queries/packages'
import { deleteFile, updateFile } from '@/api/files'
import { formatApiErrorMessage } from '@/api/auth'
import type { PackageFile } from '@/types/models'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Props {
  file: PackageFile
  context?: 'admin-table' | 'version-form'
}

const props = withDefaults(defineProps<Props>(), {
  context: 'admin-table',
})

const emit = defineEmits<{
  updated: [file: PackageFile]
  deleted: [fileId: number]
}>()

const { t, te } = useI18n()
const { invalidateFiles } = useFileCacheActions()
const { invalidatePackage, invalidatePackageLists } = usePackageCacheActions()

const validateDialogOpen = ref(false)
const isValidating = ref(false)
const validateError = ref('')

const rejectDialogOpen = ref(false)
const rejectReasonDraft = ref('')
const isSavingReject = ref(false)
const rejectError = ref('')

const deleteDialogOpen = ref(false)
const isDeleting = ref(false)
const deleteError = ref('')

function openValidateConfirm() {
  validateError.value = ''
  validateDialogOpen.value = true
}

function openRejectDialog() {
  rejectReasonDraft.value = props.file.RejectReason ?? ''
  rejectError.value = ''
  rejectDialogOpen.value = true
}

function openDeleteDialog() {
  deleteError.value = ''
  deleteDialogOpen.value = true
}

async function confirmToggleValidation() {
  if (isValidating.value) return
  isValidating.value = true
  validateError.value = ''
  try {
    const updated = await updateFile(props.file.ID, {
      Validated: !props.file.Validated,
    })
    validateDialogOpen.value = false
    await invalidateFiles()
    await invalidatePackage(props.file.PackageID)
    await invalidatePackageLists()
    emit('updated', updated)
  } catch (err) {
    validateError.value = formatApiErrorMessage(err, t, te)
  } finally {
    isValidating.value = false
  }
}

async function confirmRejectReason() {
  if (isSavingReject.value) return
  isSavingReject.value = true
  rejectError.value = ''
  try {
    const updated = await updateFile(props.file.ID, {
      RejectReason: rejectReasonDraft.value.trim(),
    })
    rejectDialogOpen.value = false
    await invalidateFiles()
    await invalidatePackage(props.file.PackageID)
    emit('updated', updated)
  } catch (err) {
    rejectError.value = formatApiErrorMessage(err, t, te)
  } finally {
    isSavingReject.value = false
  }
}

async function confirmDeleteFile() {
  if (isDeleting.value) return
  isDeleting.value = true
  deleteError.value = ''
  try {
    await deleteFile(props.file.ID)
    deleteDialogOpen.value = false
    await invalidateFiles()
    await invalidatePackage(props.file.PackageID)
    await invalidatePackageLists()
    emit('deleted', props.file.ID)
  } catch (err) {
    deleteError.value = formatApiErrorMessage(err, t, te)
  } finally {
    isDeleting.value = false
  }
}

defineExpose({
  openValidateConfirm,
})
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        class="rounded-none cursor-pointer"
        :aria-label="t('adminFiles.actions.more')"
      >
        <MoreHorizontal class="size-4" />
      </Button>
    </DropdownMenuTrigger>

    <DropdownMenuContent align="end" class="w-48 rounded-none">
      <DropdownMenuItem
        class="rounded-none cursor-pointer"
        @click="openValidateConfirm"
      >
        <X v-if="file.Validated" class="size-3.5" />
        <Check v-else class="size-3.5" />
        <span>
          {{
            file.Validated
              ? t('adminFiles.actions.unvalidate')
              : t('adminFiles.actions.validate')
          }}
        </span>
      </DropdownMenuItem>

      <DropdownMenuItem
        class="rounded-none cursor-pointer"
        @click="openRejectDialog"
      >
        <MessageSquareWarning class="size-3.5" />
        <span>{{ t('adminFiles.actions.setRejectReason') }}</span>
      </DropdownMenuItem>

      <DropdownMenuItem
        v-if="context === 'version-form' && file.FetchURL"
        as-child
        class="rounded-none cursor-pointer"
      >
        <a :href="file.FetchURL" target="_blank" rel="noopener noreferrer">
          <Download class="size-3.5" />
          <span>{{ t('adminFiles.actions.downloadTest') }}</span>
        </a>
      </DropdownMenuItem>

      <template v-if="context === 'admin-table'">
        <DropdownMenuSeparator />

        <DropdownMenuItem as-child class="rounded-none cursor-pointer">
          <router-link :to="`/packages/${file.PackageID}/edit/versions/${file.ID}`">
            <Pencil class="size-3.5" />
            <span>{{ t('adminFiles.actions.editParams') }}</span>
          </router-link>
        </DropdownMenuItem>

        <DropdownMenuItem as-child class="rounded-none cursor-pointer">
          <router-link :to="`/packages/${file.PackageID}`">
            <ExternalLink class="size-3.5" />
            <span>{{ t('adminFiles.actions.viewPackage') }}</span>
          </router-link>
        </DropdownMenuItem>
      </template>

      <DropdownMenuSeparator />

      <DropdownMenuItem
        class="rounded-none text-destructive focus:text-destructive cursor-pointer"
        @click="openDeleteDialog"
      >
        <Trash2 class="size-3.5" />
        <span>{{ t('packageEdit.versions.deleteAction') }}</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

  <!-- 切换验证状态确认 -->
  <Dialog v-model:open="validateDialogOpen">
    <DialogContent class="max-w-md rounded-none">
      <DialogHeader>
        <DialogTitle class="text-base">{{ t('adminFiles.validateConfirmTitle') }}</DialogTitle>
        <DialogDescription class="text-sm leading-relaxed">
          {{ t('adminFiles.validateConfirmDesc') }}
        </DialogDescription>
      </DialogHeader>

      <p v-if="validateError" class="text-sm text-destructive" role="alert">
        {{ validateError }}
      </p>

      <DialogFooter class="gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          class="rounded-none cursor-pointer"
          :disabled="isValidating"
          @click="validateDialogOpen = false"
        >
          {{ t('common.cancel') }}
        </Button>
        <Button
          type="button"
          size="sm"
          class="rounded-none cursor-pointer"
          :disabled="isValidating"
          @click="confirmToggleValidation"
        >
          <Loader2 v-if="isValidating" class="size-3.5 animate-spin" />
          <span>{{ t('common.confirm') }}</span>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- 设置退回原因对话框 -->
  <Dialog v-model:open="rejectDialogOpen">
    <DialogContent class="max-w-md rounded-none">
      <DialogHeader>
        <DialogTitle class="text-base">{{ t('adminFiles.actions.setRejectReason') }}</DialogTitle>
        <DialogDescription class="text-sm leading-relaxed">
          {{ t('adminFiles.rejectDialogDesc') }}
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-2 py-1">
        <input
          v-model="rejectReasonDraft"
          type="text"
          class="w-full h-8 px-2.5 text-[13px] bg-background border border-input focus:border-primary focus:outline-none"
          @keydown.enter.prevent="confirmRejectReason"
        />
        <p v-if="rejectError" class="text-sm text-destructive" role="alert">
          {{ rejectError }}
        </p>
      </div>

      <DialogFooter class="gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          class="rounded-none cursor-pointer"
          :disabled="isSavingReject"
          @click="rejectDialogOpen = false"
        >
          {{ t('common.cancel') }}
        </Button>
        <Button
          type="button"
          size="sm"
          class="rounded-none cursor-pointer"
          :disabled="isSavingReject"
          @click="confirmRejectReason"
        >
          <Loader2 v-if="isSavingReject" class="size-3.5 animate-spin" />
          <span>{{ t('common.save') }}</span>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- 删除文件确认 -->
  <Dialog v-model:open="deleteDialogOpen">
    <DialogContent class="max-w-md rounded-none">
      <DialogHeader>
        <DialogTitle class="text-base">{{ t('packageEdit.versions.deleteConfirmTitle') }}</DialogTitle>
        <DialogDescription class="text-sm leading-relaxed">
          {{ t('packageEdit.versions.deleteConfirmDesc', { version: file.Version }) }}
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
          @click="confirmDeleteFile"
        >
          <Loader2 v-if="isDeleting" class="size-3.5 animate-spin" />
          <span>{{ t('packageEdit.versions.deleteAction') }}</span>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
