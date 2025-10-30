import { describeRoute, resolver } from 'hono-openapi'

import { HTTP_ERROR_DESCRIPTIONS } from '#constants/openapi.constant'
import { socialScraperRequestSchema, socialScraperResponseSchema } from '#schemas/social-scraper.schema'
import { ERouteTag } from '#types/openapi.d'

export const postSocialScraperSimulateDoc = describeRoute({
  summary: 'จำลองผลลัพธ์การสแครปโปรไฟล์โซเชียล',
  description:
    'สำหรับแพลตฟอร์ม Facebook: เปิดหน้าเว็บจริงด้วย Playwright, ทำความสะอาดเนื้อหาด้วย bodyCleaner และวิเคราะห์ engagement ผ่าน Ollama ก่อนส่งกลับเป็นผลลัพธ์ตัวอย่าง',
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
