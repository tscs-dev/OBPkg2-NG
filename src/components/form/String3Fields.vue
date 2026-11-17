<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { String3 } from '@/types/models'
import { needsEnglishName, validateString3 } from '@/utils/string3'
import FormRow from './FormRow.vue'

interface Props {
  modelValue: String3
  idPrefix?: string
  showErrors?: boolean
  stacked?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  idPrefix: 's3',
  showErrors: false,
  stacked: false,
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: String3]
}>()

const { t } = useI18n()

const showEnglish = computed(() => needsEnglishName(props.modelValue.Local))

const errors = computed(() =>
  validateString3(props.modelValue, (key) => t(key)),
)

function updateField(field: keyof String3, val: string) {
  emit('update:modelValue', {
    ...props.modelValue,
    [field]: val,
  })
}
</script>

<template>
  <FormRow
    :label="t('form.s3.localLabel')"
    :html-for="`${idPrefix}-local`"
    required
    :hint="t('form.s3.localHint')"
    :error="showErrors ? errors.local : null"
    :stacked="stacked"
  >
    <input
      :id="`${idPrefix}-local`"
      :value="modelValue.Local"
      type="text"
      :disabled="disabled"
      class="w-full max-w-[340px] h-8 px-2.5 text-[13px] bg-background border border-input focus:border-primary focus:outline-none disabled:opacity-60"
      :class="showErrors && errors.local ? 'border-destructive focus:border-destructive' : ''"
      @input="updateField('Local', ($event.target as HTMLInputElement).value)"
    />
  </FormRow>

  <FormRow
    v-if="showEnglish"
    :label="t('form.s3.englishLabel')"
    :html-for="`${idPrefix}-english`"
    required
    :hint="t('form.s3.englishHint')"
    :error="showErrors ? errors.english : null"
    :stacked="stacked"
  >
    <input
      :id="`${idPrefix}-english`"
      :value="modelValue.English"
      type="text"
      :disabled="disabled"
      class="w-full max-w-[340px] h-8 px-2.5 text-[13px] bg-background border border-input focus:border-primary focus:outline-none disabled:opacity-60"
      :class="showErrors && errors.english ? 'border-destructive focus:border-destructive' : ''"
      @input="updateField('English', ($event.target as HTMLInputElement).value)"
    />
  </FormRow>

  <FormRow
    :label="t('form.s3.tagLabel')"
    :html-for="`${idPrefix}-tag`"
    :hint="t('form.s3.tagHint')"
    :error="showErrors ? errors.tag : null"
    :stacked="stacked"
  >
    <input
      :id="`${idPrefix}-tag`"
      :value="modelValue.Tag"
      type="text"
      :disabled="disabled"
      class="w-full max-w-[340px] h-8 px-2.5 text-[13px] bg-background border border-input focus:border-primary focus:outline-none disabled:opacity-60"
      :class="showErrors && errors.tag ? 'border-destructive focus:border-destructive' : ''"
      @input="updateField('Tag', ($event.target as HTMLInputElement).value)"
    />
  </FormRow>
</template>
