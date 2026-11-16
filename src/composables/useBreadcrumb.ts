import { ref, onUnmounted } from 'vue'

export interface BreadcrumbItemData {
  label: string
  to?: string
}

const customItems = ref<BreadcrumbItemData[] | null>(null)
const rightSummary = ref<string>('')

export function useBreadcrumbState() {
  function setBreadcrumb(items: BreadcrumbItemData[] | null, summary = '') {
    customItems.value = items
    rightSummary.value = summary
  }

  function setSummary(summary: string) {
    rightSummary.value = summary
  }

  function resetBreadcrumb() {
    customItems.value = null
    rightSummary.value = ''
  }

  return {
    customItems,
    rightSummary,
    setBreadcrumb,
    setSummary,
    resetBreadcrumb,
  }
}

export function usePageBreadcrumbCleanup() {
  const { resetBreadcrumb } = useBreadcrumbState()
  onUnmounted(() => {
    resetBreadcrumb()
  })
}
