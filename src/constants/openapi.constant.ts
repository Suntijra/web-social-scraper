import { ERouteTag } from '#types/openapi.d'

export const HTTP_ERROR_DESCRIPTIONS: Record<number, string> = {
  200: 'Request successful.',
  201: 'Created successful.',
  400: 'Problem with the request.',
  401: 'Unauthorized.',
  403: 'Insufficient permissions.',
  404: 'Resource not found.',
  409: 'Request conflict.',
  413: 'Content Too Large.',
  415: 'Unsupported Media Type.',
  500: 'Internal server.',
}

export const TAG_DESCRIPTIONS: { name: string; description: string }[] = [
  {
    name: ERouteTag.HEALTH,
    description: "You can read the health information of the API server to see if it's still operational.",
  },
]
