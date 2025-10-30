import type { THttpErrorDetailsResponse } from '#/types/response'
import type { ZodError } from 'zod'

export const parseValidateErrorDetails = (issues: ZodError['issues']): THttpErrorDetailsResponse[] => {
  const details: THttpErrorDetailsResponse[] = issues.map((err) => ({
    property: err.path.join('.'),
    message: err.message,
  }))
  return details
}

export const parseJSONObject = (item: Record<string, unknown>): Record<string, unknown> => {
  return Object.keys(item).reduce(
    (obj, key) => ({ ...obj, [key]: item[key] instanceof Date ? item[key].toISOString() : item[key] }),
    {} as Record<string, unknown>
  )
}

export const parseJSONArray = (items: Record<string, unknown>[]): Record<string, unknown>[] => {
  return items.map((item) => parseJSONObject(item))
}
