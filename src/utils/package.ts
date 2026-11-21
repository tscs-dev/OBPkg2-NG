import { PLATFORM_ORDER } from '@/config/platforms'
import { compareVersionsDesc } from '@/utils/version'
import type { Author, PackageFile } from '@/types/models'

/**
 * 后端在某些列表或内嵌对象中会对原创包返回空字段的 Author 对象（如 `{ Name: { Local: '', English: '', Tag: '' } }`）。
 * 统一以是否存在任意非空属性作为是否转载的判断依据。
 */
export function hasValidAuthor(author?: Author | null): author is Author {
  if (!author) return false
  const hasName = Boolean(
    author.Name?.Local?.trim() ||
      author.Name?.English?.trim() ||
      author.Name?.Tag?.trim(),
  )
  const hasContact = Boolean(author.Email?.trim() || author.Homepage?.trim())
  return hasName || hasContact
}

/**
 * 按版本号降序 → 平台顺序 → ID 降序排列文件列表（共用于版本列表和编辑页）。
 */
export function sortPackageFiles(files: PackageFile[]): PackageFile[] {
  return [...files].sort((a, b) => {
    const cmp = compareVersionsDesc(a.Version, b.Version)
    if (cmp !== 0) return cmp
    const idxA = PLATFORM_ORDER.indexOf(a.Platform as (typeof PLATFORM_ORDER)[number])
    const idxB = PLATFORM_ORDER.indexOf(b.Platform as (typeof PLATFORM_ORDER)[number])
    if (idxA !== -1 && idxB !== -1 && idxA !== idxB) return idxA - idxB
    return b.ID - a.ID
  })
}
