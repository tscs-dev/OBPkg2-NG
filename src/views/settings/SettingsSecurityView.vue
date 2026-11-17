<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from '@lucide/vue'
import FormPanel from '@/components/form/FormPanel.vue'
import FormRow from '@/components/form/FormRow.vue'
import { changePasswordApi, formatApiErrorMessage } from '@/api/auth'
import { hasTrimIssues } from '@/utils/string3'
import { Button } from '@/components/ui/button'

const { t, te } = useI18n()

const previousPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const showPasswords = ref(false)

const submittedOnce = ref(false)
const isSaving = ref(false)
const saveError = ref('')
const saveSuccess = ref(false)

const prevError = computed(() => {
  if (!submittedOnce.value) return null
  if (!previousPassword.value) return t('validation.required')
  return null
})

const newPwdError = computed(() => {
  if (!submittedOnce.value) return null
  if (!newPassword.value) return t('validation.required')
  if (hasTrimIssues(newPassword.value)) return t('validation.noLeadingTrailingSpace')
  if (newPassword.value.length < 6) return t('validation.passwordMinLength', { min: 6 })
  return null
})

const confirmError = computed(() => {
  if (!submittedOnce.value) return null
  if (!confirmPassword.value) return t('validation.required')
  if (confirmPassword.value !== newPassword.value) return t('validation.passwordMismatch')
  return null
})

async function handleSubmit() {
  if (isSaving.value) return
  submittedOnce.value = true
  saveError.value = ''
  saveSuccess.value = false

  if (prevError.value || newPwdError.value || confirmError.value) {
    return
  }

  isSaving.value = true
  try {
    await changePasswordApi({
      PreviousPassword: previousPassword.value,
      NewPassword: newPassword.value,
    })

    previousPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    submittedOnce.value = false
    saveSuccess.value = true
  } catch (err) {
    saveError.value = formatApiErrorMessage(err, t, te)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <form novalidate @submit.prevent="handleSubmit">
    <FormPanel
      :title="t('settings.security.panelTitle')"
    >
      <template #header-extra>
        <button
          type="button"
          class="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
          @click="showPasswords = !showPasswords"
        >
          <EyeOff v-if="showPasswords" class="size-3.5" />
          <Eye v-else class="size-3.5" />
          <span>{{ showPasswords ? t('auth.hidePassword') : t('auth.showPassword') }}</span>
        </button>
      </template>

      <FormRow
        :label="t('settings.security.currentPasswordLabel')"
        html-for="sec-prev-password"
        required
        :error="prevError"
      >
        <input
          id="sec-prev-password"
          v-model="previousPassword"
          :type="showPasswords ? 'text' : 'password'"
          autocomplete="current-password"
          :disabled="isSaving"
          class="w-full max-w-[280px] h-8 px-2.5 text-[13px] bg-background border border-input focus:border-primary focus:outline-none disabled:opacity-60"
          :class="prevError ? 'border-destructive focus:border-destructive' : ''"
        />
      </FormRow>

      <FormRow
        :label="t('settings.security.newPasswordLabel')"
        html-for="sec-new-password"
        required
        :hint="t('settings.security.newPasswordHint')"
        :error="newPwdError"
      >
        <input
          id="sec-new-password"
          v-model="newPassword"
          :type="showPasswords ? 'text' : 'password'"
          autocomplete="new-password"
          :disabled="isSaving"
          class="w-full max-w-[280px] h-8 px-2.5 text-[13px] bg-background border border-input focus:border-primary focus:outline-none disabled:opacity-60"
          :class="newPwdError ? 'border-destructive focus:border-destructive' : ''"
        />
      </FormRow>

      <FormRow
        :label="t('settings.security.confirmPasswordLabel')"
        html-for="sec-confirm-password"
        required
        :error="confirmError"
      >
        <input
          id="sec-confirm-password"
          v-model="confirmPassword"
          :type="showPasswords ? 'text' : 'password'"
          autocomplete="new-password"
          :disabled="isSaving"
          class="w-full max-w-[280px] h-8 px-2.5 text-[13px] bg-background border border-input focus:border-primary focus:outline-none disabled:opacity-60"
          :class="confirmError ? 'border-destructive focus:border-destructive' : ''"
        />
      </FormRow>

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
            <span>{{ t('settings.security.saveSuccess') }}</span>
          </span>
        </div>

        <Button
          type="submit"
          size="sm"
          class="rounded-none cursor-pointer"
          :disabled="isSaving"
        >
          <Loader2 v-if="isSaving" class="size-3.5 animate-spin" />
          <KeyRound v-else class="size-3.5" />
          <span>{{ isSaving ? t('settings.security.submitting') : t('settings.security.submitButton') }}</span>
        </Button>
      </template>
    </FormPanel>
  </form>
</template>
