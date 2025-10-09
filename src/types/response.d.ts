import type {
  emptyResponseSchema,
  httpErrorDetailsResponseSchema,
  httpErrorResponseSchema,
} from '#schemas/response.schema'

export enum EHttpStatusCode {
  SUCCESS = 200,
  CREATED = 201,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  INTERNAL_ERROR = 500,
}

export type TEmptyResponse = z.infer<typeof emptyResponseSchema>
export type THttpErrorDetailsResponse = z.infer<typeof httpErrorDetailsResponseSchema>
export type THttpErrorResponse = z.infer<typeof httpErrorResponseSchema>

export type THttpPaginationMetadata = z.infer<typeof paginationMetadataSchema>
