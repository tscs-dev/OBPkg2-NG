import type { String3 } from '@/types/models'

const ASCII_PRINTABLE_REGEX = /^[\s\w\d\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]*$/

export function isAsciiString(value: string): boolean {
  return ASCII_PRINTABLE_REGEX.test(value)
}

export function hasTrimIssues(value: string): boolean {
  return value.length > 0 && value !== value.trim()
}

export function needsEnglishName(local: string): boolean {
  return !isAsciiString(local)
}

export interface String3Errors {
  local: string | null
  english: string | null
  tag: string | null
}

export type String3ErrorKey =
  | 'validation.s3LocalRequired'
  | 'validation.s3EnglishRequired'
  | 'validation.s3EnglishAscii'
  | 'validation.noLeadingTrailingSpace'

export function validateString3(
  value: String3,
  translate: (key: String3ErrorKey) => string,
): String3Errors {
  const errors: String3Errors = {
    local: null,
    english: null,
    tag: null,
  }

  if (!value.Local || value.Local.trim().length === 0) {
    errors.local = translate('validation.s3LocalRequired')
  } else if (hasTrimIssues(value.Local)) {
    errors.local = translate('validation.noLeadingTrailingSpace')
  }

  if (needsEnglishName(value.Local)) {
    if (!value.English || value.English.trim().length === 0) {
      errors.english = translate('validation.s3EnglishRequired')
    } else if (hasTrimIssues(value.English)) {
      errors.english = translate('validation.noLeadingTrailingSpace')
    } else if (!isAsciiString(value.English)) {
      errors.english = translate('validation.s3EnglishAscii')
    }
  }

  if (value.Tag && hasTrimIssues(value.Tag)) {
    errors.tag = translate('validation.noLeadingTrailingSpace')
  }

  return errors
}

export function isString3Valid(errors: String3Errors): boolean {
  return !errors.local && !errors.english && !errors.tag
}

export function normalizeString3ForSubmit(value: String3): String3 {
  const local = value.Local.trim()
  const english = needsEnglishName(local) ? value.English.trim() : ''
  const tag = value.Tag.trim()
  return {
    Local: local,
    English: english,
    Tag: tag,
  }
}
