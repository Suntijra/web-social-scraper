import { Bindings as HonoBindings, Variables as HonoVariables } from 'hono/types'

import type { AppEnvVariables } from '#types/env'
import type { HttpBindings } from '@hono/node-server'
import type { RequestIdVariables } from 'hono/request-id'

export type Bindings = HonoBindings & HttpBindings
export type Variables = HonoVariables & RequestIdVariables & AppEnvVariables

export type JsonInputSchema<T> = {
  in: {
    json: T
  }
  out: {
    json: T
  }
}

export type ParamInputSchema<T> = {
  in: {
    param: T
  }
  out: {
    param: T
  }
}

export type QueryInputSchema<T> = {
  in: {
    query: T
  }
  out: {
    query: T
  }
}
