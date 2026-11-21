import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { parsePositiveIntParam } from '@/utils/format'

/**
 * 设置页公用：根据 `?uid=` 与权限解析目标用户 ID。
 *
 * - 管理员（privilege ≥ 50）且 query 带有效 uid → 编辑他人
 * - 否则 → 当前登录用户
 */
export function useSettingsTarget() {
  const route = useRoute()
  const authStore = useAuthStore()

  const targetUserId = computed<number | null>(() => {
    if (authStore.privilege >= 50) {
      const parsed = parsePositiveIntParam(route.query.uid)
      if (parsed) return parsed
    }
    return authStore.currentUserId
  })

  const isEditingOther = computed(
    () =>
      targetUserId.value !== null &&
      authStore.privilege >= 50 &&
      targetUserId.value !== authStore.currentUserId,
  )

  const uidQuery = computed(() =>
    isEditingOther.value && targetUserId.value
      ? { uid: String(targetUserId.value) }
      : undefined,
  )

  return { targetUserId, isEditingOther, uidQuery }
}
