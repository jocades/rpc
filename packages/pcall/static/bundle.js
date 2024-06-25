// packages/pcall/src/error.ts
function error(status, message) {
  return new RPCError(status, message);
}

class RPCError {
  name = "RPCError";
  status;
  code;
  message;
  constructor(status, message) {
    this.status = status;
    this.code = RPC_ERROR_CODES_BY_STATUS[status];
    this.message = message;
  }
  toJSON() {
    return {
      code: this.code,
      status: this.status,
      message: this.message
    };
  }
}
var RPC_ERROR_CODES_BY_STATUS = {
  PARSE_ERROR: 418,
  INPUT_PARSE_ERROR: 418,
  OUTPUT_PARSE_ERROR: 418,
  BAD_REQUEST: 400,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_SUPPORTED: 405,
  TIMEOUT: 408,
  CONFLICT: 409,
  PRECONDITION_FAILED: 412,
  PAYLOAD_TOO_LARGE: 413,
  UNPROCESSABLE_CONTENT: 422,
  TOO_MANY_REQUESTS: 429,
  CLIENT_CLOSED_REQUEST: 499
};

// packages/pcall/src/util.ts
function isObj(value) {
  return value !== null && typeof value === "object";
}
function isFn(value) {
  return typeof value === "function";
}
function isLiteral(value) {
  return typeof value === "string" || typeof value === "number";
}

// packages/pcall/src/socket/socket-server.ts
var webSocketHandler = function(io) {
  return {
    open(ws) {
      io.addClient(ws);
      io.trigger("connection", ws.data.id);
    },
    close(ws) {
      io.getClient(ws.data.id).trigger("disconnect");
      io.removeClient(ws.data.id);
    },
    message(ws, data) {
      const socket = io.getClient(ws.data.id);
      const message = JSON.parse(data);
      const payload = parse(message);
      socket.trigger(message.event, ...payload);
    }
  };
};
function parse(message) {
  return message.payload.map((item) => {
    if (!parser[item.type]) {
      throw new Error(`Unknown type: ${item.type}`);
    }
    return parser[item.type](item.value);
  });
}

class IO {
  events = new Map;
  clients = new Map;
  channels = new Map;
  on(event, handler) {
    this.events.set(event, handler);
  }
  trigger(event, id) {
    const handler = this.events.get(event);
    if (!handler) {
      throw new Error(`No handler for event: ${event}`);
    }
    handler(this.getClient(id));
  }
  emit(event, data) {
    this.clients.forEach((socket) => socket.emit(event, data));
  }
  getClient(id) {
    if (!this.clients.has(id)) {
      throw new Error(`No client with id: ${id}`);
    }
    return this.clients.get(id);
  }
  addClient(ws) {
    this.clients.set(ws.data.id, new Socket(ws, this));
  }
  removeClient(id) {
    this.clients.delete(id);
  }
  getChannel(id) {
    if (!this.channels.has(id)) {
      throw new Error(`No no channel with id: ${id}`);
    }
    return this.channels.get(id);
  }
  addChannel(id, context) {
    this.channels.set(id, {
      sockets: new Set,
      context
    });
  }
  removeChannel(id) {
    this.channels.delete(id);
  }
  join(channelId, socket) {
    if (!this.channels.has(channelId)) {
      this.addChannel(channelId, {});
    }
    this.channels.get(channelId).sockets.add(socket);
  }
  broadcast(channelId, event, data, socketId) {
    this.getChannel(channelId).sockets.forEach((socket) => {
      if (socket.id === socketId)
        return;
      socket.emit(event, data);
    });
  }
  handler() {
    return webSocketHandler(this);
  }
}
var io = new IO;
io.on("connection", (socket) => {
  socket.join("chat1");
  socket.broadcast("chat1", "message:send", "Hello from server!");
  socket.on("disconnect", () => {
    console.log("Client disconnected", socket.id);
  });
});

class Socket {
  id;
  io;
  ws;
  events = new Map;
  constructor(ws, io2) {
    this.id = ws.data.id;
    this.io = io2;
    this.ws = ws;
  }
  on(event, handler) {
    this.events.set(event, handler);
  }
  emit(event, ...payload) {
    this.ws.send(JSON.stringify({ event, payload }));
  }
  trigger(event, ...data) {
    const handler = this.events.get(event);
    if (!handler) {
      throw new Error(`No handler for event: ${event}`);
    }
    handler(...data);
  }
  join(channelId) {
    this.io.join(channelId, this);
  }
  broadcast(roomId, event, data) {
    this.io.broadcast(roomId, event, data, this.id);
  }
}
var parser = {
  object: JSON.parse,
  literal: (val2) => val2,
  function: (val) => eval(`(${val})`)
};

// packages/pcall/src/router.ts
var io2 = new IO;

// packages/pcall/src/rpc.ts
class RPCRequest {
  id;
  jsonrpc = "2.0";
  method;
  params;
  constructor(id, method, params) {
    this.id = id;
    this.method = method;
    this.params = params;
  }
  static async from(what) {
    try {
      return await what.json();
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw error("PARSE_ERROR");
      }
      throw err;
    }
  }
}

class RPCResponse {
  id;
  jsonrpc = "2.0";
  result;
  error;
  constructor(id, result, error5) {
    this.id = id;
    this.result = result;
    this.error = error5;
  }
  static send(id, result, error5) {
    return Response.json(new RPCResponse(id, result, error5));
  }
  static error(id, err) {
    if (!(err instanceof RPCError)) {
      throw err;
    }
    return new RPCResponse(id, undefined, err);
  }
  static async from(what) {
    try {
      return await what.json();
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw error("PARSE_ERROR");
      }
      throw err;
    }
  }
}
// packages/pcall/src/adapters/bun.ts
var io3 = new IO;
io3.on("connection", (socket) => {
  console.log("connected", socket.id);
  console.log("clients", io3.clients.size);
  socket.on("message", (data) => {
    console.log("message", data);
    socket.emit("message", "Hello, client!");
  });
  socket.on("disconnect", () => {
    console.log("disconnected", socket.id);
  });
  socket.on("ping", () => "Pong!");
  socket.on("test", (str, num, obj, fn) => {
    console.log("test", str, num, obj, fn);
    const what = fn(1, 2);
    console.log("what", what);
  });
});

// packages/pcall/src/server.ts
var __dirname = "/Users/j0rdi/dev/cel/rpc/packages/pcall/src";
var staticDir = `${__dirname}/../static`;
// packages/pcall/src/proxy.ts
function createProxy(callback, path = []) {
  return new Proxy(() => {
  }, {
    get(_targ, key) {
      if (typeof key !== "string" || key === "then") {
        return;
      }
      console.log("GET", key);
      return createProxy(callback, [...path, key]);
    },
    apply(_targ, _thisArg, args) {
      const isApply = path[path.length - 1] === "apply";
      console.log("APPLY", path, args);
      return callback(isApply ? path.slice(0, -1) : path, isApply ? args.length >= 2 ? args[1] : [] : args);
    }
  });
}
// packages/pcall/src/socket/socket-client.ts
var parse3 = function(values) {
  return values.map((arg) => {
    if (isObj(arg)) {
      return { type: "object", value: JSON.stringify(arg) };
    }
    if (isFn(arg)) {
      return { type: "function", value: arg.toString() };
    }
    if (isLiteral(arg)) {
      return { type: "literal", value: arg };
    }
    throw new Error(`Unsupported type ${typeof arg} for value ${arg}`);
  });
};

class SocketClient {
  ws;
  events = new Map;
  constructor(url) {
    this.ws = new WebSocket(url);
    this.setup();
  }
  get connected() {
    return this.ws.readyState === WebSocket.OPEN;
  }
  setup() {
    this.ws.onopen = () => {
      this.events.get("connect")?.();
    };
    this.ws.onclose = () => {
      this.events.get("disconnect")?.();
    };
    this.ws.onmessage = ({ data }) => {
      const msg = JSON.parse(data);
      const handler = this.events.get(msg.event);
      if (!handler) {
        throw new Error(`Event ${msg.event} not found`);
      }
      handler(...msg.payload);
    };
    this.ws.onerror = (err) => {
      console.error("Error:", err);
    };
  }
  emit(event, ...args) {
    if (!this.connected) {
      throw new Error("Socket is not open");
    }
    const payload = parse3(args);
    this.ws.send(JSON.stringify({ event, payload }));
  }
  on(event, callback) {
    this.events.set(event, callback);
  }
  off(event) {
    this.events.delete(event);
  }
  close() {
    this.ws.close();
  }
}

// packages/pcall/src/client.ts
function client(url, opts = {}) {
  const loggerx = (isFn(opts.logger) ? opts.logger() : opts.logger) ? logger : undefined;
  const batch = opts.link === "batch" ? new Batch(url + "?batch", loggerx, opts.batch) : null;
  return createProxy((path, args) => {
    if (path.length === 1 && path[0] === "$ws") {
      return new SocketClient(getWebSocketUrl(url));
    }
    const method = path.join(".");
    const params = args[0];
    return batch ? batch.addRequest(method, params) : linear(url, method, params, loggerx);
  });
}
async function _fetch(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  return RPCResponse.from(res);
}
async function linear(url, method, params, logger) {
  const request = new RPCRequest(1, method, params);
  logger?.info(request.method, request);
  const response = await _fetch(url, request);
  if ("error" in response) {
    logger?.error(request.method, response);
    throw response.error;
  }
  logger?.ok(request.method, response);
  return response.result;
}
var getWebSocketUrl = function(url) {
  let wsUrl = "";
  if (url.startsWith("http://")) {
    wsUrl = url.replace("http://", "ws://");
  } else if (url.startsWith("https://")) {
    wsUrl = url.replace("https://", "ws://");
  } else {
    wsUrl = `ws://${url}`;
  }
  return wsUrl + "/ws";
};
var css = function(styles) {
  return Object.entries(styles).map(([k, v]) => `${k}: ${v}`).join("; ");
};
var log = function(dir, method, data, color = "gray") {
  console.log(`%c %s %s %O`, styles + `;background: ${colors[color]}`, dir === "up" ? ">>" : "<<", method, data);
};
var MAX = 10;
var TIMEOUT = 100;

class Batch {
  url;
  max;
  timeout;
  timeoutId = null;
  requestId = 0;
  requests = [];
  pendingRequests = new Map;
  logger;
  constructor(url, logger, opts = {}) {
    this.url = url;
    this.max = opts.max ?? MAX;
    this.timeout = opts.timeout ?? TIMEOUT;
    this.logger = logger;
  }
  addRequest(method, params) {
    const req = new RPCRequest(this.requestId++, method, params);
    this.requests.push(req);
    const promise = new Promise((resolve, reject) => {
      this.pendingRequests.set(req.id, { resolve, reject });
    });
    if (this.requests.length >= this.max) {
      this.debug(`== max reached | requests: ${this.requests.length} ==`);
      if (this.timeoutId) {
        this.debug(`== clearing timeout | requests: ${this.requests.length} ==`);
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }
      this.send();
    } else if (!this.timeoutId) {
      this.debug(`== setting timeout | requests: ${this.requests.length} ==`);
      this.timeoutId = setTimeout(() => {
        this.send();
        this.timeoutId = null;
      }, this.timeout);
    }
    return promise;
  }
  async send() {
    const batch = this.requests.slice();
    this.requests.length = 0;
    this.debug(`== sending batch | requests: ${batch.length} ==`);
    if (batch.length === 0)
      return;
    this.logger?.info("batch", batch);
    try {
      const responses = await _fetch(this.url, batch);
      for (const { id, result, error: error6 } of responses) {
        const request = this.pendingRequests.get(id);
        if (!request) {
          this.logger?.error("batch", { id, result, error: error6 });
          console.error("No pending request with ID", id);
          continue;
        }
        if (error6) {
          this.logger?.error("batch", { id, result, error: error6 });
          request.reject(error6);
        } else {
          this.logger?.ok("batch", { id, result, error: error6 });
          request.resolve(result);
        }
        this.pendingRequests.delete(id);
      }
    } catch (err) {
      for (const { reject } of this.pendingRequests.values()) {
        reject(err);
      }
      this.pendingRequests.clear();
    }
  }
  debug(...msg) {
    if (true)
      console.log(...msg);
  }
}
var styles = css({
  padding: "2px 2px",
  color: "black",
  ["border-radius"]: "4px"
});
var colors = {
  gray: "rgba(100, 100, 100, 0.2)",
  blue: "#add8e6",
  green: "#90ee90",
  red: "#ffcccb"
};
var logger = {
  info: (m, d) => log("up", m, d, "blue"),
  ok: (m, d) => log("down", m, d, "green"),
  error: (m, d) => log("down", m, d, "red")
};
// packages/pcall/static/main.ts
var api = client("http://localhost:8000/rpc");
var ws = api.$ws();
ws.on("connect", () => {
  console.log("Connected to server");
  ws.emit("message", "Hello from client!");
  ws.on("message", (data) => {
    console.log("Message received", data);
  });
});
ws.on("disconnect", () => {
  console.log("Disconnected from server");
});
document.querySelector("button").onclick = () => {
  ws.emit("message", "Hello from client!");
};
