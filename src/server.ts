import fs from 'node:fs'
import { createServer } from 'node:https'

import { serve } from '@hono/node-server'

import { app } from '#app'
import { envVariables } from '#factory'
import logging from '#libs/logger'

import type { AddressInfo } from 'node:net'

const logger = logging.logger

const callback = async (info: AddressInfo) => {
  logger.info(
    `Listening on ${envVariables.NODE_ENV === 'local' ? 'https' : 'http'}://${info.address === '::1' ? 'localhost' : info.address}:${info.port}`
  )
}

if (envVariables.NODE_ENV === 'local') {
  const cert: Record<string, unknown> = {
    cert: fs.readFileSync('.credentials/localhost.pem'),
    key: fs.readFileSync('.credentials/localhost-key.pem'),
  }
  serve({ ...app, hostname: envVariables.HOST, port: envVariables.PORT, createServer, serverOptions: cert }, callback)
} else {
  serve({ ...app, hostname: envVariables.HOST, port: envVariables.PORT }, callback)
}
