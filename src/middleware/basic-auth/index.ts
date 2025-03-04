import type { Context } from '../../context'
import type { Next } from '../../hono'
import { timingSafeEqual } from '../../utils/buffer'
import { decodeBase64 } from '../../utils/encode'

const CREDENTIALS_REGEXP = /^ *(?:[Bb][Aa][Ss][Ii][Cc]) +([A-Za-z0-9._~+/-]+=*) *$/
const USER_PASS_REGEXP = /^([^:]*):(.*)$/

const auth = (req: Request) => {
  if (!req) {
    throw new TypeError('argument req is required')
  }

  if (typeof req !== 'object') {
    throw new TypeError('argument req is required to be an object')
  }

  if (!req.headers || typeof req.headers !== 'object') {
    throw new TypeError('argument req is required to have headers property')
  }

  const match = CREDENTIALS_REGEXP.exec(req.headers.get('Authorization'))
  if (!match) {
    return undefined
  }

  const userPass = USER_PASS_REGEXP.exec(decodeBase64(match[1]))

  if (!userPass) {
    return undefined
  }

  return { username: userPass[1], password: userPass[2] }
}

export const basicAuth = (
  options: { username: string; password: string; realm?: string; hashFunction?: Function },
  ...users: { username: string; password: string }[]
) => {
  if (!options) {
    throw new Error('basic auth middleware requires options for "username and password"')
  }

  if (!options.realm) {
    options.realm = 'Secure Area'
  }
  users.unshift({ username: options.username, password: options.password })

  return async (ctx: Context, next: Next) => {
    const requestUser = auth(ctx.req)
    if (requestUser) {
      for (const user of users) {
        const usernameEqual = await timingSafeEqual(
          user.username,
          requestUser.username,
          options.hashFunction
        )
        const passwordEqual = await timingSafeEqual(
          user.password,
          requestUser.password,
          options.hashFunction
        )
        if (usernameEqual && passwordEqual) {
          // Authorized OK
          await next()
          return
        }
      }
    }
    ctx.res = new Response('Unauthorized', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="' + options.realm.replace(/"/g, '\\"') + '"',
      },
    })
  }
}
