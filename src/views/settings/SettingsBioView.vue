<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ChevronDown, ChevronRight, FileEdit } from '@lucide/vue'
import FormPanel from '@/components/form/FormPanel.vue'
import { useAuthStore } from '@/stores/auth'
import { useUploaderDetailQuery } from '@/queries/uploaders'
import { sanitizePackageHtml } from '@/utils/sanitize'
import { Button } from '@/components/ui/button'

const route = useRoute()
const { t } = useI18n()
const authStore = useAuthStore()

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
const sanitizedBio = computed(() =>
  sanitizePackageHtml(uploaderQuery.data.value?.Description),
)

const showPreview = ref(false)
</script>

<template>
  <FormPanel :title="t('settings.bio.panelTitle')">
    <div class="p-6 space-y-4">
      <div class="flex items-start gap-3">
        <FileEdit class="size-5 text-muted-foreground shrink-0 mt-0.5" />
        <div class="space-y-1.5">
          <h3 class="text-sm font-semibold text-foreground">
            {{ t('settings.bio.placeholderTitle') }}
          </h3>
        </div>
      </div>

      <div v-if="uploaderQuery.data.value" class="pt-2">
        <template v-if="sanitizedBio">
          <Button
            type="button"
            variant="outline"
            size="xs"
            class="rounded-none cursor-pointer"
            @click="showPreview = !showPreview"
          >
            <ChevronDown v-if="showPreview" class="size-3.5" />
            <ChevronRight v-else class="size-3.5" />
            <span>{{ t('settings.bio.currentPreviewToggle') }}</span>
          </Button>

          <div
            v-if="showPreview"
            class="mt-3 border border-border bg-muted/20 p-4 prose prose-sm max-w-none package-prose"
            v-html="sanitizedBio"
          />
        </template>

        <p v-else class="text-xs text-muted-foreground">
          {{ t('settings.bio.emptySavedBio') }}
        </p>
      </div>
    </div>
  </FormPanel>
</template>
