export const ENV = {
  apiRootUrl: (import.meta.env.VITE_API_ROOT_URL as string | undefined) ?? 'https://api.bvecs.zbx1425.cn/v1',
  docRootUrl: (import.meta.env.VITE_DOC_ROOT_URL as string | undefined) ?? 'https://wiki.zbx1425.cn/',
  statsUrl: (import.meta.env.VITE_STATS_URL as string | undefined) ?? 'https://bvecs.zbx1425.cn/bcs-ugc/statapi.php',
  installEndpoint: (import.meta.env.VITE_INSTALL_ENDPOINT as string | undefined) ?? 'https://api.zbx1425.cn/install/',
  analyticsUrl: 'https://bvecs.zbx1425.cn/analytics',
} as const
