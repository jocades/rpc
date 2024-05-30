const router = [
  { path: 'users.list', input: null },
  { path: 'users.getById', input: { id: 1 } },
]

const baseURL = 'http://localhost:8000'

function toB64(str: string) {
  return Buffer.from(str).toString('base64')
}

const filename =
  process.env.NODE_ENV === 'production' ? 'bundle.min.js' : 'bundle.js'

const bundle = Bun.file(`./dist/${filename}`)

console.log('JS', {
  file: filename,
  size: Math.round(bundle.size / 1024) + ' kb',
})

const js = toB64(await bundle.text())

function renderRPCSpec(router: any, opts: { url: string; title?: string }) {
  const title = opts?.title ?? 'RPC Spec'

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body>
      <div id="root"></div>
      <script>
        window.__RPC_ROUTER__ = ${JSON.stringify(router)};
        window.__RPC_URL__ = "${opts.url}";
      </script>
      <script src="data:text/javascript;base64,${js}"></script>
    </body>
    </html>
  `
}

Bun.serve({
  port: 8000,
  async fetch(req) {
    const url = new URL(req.url)
    console.log(`${req.method} - ${url.pathname}`)

    if (url.pathname === '/') {
      return new Response(renderRPCSpec(router, { url: baseURL }), {
        headers: { 'content-type': 'text/html' },
      })
    }

    return new Response('Not found', { status: 404 })
  },
})

console.log('Listening on http://localhost:8000')
