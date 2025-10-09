import { compress } from 'hono/compress'
import { requestId } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'

import { envVariables, factory } from '#factory'
import healthRoute from '#features/health/health.routes'
import { errorHandler, notFoundHandler } from '#middlewares/error.middleware'
import { pinoLogger } from '#middlewares/logger.middleware'
import { registerDocs } from '#openapi/docs'

const app = factory.createApp()

if (envVariables.NODE_ENV !== 'production') {
  registerDocs(app)
}

app.use(requestId())
app.use(pinoLogger)

app.use(secureHeaders())

app.route('/health', healthRoute)

app.use(compress())

app.onError(errorHandler)

app.notFound(notFoundHandler)

export { app }
