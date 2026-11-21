<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from '@lucide/vue'
import PlatformBadge from '@/components/package/PlatformBadge.vue'
import { usePreferencesStore } from '@/stores/preferences'
import { usePackageCacheActions, usePackageDetailQuery } from '@/queries/packages'
import { useFileCacheActions } from '@/queries/files'
import { deleteFile } from '@/api/files'
import { formatApiErrorMessage } from '@/api/auth'
import { buildWikiDocUrl } from '@/api/portal'
import { sortPackageFiles } from '@/utils/package'
import type { PackageFile } from '@/types/models'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const route = useRoute()
const { t, te } = useI18n()
const preferences = usePreferencesStore()
const { invalidatePackage, invalidatePackageLists } = usePackageCacheActions()
const { invalidateFiles } = useFileCacheActions()

const packageId = computed<number | null>(() => {
  const raw = String(route.params.id ?? '')
  const num = Number.parseInt(raw, 10)
  return Number.isInteger(num) && num > 0 ? num : null
})

const packageQuery = usePackageDetailQuery(packageId)

const sortedFiles = computed(() =>
  sortPackageFiles(packageQuery.data.value?.Files ?? []),
)

const fileFieldsDocUrl = computed(() =>
  buildWikiDocUrl(preferences.locale, 'filefields'),
)

const deleteTarget = ref<PackageFile | null>(null)
const isDeleting = ref(false)
const deleteError = ref('')

function openDeleteConfirm(file: PackageFile) {
  deleteTarget.value = file
  deleteError.value = ''
}

async function confirmDeleteFile() {
  if (!deleteTarget.value || !packageId.value || isDeleting.value) return
  isDeleting.value = true
  deleteError.value = ''
  const fileId = deleteTarget.value.ID
  const pkgId = packageId.value
  try {
    await deleteFile(fileId)
    deleteTarget.value = null
    await invalidatePackage(pkgId)
    await invalidatePackageLists()
    await invalidateFiles()
  } catch (err) {
    deleteError.value = formatApiErrorMessage(err, t, te)
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- 顶部操作栏 -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3 text-sm text-muted-foreground">
        <span class="font-semibold text-foreground text-sm">
          {{ t('packageEdit.versions.listTitle') }}
        </span>
        <span class="tabular-nums">({{ sortedFiles.length }})</span>
        <a
          :href="fileFieldsDocUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1 text-primary hover:underline underline-offset-4"
        >
          <span>{{ t('settings.profile.namingGuideLink') }}</span>
          <ExternalLink class="size-3" />
        </a>
      </div>

      <Button as-child size="sm" class="rounded-none">
        <router-link :to="`/packages/${packageId}/edit/versions/new`">
          <Plus class="size-3.5" />
          <span>{{ t('packageEdit.versions.addButton') }}</span>
        </router-link>
      </Button>
    </div>

    <!-- 按需更新警告提示 -->
    <div
      v-if="sortedFiles.length > 0"
      class="border border-amber-500/35 bg-amber-500/8 px-3.5 py-2.5 flex items-start gap-2 text-sm text-amber-950 dark:text-amber-200 leading-relaxed"
    >
      <AlertTriangle class="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <span>{{ t('packageEdit.versions.keepOldVersionNotice') }}</span>
    </div>

    <!-- 空状态 -->
    <div
      v-if="sortedFiles.length === 0"
      class="border border-dashed border-border py-12 px-6 text-center space-y-3"
    >
      <p class="text-sm text-muted-foreground">
        {{ t('packageEdit.versions.emptyList') }}
      </p>
      <Button as-child variant="outline" size="sm" class="rounded-none">
        <router-link :to="`/packages/${packageId}/edit/versions/new`">
          <Plus class="size-3.5" />
          <span>{{ t('packageEdit.versions.addButton') }}</span>
        </router-link>
      </Button>
    </div>

    <!-- 统一版本表格 -->
    <div v-else class="border border-border overflow-x-auto bg-card">
      <table class="w-full text-left border-collapse text-sm">
        <thead>
          <tr class="bg-muted/45 border-b border-border text-xs sm:text-sm font-semibold text-muted-foreground">
            <th scope="col" class="py-2.5 px-3.5 whitespace-nowrap">
              {{ t('detail.tableHeaders.version') }}
            </th>
            <th scope="col" class="py-2.5 px-3.5 whitespace-nowrap">
              {{ t('detail.tableHeaders.platform') }}
            </th>
            <th scope="col" class="py-2.5 px-3.5 whitespace-nowrap">
              {{ t('detail.tableHeaders.size') }}
            </th>
            <th scope="col" class="py-2.5 px-3.5 whitespace-nowrap">
              {{ t('detail.tableHeaders.status') }}
            </th>
            <th scope="col" class="py-2.5 px-3.5 text-right whitespace-nowrap w-24">
              {{ t('packageEdit.versions.actionsHeader') }}
            </th>
          </tr>
        </thead>

        <tbody class="divide-y divide-border">
          <tr
            v-for="file in sortedFiles"
            :key="file.ID"
            class="hover:bg-muted/35 transition-colors"
          >
            <td class="py-2.5 px-3.5 whitespace-nowrap font-mono font-semibold text-foreground tabular-nums">
              v{{ file.Version }}
            </td>

            <td class="py-2.5 px-3.5 whitespace-nowrap">
              <PlatformBadge :platforms="[file.Platform]" variant="label" />
            </td>

            <td class="py-2.5 px-3.5 text-xs sm:text-sm text-muted-foreground tabular-nums whitespace-nowrap">
              {{ file.Size }}
            </td>

            <td class="py-2.5 px-3.5 text-xs sm:text-sm">
              <span
                v-if="file.NeedValidation && !file.Validated && file.RejectReason"
                class="inline-flex items-center gap-1.5 text-destructive"
              >
                <AlertCircle class="size-3.5 shrink-0" />
                <span>{{ `${t('common.rejected')}: ${file.RejectReason}` }}</span>
              </span>
              <span
                v-else-if="file.NeedValidation && !file.Validated"
                class="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400"
              >
                <Clock class="size-3.5 shrink-0" />
                <span>{{ t('common.validationPending') }}</span>
              </span>
              <span
                v-else
                class="inline-flex items-center gap-1.5 text-muted-foreground"
              >
                <CheckCircle2 class="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{{ t('common.validated') }}</span>
              </span>
            </td>

            <td class="py-2 px-3.5 text-right whitespace-nowrap">
              <div class="inline-flex items-center justify-end gap-1">
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      as-child
                      variant="ghost"
                      size="icon-sm"
                      class="rounded-none text-foreground/80 hover:text-primary hover:bg-primary/10"
                    >
                      <router-link
                        :to="`/packages/${packageId}/edit/versions/${file.ID}`"
                        :aria-label="t('packageEdit.versions.editAction')"
                      >
                        <Pencil class="size-3.5" />
                      </router-link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {{ t('packageEdit.versions.editAction') }}
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      class="rounded-none text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                      :aria-label="t('packageEdit.versions.deleteAction')"
                      @click="openDeleteConfirm(file)"
                    >
                      <Trash2 class="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {{ t('packageEdit.versions.deleteAction') }}
                  </TooltipContent>
                </Tooltip>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 删除文件确认框 -->
    <Dialog
      :open="Boolean(deleteTarget)"
      @update:open="(v: boolean) => { if (!v && !isDeleting) deleteTarget = null }"
    >
      <DialogContent
        class="max-w-md rounded-none"
        :show-close-button="!isDeleting"
        @interact-outside="(e: Event) => { if (isDeleting) e.preventDefault() }"
        @escape-key-down="(e: Event) => { if (isDeleting) e.preventDefault() }"
      >
        <DialogHeader>
          <DialogTitle class="text-base">{{ t('packageEdit.versions.deleteConfirmTitle') }}</DialogTitle>
          <DialogDescription class="text-sm leading-relaxed">
            {{
              deleteTarget
                ? t('packageEdit.versions.deleteConfirmDesc', { version: deleteTarget.Version })
                : ''
            }}
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
            @click="deleteTarget = null"
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
  </div>
</template>
