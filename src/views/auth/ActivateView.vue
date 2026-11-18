<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useQueryClient } from '@tanstack/vue-query'
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, UserCheck } from '@lucide/vue'
import FormPanel from '@/components/form/FormPanel.vue'
import FormRow from '@/components/form/FormRow.vue'
import String3Fields from '@/components/form/String3Fields.vue'
import {
  activateAccountApi,
  checkActivationTokenApi,
  formatApiErrorMessage,
  loginApi,
} from '@/api/auth'
import { bareApiClient } from '@/api/client'
import { decodeJwtPayload, useAuthStore } from '@/stores/auth'
import { uploaderKeys } from '@/queries/uploaders'
import { hasTrimIssues, isString3Valid, normalizeString3ForSubmit, validateString3 } from '@/utils/string3'
import { useBreadcrumbState, usePageBreadcrumbCleanup } from '@/composables/useBreadcrumb'
import type { String3, UploaderDetail } from '@/types/models'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const route = useRoute()
const router = useRouter()
const { t, te } = useI18n()
const authStore = useAuthStore()
const queryClient = useQueryClient()
const { setBreadcrumb } = useBreadcrumbState()
usePageBreadcrumbCleanup()

const tokenParam = computed(() => String(route.params.token ?? ''))

const checking = ref(true)
const tokenError = ref('')
const verifiedEmail = ref('')

const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const nameS3 = ref<String3>({ Local: '', English: '', Tag: '' })

const submittedOnce = ref(false)
const isSubmitting = ref(false)
const submitError = ref('')

const passwordError = computed(() => {
  if (!submittedOnce.value) return null
  if (!password.value) return t('validation.required')
  if (hasTrimIssues(password.value)) return t('validation.noLeadingTrailingSpace')
  if (password.value.length < 6) return t('validation.passwordMinLength', { min: 6 })
  return null
})

const confirmPasswordError = computed(() => {
  if (!submittedOnce.value) return null
  if (!confirmPassword.value) return t('validation.required')
  if (confirmPassword.value !== password.value) return t('validation.passwordMismatch')
  return null
})

const s3Errors = computed(() => validateString3(nameS3.value, (key) => t(key)))

async function verifyToken(token: string) {
  checking.value = true
  tokenError.value = ''
  verifiedEmail.value = ''

  if (!token) {
    tokenError.value = t('auth.activateExpiredDesc')
    checking.value = false
    return
  }

  try {
    const res = await checkActivationTokenApi(token)
    verifiedEmail.value = res.Email
  } catch (err) {
    tokenError.value = formatApiErrorMessage(err, t, te)
  } finally {
    checking.value = false
  }
}

watch(
  tokenParam,
  (val) => {
    void verifyToken(val)
  },
  { immediate: true },
)

async function handleSubmit() {
  submittedOnce.value = true
  submitError.value = ''

  if (
    passwordError.value ||
    confirmPasswordError.value ||
    !isString3Valid(s3Errors.value) ||
    isSubmitting.value
  ) {
    return
  }

  isSubmitting.value = true
  try {
    await activateAccountApi({
      Token: tokenParam.value,
      Password: password.value,
      Name: normalizeString3ForSubmit(nameS3.value),
    })

    // 激活成功后自动登录
    const tokenRes = await loginApi({
      username: verifiedEmail.value,
      password: password.value,
    })

    const payload = decodeJwtPayload(tokenRes.token)
    if (payload?.uid) {
      const uploader = await bareApiClient<UploaderDetail>(`/uploaders/${payload.uid}`, {
        headers: {
          Authorization: `Bearer ${tokenRes.token}`,
        },
      })
      authStore.setSession(tokenRes.token, uploader)
      queryClient.setQueryData(uploaderKeys.detail(payload.uid), uploader)
    }

    await router.replace({ name: 'settings-profile' })
  } catch (err) {
    submitError.value = formatApiErrorMessage(err, t, te)
  } finally {
    isSubmitting.value = false
  }
}

watchEffect(() => {
  setBreadcrumb(
    [
      { label: t('nav.home'), to: '/' },
      { label: t('auth.activateTitle') },
    ],
    '',
  )
})
</script>

<template>
  <div class="max-w-[460px] mx-auto px-4 py-10 sm:py-14">
    <!-- 校验中 -->
    <FormPanel v-if="checking" :title="t('auth.activateTitle')">
      <div class="p-4 space-y-3">
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 class="size-3.5 animate-spin text-primary" />
          <span>{{ t('auth.activateChecking') }}</span>
        </div>
        <Skeleton class="h-8 w-full rounded-none" />
        <Skeleton class="h-8 w-full rounded-none" />
        <Skeleton class="h-8 w-2/3 rounded-none" />
      </div>
    </FormPanel>

    <!-- 链接无效或已过期 -->
    <FormPanel
      v-else-if="tokenError"
      :title="t('auth.activateExpiredTitle')"
    >
      <div class="p-4 space-y-3 text-sm leading-relaxed">
        <div class="flex items-start gap-2.5 text-destructive">
          <AlertCircle class="size-4 shrink-0 mt-0.5" />
          <span>{{ tokenError }}</span>
        </div>
        <p class="text-muted-foreground">
          {{ t('auth.activateExpiredDesc') }}
        </p>
      </div>

      <template #footer>
        <Button as-child size="sm" class="w-full rounded-none">
          <router-link to="/auth/register">{{ t('auth.activateResendButton') }}</router-link>
        </Button>
      </template>
    </FormPanel>

    <!-- 校验通过：填写密码与显示名称 -->
    <form v-else novalidate @submit.prevent="handleSubmit">
      <FormPanel :title="t('auth.activateTitle')">
        <div class="px-4 py-2.5 bg-emerald-500/8 flex items-center justify-between gap-2 text-sm">
          <span class="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
            <CheckCircle2 class="size-3.5 shrink-0" />
            <span>{{ t('auth.activateVerifiedEmail') }}</span>
          </span>
          <span class="font-mono text-foreground truncate">{{ verifiedEmail }}</span>
        </div>

        <div
          v-if="submitError"
          role="alert"
          class="px-4 py-2.5 bg-destructive/8 text-destructive text-sm flex items-start gap-2 leading-relaxed"
        >
          <AlertCircle class="size-4 shrink-0 mt-0.5" />
          <span>{{ submitError }}</span>
        </div>

        <FormRow
          :label="t('auth.activatePasswordLabel')"
          html-for="activate-password"
          required
          stacked
          :hint="t('auth.activatePasswordHint')"
          :error="passwordError"
        >
          <div class="relative">
            <input
              id="activate-password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="new-password"
              class="w-full h-8 pl-2.5 pr-8 text-[13px] bg-background border border-input focus:border-primary focus:outline-none"
              :class="passwordError ? 'border-destructive focus:border-destructive' : ''"
            />
            <button
              type="button"
              class="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground cursor-pointer"
              :aria-label="showPassword ? t('auth.hidePassword') : t('auth.showPassword')"
              @click="showPassword = !showPassword"
            >
              <EyeOff v-if="showPassword" class="size-3.5" />
              <Eye v-else class="size-3.5" />
            </button>
          </div>
        </FormRow>

        <FormRow
          :label="t('auth.activateConfirmPasswordLabel')"
          html-for="activate-confirm-password"
          required
          stacked
          :error="confirmPasswordError"
        >
          <input
            id="activate-confirm-password"
            v-model="confirmPassword"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="new-password"
            class="w-full h-8 px-2.5 text-[13px] bg-background border border-input focus:border-primary focus:outline-none"
            :class="confirmPasswordError ? 'border-destructive focus:border-destructive' : ''"
          />
        </FormRow>

        <String3Fields
          v-model="nameS3"
          id-prefix="activate-s3"
          stacked
          :show-errors="submittedOnce"
        />

        <template #footer>
          <Button
            type="submit"
            size="sm"
            class="w-full rounded-none cursor-pointer"
            :disabled="isSubmitting"
          >
            <Loader2 v-if="isSubmitting" class="size-3.5 animate-spin" />
            <UserCheck v-else class="size-3.5" />
            <span>{{ isSubmitting ? t('auth.activating') : t('auth.activateSubmit') }}</span>
          </Button>
        </template>
      </FormPanel>
    </form>
  </div>
</template>
