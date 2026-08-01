// REST-based stats fetcher for github-readme-stats.
// The GraphQL API used by the original fetchStats is not accessible with
// GITHUB_TOKEN (integration token) — REST works fine. We fetch the same
// numbers via REST and reuse the original renderStatsCard for identical styling.
import { calculateRank } from "./src/calculateRank.js";

async function json(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`REST ${res.status} for ${url}`);
  return res.json();
}

export async function fetchStatsREST(username, token) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const base = "https://api.github.com";

  // user profile
  const user = await json(`${base}/users/${username}`, headers);

  // all repos (paginated) -> total stars, repo count
  let totalStars = 0;
  let repoCount = 0;
  let page = 1;
  for (;;) {
    const repos = await json(
      `${base}/users/${username}/repos?per_page=100&page=${page}&sort=stargazers_count`,
      headers,
    );
    if (!Array.isArray(repos) || repos.length === 0) break;
    totalStars += repos.reduce((s, r) => s + r.stargazers_count, 0);
    repoCount += repos.length;
    if (repos.length < 100) break;
    page += 1;
  }

  // search-based counters
  const search = async (q) => {
    const d = await json(
      `${base}/search/commits?q=${encodeURIComponent(q)}&per_page=1`,
      headers,
    );
    return d.total_count || 0;
  };
  const totalCommits = await search(`author:${username}`);
  const totalPRs = await search(`author:${username} type:pr`);
  const totalIssues = await search(`author:${username} type:issue`);
  const totalReviews = await search(`reviewed-by:${username} type:pr`);

  // contributed repos (owner + collaborator + org member)
  let contributedTo = 0;
  try {
    const contrib = await json(
      `${base}/users/${username}/repos?per_page=100&affiliation=owner,collaborator,organization_member`,
      headers,
    );
    if (Array.isArray(contrib)) contributedTo = contrib.length;
  } catch {
    contributedTo = repoCount;
  }

  const followers = user.followers || 0;
  const stats = {
    name: user.name || user.login,
    totalPRs,
    totalPRsMerged: 0,
    mergedPRsPercentage: 0,
    totalReviews,
    totalCommits,
    totalIssues,
    totalStars,
    totalDiscussionsStarted: 0,
    totalDiscussionsAnswered: 0,
    contributedTo,
    rank: { level: "C", percentile: 100 },
  };
  stats.rank = calculateRank({
    all_commits: false,
    commits: totalCommits,
    prs: totalPRs,
    issues: totalIssues,
    reviews: totalReviews,
    repos: repoCount,
    stars: totalStars,
    followers,
  });
  return stats;
}
