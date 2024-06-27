import { serve } from '@/server'
import { app } from './mock'
import { IO } from '@/socket/socket-server'
import { Database } from 'bun:sqlite'

class Message {
  id!: number
  userId!: string
  text!: string
  private _timestamp!: string

  get timestamp() {
    return new Date(this._timestamp)
  }
}

const db = new Database('data.db', {
  create: true,
  strict: true,
})

const createTable = db.query(
  `CREATE TABLE IF NOT EXISTS message (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    text TEXT NOT NULL,
    _timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
)

createTable.run()

const q = {
  dropTable: db.query(`DROP TABLE IF EXISTS message`),

  insertMessage: db.query(
    `INSERT INTO message (userId, text) VALUES ($userId, $text)`,
  ),

  getMessages: db.query(`SELECT * FROM message`).as(Message),

  getMessagesWithLimit: db
    .query(`SELECT * FROM message LIMIT $limit OFFSET $offset`)
    .as(Message),

  deleteMessage: db.query(`DELETE FROM message WHERE id = $id`),
}

// q.dropTable.run()

class Chat {
  id = 'GLOBAL'
  users: string[] = []
  messages: Message[]

  constructor() {
    this.messages = q.getMessages.all()
  }

  addUser(userId: string) {
    this.users.push(userId)
  }

  removeUser(userId: string) {
    const index = this.users.indexOf(userId)
    if (index !== -1) {
      this.users.splice(index, 1)
    }
  }

  getMessages(opts?: { limit: number; offset: number }) {
    if (opts) {
      return q.getMessagesWithLimit.all(opts)
    }
    return q.getMessages.all()
  }

  addMessage(message: Message) {
    const { lastInsertRowid } = q.insertMessage.run({
      userId: message.userId,
      text: message.text,
    })
    message.id = lastInsertRowid as number
    this.messages.push(message)
  }
}

const chat = new Chat()

const io = new IO()

io.on('connection', (socket) => {
  console.log('Client connected', socket.id)

  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id)
    socket.leave(chat.id)
    chat.removeUser(socket.id)
    io.broadcast(chat.id, 'chat:leave', socket.id)
  })

  socket.on('chat:join', (userId: string) => {
    socket.join(chat.id)
    chat.addUser(userId)

    socket.emit('chat:joined', {
      userId,
      users: chat.users,
      messages: chat.messages,
    })

    socket.broadcast(chat.id, 'chat:join', {
      userId,
      users: chat.users,
    })

    console.log(`User ${socket.id} joined chat ${chat.id}`)
  })

  socket.on('chat:leave', (userId: string) => {
    io.broadcast(chat.id, 'chat:leave', userId)
    socket.leave(chat.id)
    chat.removeUser(userId)

    console.log(`User ${socket.id} left chat ${chat.id}`)
  })

  socket.on('message:send', (message: Message) => {
    console.log('Message received:', message)

    chat.addMessage(message)
    socket.broadcast(chat.id, 'message:receive', message)
  })
})

const staticDir = `${__dirname}/../static`

function openStatic(file: string) {
  return Bun.file(`${staticDir}/${file}`).text()
}

function open(file: string) {
  return Bun.file(`${__dirname}/${file}`).text()
}

const FALLBACK = 'index.html'

async function serveStatic(url: URL, dir: string, fallback: string) {
  const path = `${dir}${url.pathname}`
  const file = (await Bun.file(path).exists())
    ? Bun.file(path)
    : Bun.file(`${dir}/${fallback}`)
  console.log('SERVING', file)
  return new Response(file, { headers: { 'content-type': file.type } })
}

async function build() {
  const result = await Bun.build({
    entrypoints: [`${staticDir}/main.ts`],
    outdir: staticDir,
    naming: `[dir]/bundle.[ext]`,
  })

  if (!result.success) {
    for (const message of result.logs) {
      console.error(message)
    }
    throw new Error('Build failed')
  }
}

const server = serve(app, {
  port: 8000,
  context(req) {
    return {
      token: req.headers.get('x'),
    }
  },
  onError(err) {
    console.log('Catched error:', err.message)
  },
  static: {
    dir: `${__dirname}/../static`,
    fallback: 'not-found.html',
  },
  // async fetch(_req, url) {
  //   return await serveStatic(url, staticDir, 'index.html')

  /* if (url.pathname === '/') {
      return new Response(await openStatic('index.html'), {
        headers: { 'content-type': 'text/html' },
      })
    }

    if (url.pathname === '/bundle.js') {
      // await build()
      const file = await openStatic('bundle.js')
      return new Response(file, {
        headers: { 'content-type': 'application/javascript' },
      })
    }

    return new Response('Not found', { status: 404 }) */
  // },
  websocket: io.handler(),
})

console.log(`🔥Listening at ${server.url.href.slice(0, -1)}`)
