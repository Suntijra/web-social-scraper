import { z } from '@hono/zod-openapi'

const PLATFORM_VALUES = ['facebook', 'x', 'tiktok', 'youtube'] as const

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

export const socialScraperCommentSchema = z.object({
  authorName: z.string().default(''),
  text: z.string().default(''),
})

export const socialScraperResponseSchema = z
  .object({
    platform: z.enum(PLATFORM_VALUES).openapi({
      example: 'facebook',
    }),
    displayName: z.string().default('').openapi({
      example: 'เมื่อมากุโระ ท้าชน แซลมอน... - Sushiro Thailand | Facebook',
      description: 'ชื่อเพจหรือช่องที่เกี่ยวข้องกับคอนเทนต์',
    }),
    title: z.string().default('').openapi({
      example: 'หัวข้อของโพสต์',
      description: 'หัวข้อหลักของคอนเทนต์ เช่น ชื่อโพสต์ ชื่อวิดีโอ',
    }),
    followers: z.number().int().nonnegative().default(0).openapi({
      example: 1900,
      description: 'จำนวนผู้ติดตามหรือสมาชิกของเพจ/ช่อง',
    }),
    comments_count: z.number().int().nonnegative().default(0).openapi({
      example: 642,
      description: 'ยอดรวมคอมเมนต์ที่ตรวจพบ',
    }),
    bookmarks: z.number().int().nonnegative().default(0).openapi({
      example: 0,
      description: 'จำนวนบันทึก/บุ๊กมาร์ก หากแพลตฟอร์มไม่รองรับให้เป็น 0',
    }),
    reposts: z.number().int().nonnegative().default(0).openapi({
      example: 0,
      description: 'จำนวนแชร์หรือรีโพสต์ หากแพลตฟอร์มไม่รองรับให้เป็น 0',
    }),
    view: z.number().int().nonnegative().default(0).openapi({
      example: 0,
      description: 'จำนวนการรับชมคอนเทนต์ หากแพลตฟอร์มไม่รองรับให้เป็น 0',
    }),
    shares: z.number().int().nonnegative().default(0).openapi({
      example: 120,
      description: 'จำนวนการแชร์ หากแพลตฟอร์มไม่รองรับให้เป็น 0',
    }),
    likes: z.number().int().nonnegative().default(0).openapi({
      example: 15_000,
      description: 'จำนวนกดถูกใจ/รีแอคชัน หากแพลตฟอร์มไม่รองรับให้เป็น 0',
    }),
    comments: z
      .array(socialScraperCommentSchema)
      .default([])
      .openapi({
        description: 'รายการคอมเมนต์ที่ดึงมาได้ (จำกัดจำนวนตามการตั้งค่า)',
        example: [
          {
            authorName: 'Nattapong Srisuk',
            text: 'รอโปรดีๆอยู่นะครับ',
          },
        ],
      }),
    scrapedAt: z.string().openapi({
      example: '2025-10-31T06:56:33.140Z',
      description: 'เวลาที่ระบบสกัดข้อมูล (ISO 8601)',
    }),
  })
  .openapi({
    description: 'ผลลัพธ์จากการสแครปคอนเทนต์โซเชียลแบบรวมหลายแพลตฟอร์ม',
  })
