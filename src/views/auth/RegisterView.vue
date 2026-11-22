<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { AlertCircle, CheckCircle2, Loader2, Mail } from '@lucide/vue'
import FormPanel from '@/components/form/FormPanel.vue'
import FormRow from '@/components/form/FormRow.vue'
import { registerApi, formatApiErrorMessage } from '@/api/auth'
import { normalizeApiError } from '@/api/client'
import { formatLocalTimestamp } from '@/utils/date'
import { Button } from '@/components/ui/button'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const route = useRoute()
const { t, te } = useI18n()

const loginRoute = computed(() => {
  const redirect = route.query.redirect
  return redirect
    ? { name: 'login' as const, query: { redirect } }
    : { name: 'login' as const }
})

const email = ref('')
const submittedOnce = ref(false)
const isSubmitting = ref(false)
const serverError = ref('')
const showGoLoginHint = ref(false)
const sentExpiry = ref<string | null>(null)
const sentEmail = ref('')

const emailError = computed(() => {
  if (!submittedOnce.value) return null
  const val = email.value.trim()
  if (!val) return t('validation.required')
  if (!EMAIL_REGEX.test(val)) return t('validation.emailInvalid')
  return null
})

async function handleSubmit() {
  submittedOnce.value = true
  serverError.value = ''
  showGoLoginHint.value = false

  if (emailError.value || isSubmitting.value) return

  isSubmitting.value = true
  const trimmedEmail = email.value.trim()
  try {
    const res = await registerApi({ Email: trimmedEmail })
    sentEmail.value = trimmedEmail
    sentExpiry.value = res.Expiry
  } catch (err) {
    const apiErr = normalizeApiError(err)
    showGoLoginHint.value = apiErr.code === 205
    serverError.value = formatApiErrorMessage(err, t, te)
  } finally {
    isSubmitting.value = false
  }
}

</script>

<template>
  <div class="max-w-[440px] mx-auto px-4 py-10 sm:py-14">
    <!-- 发送成功态 -->
    <FormPanel
      v-if="sentExpiry"
      :title="t('auth.registerSuccessTitle')"
    >
      <div class="p-4 space-y-3 text-sm leading-relaxed">
        <div class="flex items-start gap-2.5 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 class="size-4 shrink-0 mt-0.5" />
          <p class="font-medium text-foreground">
            {{ t('auth.registerSuccessDesc', { email: sentEmail }) }}
          </p>
        </div>

        <dl class="border border-border bg-muted/30 px-3 py-2 space-y-1">
          <dt class="text-[11px] text-muted-foreground">{{ t('auth.registerExpiryLabel') }}</dt>
          <dd class="font-mono text-foreground tabular-nums">
            {{ formatLocalTimestamp(sentExpiry) }}
          </dd>
        </dl>

        <p class="text-muted-foreground">
          {{ t('auth.registerCanCloseHint') }}
        </p>
      </div>

      <template #footer>
        <Button as-child variant="outline" size="sm" class="w-full rounded-none">
          <router-link :to="loginRoute">{{ t('auth.goLogin') }}</router-link>
        </Button>
      </template>
    </FormPanel>

    <!-- 填写态 -->
    <form v-else novalidate @submit.prevent="handleSubmit">
      <FormPanel
        :title="t('auth.registerTitle')"
        :description="t('auth.registerSubtitle')"
      >
        <div
          v-if="serverError"
          role="alert"
          class="px-4 py-2.5 bg-destructive/8 text-destructive text-sm space-y-1.5 leading-relaxed"
        >
          <div class="flex items-start gap-2">
            <AlertCircle class="size-4 shrink-0 mt-0.5" />
            <span>{{ serverError }}</span>
          </div>
          <div v-if="showGoLoginHint" class="pl-6">
            <router-link
              :to="loginRoute"
              class="font-medium text-primary hover:underline underline-offset-4"
            >
              {{ t('auth.goLogin') }}
            </router-link>
          </div>
        </div>

        <FormRow
          :label="t('auth.emailLabel')"
          html-for="register-email"
          required
          stacked
          :error="emailError"
        >
          <input
            id="register-email"
            v-model="email"
            type="email"
            autocomplete="email"
            :placeholder="t('auth.emailPlaceholder')"
            class="w-full h-8 px-2.5 text-[13px] bg-background border border-input focus:border-primary focus:outline-none"
            :class="emailError ? 'border-destructive focus:border-destructive' : ''"
          />
        </FormRow>

        <template #footer>
          <Button
            type="submit"
            size="sm"
            class="w-full rounded-none cursor-pointer"
            :disabled="isSubmitting"
          >
            <Loader2 v-if="isSubmitting" class="size-3.5 animate-spin" />
            <Mail v-else class="size-3.5" />
            <span>{{ isSubmitting ? t('auth.registerSending') : t('auth.registerSubmit') }}</span>
          </Button>
        </template>
      </FormPanel>
    </form>

    <p v-if="!sentExpiry" class="mt-4 text-center text-sm text-muted-foreground">
      <span>{{ t('auth.hasAccountPrompt') }}</span>
      <router-link
        :to="loginRoute"
        class="ml-1.5 font-medium text-primary hover:underline underline-offset-4"
      >
        {{ t('auth.goLogin') }}
      </router-link>
    </p>
  </div>
</template>
