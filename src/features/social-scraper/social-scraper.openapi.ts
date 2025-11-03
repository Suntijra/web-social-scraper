import { describeRoute, resolver } from 'hono-openapi'

import { HTTP_ERROR_DESCRIPTIONS } from '#constants/openapi.constant'
import { socialScraperRequestSchema, socialScraperResponseSchema } from '#schemas/social-scraper.schema'
import { ERouteTag } from '#types/openapi.d'

const { platform: platformParamSchema, profileUrl: profileUrlParamSchema } = socialScraperRequestSchema.shape

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

export const getSocialScraperStreamDoc = describeRoute({
  summary: 'สตรีมผลการสแครปแบบเรียลไทม์',
  description:
    'ส่งผลลัพธ์การสแครปแบบ Server-Sent Events (SSE) เพื่อให้คอมเมนต์และเมตริกต่างๆ ไหลเข้ามาทีละรายการ รองรับ Facebook, X, TikTok และ YouTube',
  tags: [ERouteTag.SOCIAL_SCRAPER],
  parameters: [
    {
      name: 'platform',
      in: 'query',
      required: true,
      description: 'แพลตฟอร์มที่ต้องการสตรีมผล',
      schema: resolver(platformParamSchema) as never,
    },
    {
      name: 'profileUrl',
      in: 'query',
      required: true,
      description: 'URL ของโปรไฟล์หรือโพสต์ที่ต้องการสแครป',
      schema: resolver(profileUrlParamSchema) as never,
    },
  ],
  responses: {
    200: {
      description: 'ข้อความ SSE ต่อเนื่อง ประกอบด้วยอีเวนต์ metrics, comment และ complete',
      content: {
        'text/event-stream': {
          schema: {
            type: 'string',
            example: `event: metrics\ndata: {"platform":"youtube","displayName":"Channel","followers":0}\n\nevent: comment\ndata: {"platform":"youtube","index":0,"comment":{"authorName":"user","text":"Great!"}}\n\nevent: complete\ndata: {"platform":"youtube","displayName":"Channel","comments":[...]}\n\n`,
          },
        },
      },
    },
  },
})
