const filePickerUrl =
  (import.meta.env.VITE_FILE_PICKER_URL as string | undefined) ??
  'https://storage.zulubox.me/hpfm/bvecs/picker.php'

export const ENV = {
  apiRootUrl: (import.meta.env.VITE_API_ROOT_URL as string | undefined) ?? 'https://api.bvecs.zbx1425.cn/v1',
  docRootUrl: (import.meta.env.VITE_DOC_ROOT_URL as string | undefined) ?? 'https://wiki.zbx1425.cn/',
  statsUrl: (import.meta.env.VITE_STATS_URL as string | undefined) ?? 'https://bvecs.zbx1425.cn/bcs-ugc/statapi.php',
  installEndpoint: (import.meta.env.VITE_INSTALL_ENDPOINT as string | undefined) ?? 'https://bvecs.zbx1425.cn/install/',
  analyticsUrl: 'https://bvecs.zbx1425.cn/analytics',
  lskyApiUrl:
    (import.meta.env.VITE_LSKY_API_URL as string | undefined) ??
    'https://storage.zbx1425.cn/img-lsky/api/v1/upload',
  lskyApiToken: (import.meta.env.VITE_LSKY_API_TOKEN as string | undefined) ?? '',
  filePickerUrl,
  filePickerOrigin: new URL(filePickerUrl).origin,
} as const
