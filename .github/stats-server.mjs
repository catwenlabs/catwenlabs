// Local wrapper to run github-readme-stats (Vercel serverless functions) as a plain HTTP server.
// Used by .github/workflows/stats.yml to self-host stats generation in CI.
import http from "node:http";
import statsHandler from "./api/index.js";
import topLangsHandler from "./api/top-langs.js";

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  // Vercel environment auto-injects req.query and res.send
  req.query = Object.fromEntries(url.searchParams.entries());
  res.send = (body) => {
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.end(body);
  };
  req.url = url.pathname + url.search;
  const handler = url.pathname.startsWith("/api/top-langs")
    ? topLangsHandler
    : statsHandler;
  try {
    await handler(req, res);
  } catch (e) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain");
    res.end("ERR: " + e.message);
  }
});

server.listen(3999, () => {
  console.log("grs local server on 3999");
});
