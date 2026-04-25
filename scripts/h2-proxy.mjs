import http2 from "node:http2";
import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const cert = fs.readFileSync(path.join(root, "certs/localhost.pem"));
const key = fs.readFileSync(path.join(root, "certs/localhost-key.pem"));

const UPSTREAM_HOST = "127.0.0.1";
const UPSTREAM_PORT = 3000;
const LISTEN_PORT = 8443;

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "te",
  "trailer",
  "proxy-authorization",
  "proxy-authenticate",
  "upgrade",
  "host",
]);

const server = http2.createSecureServer({ cert, key, allowHTTP1: true });

server.on("error", (err) => console.error("server error", err));

server.on("request", (req, res) => {
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (k.startsWith(":")) continue;
    if (HOP_BY_HOP.has(k.toLowerCase())) continue;
    headers[k] = v;
  }
  headers["host"] = `${UPSTREAM_HOST}:${UPSTREAM_PORT}`;

  console.log(
    `[proxy] ${req.method} ${req.url} (http/${req.httpVersion})`,
  );

  const upstream = http.request(
    {
      host: UPSTREAM_HOST,
      port: UPSTREAM_PORT,
      method: req.method,
      path: req.url,
      headers,
    },
    (upstreamRes) => {
      const id = Math.random().toString(36).slice(2, 6);
      console.log(
        `[proxy ${id}] ${req.method} ${req.url} -> ${upstreamRes.statusCode}`,
      );
      const outHeaders = {};
      for (const [k, v] of Object.entries(upstreamRes.headers)) {
        if (HOP_BY_HOP.has(k.toLowerCase())) continue;
        outHeaders[k] = v;
      }
      res.writeHead(upstreamRes.statusCode ?? 200, outHeaders);
      if (typeof res.flushHeaders === "function") res.flushHeaders();
      let bytesOut = 0;
      upstreamRes.on("data", (chunk) => {
        bytesOut += chunk.length;
        const ok = res.write(chunk);
        console.log(`[proxy ${id}] -> client write ${chunk.length} ok=${ok} total=${bytesOut}`);
      });
      upstreamRes.on("end", () => {
        console.log(`[proxy ${id}] upstream end, total=${bytesOut}`);
        res.end();
      });
      upstreamRes.on("error", (e) => {
        console.log(`[proxy ${id}] upstream error`, e);
        try { res.end(); } catch {}
      });
      res.on("close", () => {
        console.log(`[proxy ${id}] client closed`);
      });
      res.on("error", (e) => {
        console.log(`[proxy ${id}] client res error`, e.message);
      });
    },
  );
  upstream.on("error", (err) => {
    console.error("upstream error", err.message);
    if (!res.headersSent) {
      res.writeHead(502);
    }
    res.end(`upstream error: ${err.message}`);
  });
  req.pipe(upstream);
});

server.on("upgrade", (req, clientSocket, head) => {
  const upstream = net.connect(UPSTREAM_PORT, UPSTREAM_HOST, () => {
    const headerLines = [`${req.method} ${req.url} HTTP/1.1`];
    for (const [k, v] of Object.entries(req.headers)) {
      if (Array.isArray(v)) {
        for (const item of v) headerLines.push(`${k}: ${item}`);
      } else {
        headerLines.push(`${k}: ${v}`);
      }
    }
    upstream.write(headerLines.join("\r\n") + "\r\n\r\n");
    if (head && head.length) upstream.write(head);
    upstream.pipe(clientSocket);
    clientSocket.pipe(upstream);
  });
  upstream.on("error", () => clientSocket.destroy());
  clientSocket.on("error", () => upstream.destroy());
});

server.listen(LISTEN_PORT, () => {
  console.log(
    `h2 proxy on https://localhost:${LISTEN_PORT} -> http://${UPSTREAM_HOST}:${UPSTREAM_PORT}`,
  );
});
