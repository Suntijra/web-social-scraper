import https from 'node:https'

import axios, { type AxiosInstance } from 'axios'

import { appConfig } from './config'

interface OllamaGenerateRequest {
  model: string
  prompt: string
  stream: boolean
}

interface OllamaGenerateResponse {
  response?: string
  done?: boolean
}

export interface EngagementDetectionResult {
  likes: number | null
  comments: number | null
  shares: number | null
  evidence?: string
}

const httpsAgent = appConfig.ollamaInsecureTls ? new https.Agent({ rejectUnauthorized: false }) : undefined

const client: AxiosInstance = axios.create({
  baseURL: appConfig.ollamaBaseUrl,
  timeout: appConfig.ollamaTimeoutMs,
  httpsAgent,
  headers: {
    'Content-Type': 'application/json',
  },
})

const suffixMultiplier = (suffix: string): number => {
  switch (suffix.toLowerCase()) {
    case 'k':
      return 1_000
    case 'm':
      return 1_000_000
    case 'b':
      return 1_000_000_000
    default:
      return 1
  }
}

const toNumberWithSuffix = (numericPart: string, suffix?: string | undefined): number | null => {
  const cleanedNumeric = numericPart.replace(/[,\s]/g, '')
  if (!cleanedNumeric) {
    return null
  }
  const parsed = Number.parseFloat(cleanedNumeric)
  if (!Number.isFinite(parsed)) {
    return null
  }
  const multiplier = suffix ? suffixMultiplier(suffix) : 1
  return parsed * multiplier
}

const parseNumericToken = (raw: unknown): number | null => {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null
  }
  if (typeof raw !== 'string') {
    return null
  }
  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }

  const suffixMatch = trimmed.match(/^([0-9]+(?:[.,][0-9]+)?)(?:\s*([kKmMbB]))?$/)
  if (suffixMatch) {
    const [, numericPart, suffix] = suffixMatch
    const value = numericPart ? toNumberWithSuffix(numericPart, suffix) : null
    if (value !== null) {
      return value
    }
  }

  const fallback = Number.parseFloat(trimmed.replace(/,/g, ''))
  return Number.isFinite(fallback) ? fallback : null
}

interface MetricExtraction {
  value: number | null
  evidence?: string
}

const extractMetric = (text: string, patterns: RegExp[]): MetricExtraction => {
  for (const pattern of patterns) {
    const match = pattern.exec(text)
    if (!match) {
      continue
    }

    const numericPart = match[1]
    const suffix = match[2]
    const value = numericPart ? toNumberWithSuffix(numericPart, suffix) : null
    if (value !== null) {
      return { value, evidence: match[0]?.trim() }
    }
  }

  return { value: null }
}

const tryExtractEngagementFromText = (body: string): EngagementDetectionResult | null => {
  const likesPatterns = [
    /(?:all\s+reactions?|reactions?|likes?)\s*[:-]?\s*([0-9]+(?:[.,][0-9]+)?)(?:\s*([kKmMbB]))?/i,
    /([0-9]+(?:[.,][0-9]+)?)(?:\s*([kKmMbB]))?\s+(?:all\s+reactions?|reactions?|likes?)/i,
  ]
  const commentsPatterns = [
    /(?:comments?)\s*[:-]?\s*([0-9]+(?:[.,][0-9]+)?)(?:\s*([kKmMbB]))?/i,
    /([0-9]+(?:[.,][0-9]+)?)(?:\s*([kKmMbB]))?\s+comments?/i,
  ]
  const sharesPatterns = [
    /(?:shares?)\s*[:-]?\s*([0-9]+(?:[.,][0-9]+)?)(?:\s*([kKmMbB]))?/i,
    /([0-9]+(?:[.,][0-9]+)?)(?:\s*([kKmMbB]))?\s+shares?/i,
  ]

  const likes = extractMetric(body, likesPatterns)
  const comments = extractMetric(body, commentsPatterns)
  const shares = extractMetric(body, sharesPatterns)

  if ([likes.value, comments.value, shares.value].every((value) => value === null)) {
    return null
  }

  const evidenceParts = [likes.evidence, comments.evidence, shares.evidence].filter((entry): entry is string =>
    Boolean(entry)
  )

  return {
    likes: likes.value,
    comments: comments.value,
    shares: shares.value,
    evidence: evidenceParts.length > 0 ? evidenceParts.join(' | ') : undefined,
  }
}

const buildEngagementPrompt = (body: string): string => {
  return [
    'You are a data extraction assistant analysing text from a social media page.',
    'Extract the total numbers for likes/reactions, comments, and shares if they are explicitly present.',
    'If numbers are abbreviated (e.g. 2.2K, 1.5M), convert them to the full numeric value in the JSON.',
    'Respond ONLY with JSON using this schema:',
    '{"likes": number | null, "comments": number | null, "shares": number | null, "evidence": string | null}',
    'If a value is missing, set it to null. Evidence should be a short snippet or label; use null if unavailable.',
    'Do not infer or fabricate numbers.',
    'Content to inspect:',
    `"""${body}"""`,
  ].join('\n')
}

const parseEngagementResponse = (raw: string | undefined): EngagementDetectionResult => {
  const base: EngagementDetectionResult = {
    likes: null,
    comments: null,
    shares: null,
  }

  if (!raw) {
    return base
  }

  const trimmed = raw.trim()
  if (!trimmed) {
    return base
  }

  const attempt = (input: string): EngagementDetectionResult | null => {
    try {
      const parsed = JSON.parse(input) as Partial<EngagementDetectionResult>
      if (typeof parsed === 'object' && parsed !== null) {
        const likes = parseNumericToken(parsed.likes ?? null)
        const comments = parseNumericToken(parsed.comments ?? null)
        const shares = parseNumericToken(parsed.shares ?? null)
        const evidence =
          typeof parsed.evidence === 'string' && parsed.evidence.trim().length > 0 ? parsed.evidence.trim() : undefined
        return {
          likes,
          comments,
          shares,
          evidence,
        }
      }
      return null
    } catch {
      return null
    }
  }

  const direct = attempt(trimmed)
  if (direct) {
    return direct
  }

  const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    const fallback = attempt(jsonMatch[0])
    if (fallback) {
      return fallback
    }
  }

  return base
}

export const detectEngagementStats = async (body: string): Promise<EngagementDetectionResult> => {
  const direct = tryExtractEngagementFromText(body)
  if (direct) {
    return direct
  }

  const payload: OllamaGenerateRequest = {
    model: appConfig.ollamaModel,
    prompt: buildEngagementPrompt(body),
    stream: false,
  }

  try {
    const { data } = await client.post<OllamaGenerateResponse>('/api/generate', payload)
    const parsed = parseEngagementResponse(data.response)
    return parsed
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to contact Ollama: ${message}`)
  }
}
