<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDebounceFn } from '@vueuse/core'
import { RotateCcw, Search, X } from '@lucide/vue'
import type { PlatformFilter } from '@/api/packages'
import { PLATFORMS } from '@/config/platforms'
import { usePreferencesStore } from '@/stores/preferences'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

interface Props {
  platform: PlatformFilter
  keyword: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:platform': [value: PlatformFilter]
  'update:keyword': [value: string]
  reset: []
}>()

const { t } = useI18n()
const preferences = usePreferencesStore()

const draftKeyword = ref(props.keyword)

watch(
  () => props.keyword,
  (val) => {
    if (val !== draftKeyword.value) {
      draftKeyword.value = val
    }
  },
)

const commitSearchDebounced = useDebounceFn((value: string) => {
  emit('update:keyword', value.trim())
}, 320)

function handleInput(e: Event) {
  const value = (e.target as HTMLInputElement).value
  draftKeyword.value = value
  commitSearchDebounced(value)
}

function submitImmediately() {
  emit('update:keyword', draftKeyword.value.trim())
}

function clearSearch() {
  draftKeyword.value = ''
  emit('update:keyword', '')
}

const platformOptions = computed<
  { value: PlatformFilter; label: string; color?: string }[]
>(() => [
  { value: '+', label: t('packages.platformDownloadable') },
  { value: 'hmmsim', label: PLATFORMS.hmmsim.name, color: PLATFORMS.hmmsim.color },
  { value: 'openbve', label: PLATFORMS.openbve.name, color: PLATFORMS.openbve.color },
  { value: 'all', label: t('packages.platformAll') },
])

const isDirty = computed(
  () => props.platform !== '+' || props.keyword.trim().length > 0,
)
</script>

<template>
  <div class="flex flex-col gap-5">
    <!-- 关键词检索 -->
    <section class="space-y-2">
      <label
        for="package-keyword-input"
        class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      >
        {{ t('packages.searchLabel') }}
      </label>
      <form class="relative" @submit.prevent="submitImmediately">
        <Search
          class="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
        />
        <input
          id="package-keyword-input"
          :value="draftKeyword"
          type="text"
          :placeholder="t('packages.searchPlaceholder')"
          class="w-full h-8 pl-8 pr-7 text-sm bg-background border border-input focus:border-primary focus:outline-none placeholder:text-muted-foreground/70"
          @input="handleInput"
        />
        <button
          v-if="draftKeyword"
          type="button"
          class="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground cursor-pointer"
          :aria-label="t('packages.searchClear')"
          @click="clearSearch"
        >
          <X class="size-3.5" />
        </button>
      </form>
    </section>

    <!-- 平台竖排单选 -->
    <section class="space-y-2">
      <div class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {{ t('packages.platformLabel') }}
      </div>
      <div role="radiogroup" :aria-label="t('packages.platformLabel')" class="space-y-0.5">
        <button
          v-for="opt in platformOptions"
          :key="opt.value"
          type="button"
          role="radio"
          :aria-checked="platform === opt.value"
          class="w-full px-2.5 py-1.5 flex items-center justify-between gap-2 text-left text-sm transition-colors cursor-pointer"
          :class="
            platform === opt.value
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-foreground/85 hover:bg-muted/80 hover:text-foreground'
          "
          @click="emit('update:platform', opt.value)"
        >
          <span class="flex items-center gap-2 min-w-0">
            <span
              v-if="opt.color"
              class="size-2.5 shrink-0"
              :style="{ backgroundColor: opt.color }"
              aria-hidden="true"
            />
            <span
              v-else
              class="size-2.5 border shrink-0"
              :class="platform === opt.value ? 'border-primary bg-primary' : 'border-muted-foreground/40'"
              aria-hidden="true"
            />
            <span class="truncate">{{ opt.label }}</span>
          </span>
        </button>
      </div>
    </section>

    <Separator />

    <!-- 显示设置 -->
    <section class="space-y-2.5">
      <div class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {{ t('packages.displayOptions') }}
      </div>
      <label class="flex items-center justify-between gap-3 cursor-pointer select-none">
        <span class="text-sm text-foreground/90 leading-snug">
          {{ t('nav.englishNames') }}
        </span>
        <Switch
          :model-value="preferences.preferEnglishName"
          @update:model-value="(v) => preferences.setEnglishName(Boolean(v))"
        />
      </label>
      <p class="text-xs text-muted-foreground leading-relaxed">
        {{ t('packages.preferEnglishDesc') }}
      </p>
    </section>

    <!-- 重置按钮 -->
    <template v-if="isDirty">
      <Separator />
      <Button
        variant="outline"
        size="sm"
        class="w-full rounded-none text-xs cursor-pointer"
        @click="emit('reset')"
      >
        <RotateCcw class="size-3.5" />
        <span>{{ t('packages.resetFilters') }}</span>
      </Button>
    </template>
  </div>
</template>
