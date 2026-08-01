// Local wrapper to run github-readme-stats (Vercel serverless functions) as a plain HTTP server.
// Used by .github/workflows/stats.yml to self-host stats generation in CI.
// Stats card uses a REST-based fetcher because GITHUB_TOKEN cannot access the GraphQL API.
import http from "node:http";
import { renderStatsCard } from "./src/cards/stats.js";
import { fetchStatsREST } from "./custom-stats.mjs";
import topLangsHandler from "./api/top-langs.js";

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  req.query = Object.fromEntries(url.searchParams.entries());
  res.send = (body) => {
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.end(body);
  };
  req.url = url.pathname + url.search;

  try {
    if (url.pathname.startsWith("/api/top-langs")) {
      await topLangsHandler(req, res);
    } else {
      // stats card via REST fetcher
      const { username } = req.query;
      if (!username) {
        res.statusCode = 400;
        res.end("Missing username");
        return;
      }
      const token = process.env.PAT_1 || process.env.GITHUB_TOKEN || "";
      const stats = await fetchStatsREST(username, token);
      const q = req.query;
      const hideTitle = q.hide_title === "true";
      const showIcons = q.show_icons === "true";
      const hide = q.hide ? q.hide.split(",") : [];
      const svg = renderStatsCard(stats, {
        hide,
        show_icons: showIcons,
        hide_title: hideTitle,
        hide_border: q.hide_border === "true",
        card_width: parseInt(q.card_width, 10) || undefined,
        hide_rank: q.hide_rank === "true",
        include_all_commits: q.include_all_commits === "true",
        line_height: q.line_height,
        title_color: q.title_color,
        ring_color: q.ring_color,
        icon_color: q.icon_color,
        text_color: q.text_color,
        text_bold: q.text_bold === "true",
        bg_color: q.bg_color,
        theme: q.theme || "default",
        custom_title: q.custom_title,
        border_radius: parseInt(q.border_radius, 10) || undefined,
        border_color: q.border_color,
        number_format: q.number_format,
        locale: q.locale ? q.locale.toLowerCase() : null,
        disable_animations: q.disable_animations === "true",
        show: q.show ? q.show.split(",") : [],
      });
      res.send(svg);
    }
  } catch (e) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain");
    res.end("ERR: " + e.message);
  }
});

server.listen(3999, () => {
  console.log("grs local server on 3999");
});
