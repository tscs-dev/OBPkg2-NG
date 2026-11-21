import { ref, onBeforeUnmount, type Ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useI18n } from 'vue-i18n'

/**
 * 追踪表单脏状态，并在离开路由 / 关闭标签时弹出确认。
 *
 * - `isDirty`: 由调用方在表单值变化时设为 true，保存成功后 reset。
 * - `markDirty()` / `resetDirty()`: 便捷方法。
 * - `onBeforeRouteLeave` + `beforeunload` 双重拦截。
 */
export function useUnsavedChangesGuard(dirtyRef?: Ref<boolean>) {
  const isDirty = dirtyRef ?? ref(false)
  const { t } = useI18n()

  function markDirty() {
    isDirty.value = true
  }

  function resetDirty() {
    isDirty.value = false
  }

  onBeforeRouteLeave(() => {
    if (isDirty.value) {
      return window.confirm(t('common.unsavedChangesWarning'))
    }
  })

  function onBeforeUnloadHandler(e: BeforeUnloadEvent) {
    if (isDirty.value) {
      e.preventDefault()
    }
  }

  window.addEventListener('beforeunload', onBeforeUnloadHandler)
  onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', onBeforeUnloadHandler)
  })

  return { isDirty, markDirty, resetDirty }
}
