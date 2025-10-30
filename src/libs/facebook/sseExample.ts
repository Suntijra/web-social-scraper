import http, { IncomingMessage, ServerResponse } from 'node:http'

import logging from '#libs/logger'

type Json = Record<string, unknown>

const PORT = Number(process.env.PORT ?? 4000)

const clients = new Set<ServerResponse>()
const logger = logging.logger

const sendEvent = (res: ServerResponse, eventName: string, data: Json): void => {
  res.write(`event: ${eventName}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

const parseJsonBody = async (req: IncomingMessage): Promise<Json> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = []

    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      if (!chunks.length) {
        resolve({})
        return
      }

      try {
        const rawBody = Buffer.concat(chunks).toString('utf8')
        resolve(JSON.parse(rawBody))
      } catch (_error) {
        reject(new Error('Invalid JSON payload'))
      }
    })
    req.on('error', reject)
  })

const server = http.createServer(async (req, res) => {
  if (req.url === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Transfer-Encoding': 'chunked',
      'Access-Control-Allow-Origin': '*',
    })

    res.write(': ok\n\n') // comment keeps the connection warm
    clients.add(res)

    const heartbeat = setInterval(() => {
      if (!clients.has(res)) {
        clearInterval(heartbeat)
        return
      }

      sendEvent(res, 'heartbeat', { at: new Date().toISOString() })
    }, 15000)

    req.on('close', () => {
      clearInterval(heartbeat)
      clients.delete(res)
    })

    return
  }

  if (req.method === 'POST' && req.url === '/broadcast') {
    try {
      const body = (await parseJsonBody(req)).message
      const message = typeof body === 'string' && body.trim().length > 0 ? body : 'Hello from the server'

      const payload = { message, sentAt: new Date().toISOString() }
      for (const client of clients) {
        sendEvent(client, 'message', payload)
      }

      res.writeHead(204).end()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: message }))
    }

    return
  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(
    JSON.stringify({
      endpoints: {
        events: 'GET /events',
        broadcast: 'POST /broadcast { "message": "text" }',
      },
    })
  )
})

server.listen(PORT, () => {
  logger.info(`SSE server ready on http://localhost:${PORT}`)
})
