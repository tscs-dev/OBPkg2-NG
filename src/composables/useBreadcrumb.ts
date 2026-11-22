import { ref, computed, watch } from 'vue'
import { useRoute, type RouteLocationNormalizedLoaded } from 'vue-router'
import { useI18n } from 'vue-i18n'

export interface BreadcrumbItemData {
  label: string
  to?: string
  dynamic?: boolean
}

type BreadcrumbResolver = (
  route: RouteLocationNormalizedLoaded,
  t: (key: string) => string,
) => BreadcrumbItemData[]

function home(t: (k: string) => string): BreadcrumbItemData {
  return { label: t('nav.home'), to: '/' }
}

function packagesLink(t: (k: string) => string): BreadcrumbItemData {
  return { label: t('packages.breadcrumb'), to: '/packages' }
}

function packageEditResolver(route: RouteLocationNormalizedLoaded, t: (k: string) => string): BreadcrumbItemData[] {
  return [
    home(t),
    packagesLink(t),
    { label: `#${route.params.id}`, to: `/packages/${route.params.id}`, dynamic: true },
    { label: t('packageEdit.editBreadcrumb') },
  ]
}

function settingsResolver(tabKey: string): BreadcrumbResolver {
  return (_, t) => [
    home(t),
    { label: t('settings.breadcrumb'), to: '/settings/profile' },
    { label: t(tabKey) },
  ]
}

const resolvers: Record<string, BreadcrumbResolver> = {
  'home': (_, t) => [{ label: t('nav.home') }],

  'packages': (_, t) => [home(t), { label: t('nav.packages') }],

  'package-detail': (r, t) => [
    home(t),
    packagesLink(t),
    { label: `#${r.params.id}`, dynamic: true },
  ],

  'package-new': (_, t) => [
    home(t),
    packagesLink(t),
    { label: t('packageEdit.newTitle') },
  ],

  'package-edit-info': packageEditResolver,
  'package-edit-gallery': packageEditResolver,
  'package-edit-description': packageEditResolver,
  'package-edit-versions': packageEditResolver,
  'package-edit-version-new': packageEditResolver,
  'package-edit-version-edit': packageEditResolver,

  'uploader-detail': (r, t) => [
    home(t),
    { label: `${t('uploader.breadcrumb')} #${r.params.id}`, dynamic: true },
  ],

  'settings-profile': settingsResolver('settings.nav.profile'),
  'settings-bio': settingsResolver('settings.nav.bio'),
  'settings-security': settingsResolver('settings.nav.security'),

  'login': (_, t) => [home(t), { label: t('auth.loginTitle') }],
  'register': (_, t) => [home(t), { label: t('auth.registerTitle') }],
  'activate': (_, t) => [home(t), { label: t('auth.activateTitle') }],
  'about': (_, t) => [home(t), { label: t('nav.about') }],
  'not-found': (_, t) => [home(t), { label: '404' }],
  'admin-files': (_, t) => [home(t), { label: t('adminFiles.title') }],
}

const dynamicLabel = ref<string | null>(null)

/**
 * 在 AppShell 中调用一次，返回响应式 breadcrumb items。
 * 路由变化时自动清空 dynamicLabel 覆盖。
 */
export function useBreadcrumb() {
  const route = useRoute()
  const { t } = useI18n()

  watch(() => route.path, () => {
    dynamicLabel.value = null
  })

  const items = computed<BreadcrumbItemData[]>(() => {
    const name = String(route.name ?? '')
    const resolver = resolvers[name]
    const base = resolver ? resolver(route, t) : [home(t)]

    if (dynamicLabel.value) {
      const idx = base.findIndex((item) => item.dynamic)
      if (idx >= 0) {
        return base.map((item, i) =>
          i === idx ? { ...item, label: dynamicLabel.value! } : item,
        )
      }
    }
    return base
  })

  return { items }
}

/**
 * 页面级 composable：覆盖标记为 dynamic 的面包屑项的 label。
 * 仅需在有异步数据的页面中使用。
 */
export function useSetBreadcrumbLabel() {
  return {
    setLabel(label: string) {
      dynamicLabel.value = label
    },
  }
}
