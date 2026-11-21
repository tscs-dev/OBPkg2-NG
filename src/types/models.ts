export interface String3 {
  Local: string
  English: string
  Tag: string
}

export interface Author {
  Name: String3
  Email?: string
  Homepage?: string
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

export interface UploaderDetail extends Uploader {
  Packages: PackageSummary[] | null
}

export interface PackageFile {
  ID: number
  PackageID: number
  Platform: string
  Platforms?: string[] | null
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
  Uploader?: Uploader | null
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

export interface LoginPayload {
  username: string
  password: string
}

export interface TokenResponse {
  token: string
}

export interface RegisterPayload {
  Email: string
}

export interface RegisterResponse {
  Expiry: string
}

export interface CheckTokenResponse {
  Email: string
}

export interface ActivatePayload {
  Token: string
  Password: string
  Name: String3
}

export interface ChangePasswordPayload {
  PreviousPassword: string
  NewPassword: string
}

export interface UpdateUploaderPayload {
  Name: String3
  Homepage: string
}

export interface UpdateUploaderDescriptionPayload {
  Description: string
}

export interface SavePackageInfoPayload {
  Identifier: string
  GUID?: string
  Name: String3
  Author?: Author | null
  Homepage: string
  ForcePopup: boolean
}

export interface SavePackageGalleryPayload {
  Thumbnail: string
  ThumbnailLQ: string
}

export interface SavePackageDescriptionPayload {
  Description: string
}

export interface SaveFilePayload {
  PackageID: number
  Platform: string
  Version: string
  Size: string
  Service: string
  URLParam: string
  AuthParam: string
  RejectReason?: string
}

export interface LskyUploadResult {
  fullUrl: string
  thumbUrl: string
}

