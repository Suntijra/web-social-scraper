import { z } from '@hono/zod-openapi'

const PLATFORM_VALUES = ['facebook', 'instagram', 'tiktok'] as const

export const socialScraperRequestSchema = z
  .object({
    platform: z.enum(PLATFORM_VALUES).openapi({
      example: 'facebook',
      description: 'แพลตฟอร์มที่ต้องการจำลองการสแครป',
    }),
    profileUrl: z.string().url().openapi({
      example: 'https://www.facebook.com/acme.inc',
      description: 'URL ของโปรไฟล์ที่ต้องการจำลองการสแครป',
    }),
  })
  .openapi({
    description: 'ข้อมูลที่จำเป็นสำหรับจำลองการสแครปโซเชียล',
  })

export const socialScraperResponseSchema = z
  .object({
    platform: z.enum(PLATFORM_VALUES).openapi({
      example: 'facebook',
    }),
    profileId: z.string().openapi({
      example: 'acme-1234',
      description: 'รหัสภายในที่ระบุโปรไฟล์นั้น',
    }),
    displayName: z.string().openapi({
      example: 'ACME Inc.',
    }),
    followers: z.number().int().nonnegative().openapi({
      example: 15720,
      description: 'จำนวนผู้ติดตามที่พบจากการจำลอง',
    }),
    scrapedAt: z.string().openapi({
      example: '2025-10-30T14:15:00.000Z',
      description: 'เวลาที่รันการจำลอง (ISO 8601)',
    }),
    samplePosts: z
      .array(
        z.object({
          id: z.string().openapi({
            example: 'post-1',
          }),
          headline: z.string().openapi({
            example: 'เปิดตัวสินค้ารุ่นใหม่ประจำไตรมาส',
          }),
          publishedAt: z.string().openapi({
            example: '2025-10-01T08:00:00.000Z',
          }),
        })
      )
      .min(1)
      .openapi({
        example: [
          {
            id: 'post-1',
            headline: 'เปิดตัวสินค้ารุ่นใหม่ประจำไตรมาส',
            publishedAt: '2025-10-01T08:00:00.000Z',
          },
        ],
        description: 'รายการโพสต์ตัวอย่างที่ดึงมาได้',
      }),
  })
  .openapi({
    description: 'ผลลัพธ์จำลองจากการสแครปโปรไฟล์โซเชียล',
  })
