import type { Author } from '@/types/models'

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
