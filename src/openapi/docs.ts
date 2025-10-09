import { Scalar } from '@scalar/hono-api-reference'
import { Hono } from 'hono'
import { openAPIRouteHandler } from 'hono-openapi'

import { DOC_PAGE_TITLE } from '#constants/app.constant'
import { TAG_DESCRIPTIONS } from '#constants/openapi.constant'
import { version } from '^package.json'

import type { Bindings, Variables } from '#types/app'

export const registerDocs = (app: Hono<{ Bindings: Bindings; Variables: Variables }>) => {
  app.get(
    '/openapi',
    openAPIRouteHandler(app, {
      documentation: {
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
            apiKeyAuth: {
              type: 'apiKey',
              in: 'header',
              name: 'x-api-key',
            },
          },
        },
        info: {
          title: 'AI Anti-Piracy API',
          version,
          description:
            'A documentation of the AI Anti-Piracy API, covering user interactions, data ingestion, and chatbot operational workflows.',
        },
        security: [{ bearerAuth: [] }],
        tags: [...TAG_DESCRIPTIONS],
      },
    })
  )
  app.get(
    '/docs',
    Scalar({
      theme: 'purple',
      pageTitle: DOC_PAGE_TITLE,
      url: '/openapi',
    })
  )
}
