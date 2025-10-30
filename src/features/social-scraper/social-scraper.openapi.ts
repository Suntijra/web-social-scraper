import { describeRoute, resolver } from 'hono-openapi'

import { HTTP_ERROR_DESCRIPTIONS } from '#constants/openapi.constant'
import { socialScraperRequestSchema, socialScraperResponseSchema } from '#schemas/social-scraper.schema'
import { ERouteTag } from '#types/openapi.d'

export const postSocialScraperSimulateDoc = describeRoute({
  summary: 'จำลองผลลัพธ์การสแครปโปรไฟล์โซเชียล',
  description: 'รับข้อมูลโปรไฟล์และส่งผลลัพธ์จำลองกลับมาเพื่อใช้เป็นตัวอย่างการใช้งาน API',
  tags: [ERouteTag.SOCIAL_SCRAPER],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: resolver(socialScraperRequestSchema),
      },
    },
  },
  responses: {
    200: {
      description: HTTP_ERROR_DESCRIPTIONS[200],
      content: {
        'application/json': {
          schema: resolver(socialScraperResponseSchema),
        },
      },
    },
  },
})
