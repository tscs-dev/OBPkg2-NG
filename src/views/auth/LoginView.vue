<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useQueryClient } from '@tanstack/vue-query'
import { AlertCircle, Eye, EyeOff, Loader2, LogIn } from '@lucide/vue'
import FormPanel from '@/components/form/FormPanel.vue'
import FormRow from '@/components/form/FormRow.vue'
import { loginApi, setupSessionFromToken, formatApiErrorMessage } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { resolveSafeRedirect } from '@/router'
import { Button } from '@/components/ui/button'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const route = useRoute()
const router = useRouter()
const { t, te } = useI18n()
const authStore = useAuthStore()
const queryClient = useQueryClient()
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const submittedOnce = ref(false)
const isSubmitting = ref(false)
const serverError = ref('')

const isExpiredRedirect = computed(() => route.query.reason === 'expired')

// 登录页已有自己的过期横幅，清掉顶栏的重复提示
if (isExpiredRedirect.value) {
  authStore.dismissExpiredNotice()
}

const emailError = computed(() => {
  if (!submittedOnce.value) return null
  const val = email.value.trim()
  if (!val) return t('validation.required')
  if (!EMAIL_REGEX.test(val)) return t('validation.emailInvalid')
  return null
})

const passwordError = computed(() => {
  if (!submittedOnce.value) return null
  if (!password.value) return t('validation.required')
  return null
})

async function handleSubmit() {
  submittedOnce.value = true
  serverError.value = ''

  if (emailError.value || passwordError.value || isSubmitting.value) {
    return
  }

  isSubmitting.value = true
  const target = resolveSafeRedirect(route.query.redirect)
  try {
    const tokenRes = await loginApi({
      username: email.value.trim(),
      password: password.value,
    })
    await setupSessionFromToken(
      tokenRes.token, authStore, queryClient,
      () => router.currentRoute.value.name === 'login',
    )
    if (router.currentRoute.value.name === 'login') {
      await router.replace(target)
    }
  } catch (err) {
    serverError.value = formatApiErrorMessage(err, t, te)
  } finally {
    isSubmitting.value = false
  }
}

</script>

<template>
  <div class="max-w-[440px] mx-auto px-4 py-10 sm:py-14">
    <div
      v-if="isExpiredRedirect"
      role="status"
      class="mb-4 border border-amber-500/35 bg-amber-500/8 px-3.5 py-2.5 flex items-start gap-2 text-sm text-amber-950 dark:text-amber-200 leading-relaxed"
    >
      <AlertCircle class="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <span>{{ t('auth.loginExpiredHint') }}</span>
    </div>

    <form novalidate @submit.prevent="handleSubmit">
      <FormPanel
        :title="t('auth.loginTitle')"
        :description="t('auth.loginSubtitle')"
      >
        <div
          v-if="serverError"
          role="alert"
          class="px-4 py-2.5 bg-destructive/8 text-destructive text-sm flex items-start gap-2 leading-relaxed"
        >
          <AlertCircle class="size-4 shrink-0 mt-0.5" />
          <span>{{ serverError }}</span>
        </div>

        <FormRow
          :label="t('auth.emailLabel')"
          html-for="login-email"
          required
          stacked
          :error="emailError"
        >
          <input
            id="login-email"
            v-model="email"
            type="email"
            autocomplete="username"
            :placeholder="t('auth.emailPlaceholder')"
            class="w-full h-8 px-2.5 text-[13px] bg-background border border-input focus:border-primary focus:outline-none"
            :class="emailError ? 'border-destructive focus:border-destructive' : ''"
          />
        </FormRow>

        <FormRow
          :label="t('auth.passwordLabel')"
          html-for="login-password"
          required
          stacked
          :error="passwordError"
        >
          <div class="relative">
            <input
              id="login-password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
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

        <template #footer>
          <Button
            type="submit"
            size="sm"
            class="w-full rounded-none cursor-pointer"
            :disabled="isSubmitting"
          >
            <Loader2 v-if="isSubmitting" class="size-3.5 animate-spin" />
            <LogIn v-else class="size-3.5" />
            <span>{{ isSubmitting ? t('auth.loggingIn') : t('auth.loginSubmit') }}</span>
          </Button>
        </template>
      </FormPanel>
    </form>

    <p class="mt-4 text-center text-sm text-muted-foreground">
      <span>{{ t('auth.noAccountPrompt') }}</span>
      <router-link
        :to="{ name: 'register', query: route.query.redirect ? { redirect: route.query.redirect } : undefined }"
        class="ml-1.5 font-medium text-primary hover:underline underline-offset-4"
      >
        {{ t('auth.goRegister') }}
      </router-link>
    </p>
  </div>
</template>
