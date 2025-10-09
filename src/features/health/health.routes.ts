import { Hono } from 'hono'

import { HealthController } from './health.controller'
import { getHealthDoc } from './health.openapi'

const route = new Hono()

const healthController = new HealthController()

route.get('/', getHealthDoc, healthController.getHealth)

export default route
