import { createProxy } from './proxy'
import { type Router } from './router'
import { type RPCRequest } from './server'
import type { DecorateCaller } from './types'
import { RPC } from './rpc'

/**
 * Create a caller function for a given router.
 * Pass a context object to the caller to use it in the procedures.
 * Handy for testing.
 *
 * @param router - The router to create the caller for.
 * @returns The caller function.
 * ```ts
 * const caller = factory(appRouter)
 *
 * const apiA = caller({ user: { id: 1 } })
 * const apiB = caller({ user: null })
 *
 * apiA.users.list() // => Ok
 * apiB.users.list() // => Err
 * ```
 */
export function factory<T extends Router>(router: T) {
  const flatRouter = router.flat()

  return function caller(ctx?: unknown) {
    return createProxy<DecorateCaller<T['$def']>>((path, args) => {
      const req: RPCRequest = {
        path: path.join('.'),
        body: args[0],
      }
      return RPC.handle(req, flatRouter, ctx)
    })
  }
}
