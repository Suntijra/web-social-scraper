import { describeRoute } from 'hono-openapi'
import { resolver } from 'hono-openapi'

import { HTTP_ERROR_DESCRIPTIONS } from '#constants/openapi.constant'
import { healthResponseSchema } from '#schemas/health.schema'
import { ERouteTag } from '#types/openapi.d'

export const getHealthDoc = describeRoute({
  summary: "Get an API's health information",
  description: "Gets an API's health information",
  tags: [ERouteTag.HEALTH],
  security: [],
  responses: {
    200: {
      description: HTTP_ERROR_DESCRIPTIONS[200],
      content: {
        'application/json': { schema: resolver(healthResponseSchema) },
      },
    },
  },
})
