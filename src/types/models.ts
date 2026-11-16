export interface String3 {
  Local: string
  English: string
  Tag: string
}

export interface Author {
  Name: String3
  Email: string
  Homepage: string
}

export interface Uploader {
  ID: number
  CreatedAt?: string
  UpdatedAt?: string
  Name: String3
  Email: string
  Homepage?: string
  Description?: string
  Privilege: number
  Validated?: boolean
}

export interface PackageFile {
  ID: number
  PackageID: number
  Platform: string
  Version: string
  Size: string
  Service?: string
  URLParam?: string
  AuthParam?: string
  FetchURL?: string
  NeedValidation: boolean
  Validated: boolean
  RejectReason?: string
}

export interface PackageSummary {
  ID: number
  CreatedAt: string
  UpdatedAt: string
  Identifier: string
  GUID?: string
  Name: String3
  UploaderID: number
  Author?: Author | null
  Homepage?: string
  ForcePopup: boolean
  Thumbnail?: string
  ThumbnailLQ?: string
  Platforms: string[] | null
}

export interface PackageDetail extends PackageSummary {
  Uploader?: Uploader | null
  Description?: string
  Files: PackageFile[] | null
  NeedValidation?: boolean
  Validated?: boolean
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  rangeStart: number
  rangeEnd: number
}

export interface SiteStats {
  time: number
  userCount: number
  downloadCount: number
  packageCount: number
  runningDays: string | number
}

export interface BackendErrorPayload {
  ErrorCode?: number
  Msg?: string
  Data?: string | number
}
