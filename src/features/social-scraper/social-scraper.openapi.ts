import { describeRoute, resolver } from 'hono-openapi'

import { HTTP_ERROR_DESCRIPTIONS } from '#constants/openapi.constant'
import { socialScraperRequestSchema, socialScraperResponseSchema } from '#schemas/social-scraper.schema'
import { ERouteTag } from '#types/openapi.d'

export const postSocialScraperSimulateDoc = describeRoute({
  summary: 'ดึงข้อมูลโซเชียลจากหลายแพลตฟอร์ม',
  description:
    'รองรับ Facebook, X (Twitter), TikTok และ YouTube โดยใช้ Playwright/LLM สกัดเมตริกหลัก เช่น followers, comments, reactions พร้อมตัวอย่างคอมเมนต์ (ถ้ามี)',
  tags: [ERouteTag.SOCIAL_SCRAPER],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: resolver(socialScraperRequestSchema) as never,
      },
    },
  },
  responses: {
    200: {
      description: HTTP_ERROR_DESCRIPTIONS[200] ?? 'Request successful.',
      content: {
        'application/json': {
          schema: resolver(socialScraperResponseSchema) as never,
        },
      },
    },
  },
})
