#!/usr/bin/env node

// ============================================================================
// Import BestBlogs OPML → config/bestblogs-sources.json
// ============================================================================
// Source: https://github.com/ginobefun/BestBlogs (shared by bestblogs.dev)
//
// Usage: node import-bestblogs-opml.js
// ============================================================================

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const SCRIPT_DIR = decodeURIComponent(new URL('.', import.meta.url).pathname);
const OPML_DIR = join(SCRIPT_DIR, '..', 'config', 'bestblogs', 'opml');
const OUTPUT_PATH = join(SCRIPT_DIR, '..', 'config', 'bestblogs-sources.json');

const OPML_FILES = {
  articles: 'BestBlogs_RSS_Articles.opml',
  podcasts: 'BestBlogs_RSS_Podcasts.opml',
  videos: 'BestBlogs_RSS_Videos.opml',
  twitters: 'BestBlogs_RSS_Twitters.opml'
};

function decodeXml(text) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseOpmlOutlines(xml) {
  const outlines = [];
  const regex = /<outline\b([^>]*)\/?>/gi;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const attrs = match[1];
    const title =
      attrs.match(/title="([^"]*)"/)?.[1] ||
      attrs.match(/text="([^"]*)"/)?.[1] ||
      '';
    const xmlUrl = attrs.match(/xmlUrl="([^"]*)"/)?.[1] || '';
    if (!title || !xmlUrl) continue;
    outlines.push({ title: decodeXml(title), xmlUrl: xmlUrl.replace(/^http:/, 'https:') });
  }
  return outlines;
}

function extractTwitterHandle(title) {
  const match = title.match(/\(@([A-Za-z0-9_]+)\)\s*$/);
  return match ? match[1] : null;
}

function youtubeUrlFromRss(rssUrl) {
  const channelMatch = rssUrl.match(/channel_id=([A-Za-z0-9_-]+)/);
  if (channelMatch) {
    return `https://www.youtube.com/channel/${channelMatch[1]}`;
  }
  const playlistMatch = rssUrl.match(/playlist_id=([A-Za-z0-9_-]+)/);
  if (playlistMatch) {
    return `https://www.youtube.com/playlist?list=${playlistMatch[1]}`;
  }
  return rssUrl;
}

async function main() {
  const articlesRaw = await readFile(join(OPML_DIR, OPML_FILES.articles), 'utf-8');
  const podcastsRaw = await readFile(join(OPML_DIR, OPML_FILES.podcasts), 'utf-8');
  const videosRaw = await readFile(join(OPML_DIR, OPML_FILES.videos), 'utf-8');
  const twittersRaw = await readFile(join(OPML_DIR, OPML_FILES.twitters), 'utf-8');

  const articles = parseOpmlOutlines(articlesRaw).map(({ title, xmlUrl }) => ({
    name: title,
    type: 'rss',
    rssUrl: xmlUrl,
    source: 'bestblogs',
    attribution: 'bestblogs.dev'
  }));

  const podcasts = parseOpmlOutlines(podcastsRaw).map(({ title, xmlUrl }) => ({
    name: title,
    rssUrl: xmlUrl,
    url: xmlUrl,
    source: 'bestblogs',
    attribution: 'bestblogs.dev',
    focus: '来自 bestblogs.dev 精选播客。'
  }));

  const videos = parseOpmlOutlines(videosRaw).map(({ title, xmlUrl }) => ({
    name: title,
    rssUrl: xmlUrl,
    url: youtubeUrlFromRss(xmlUrl),
    source: 'bestblogs',
    attribution: 'bestblogs.dev',
    focus: '来自 bestblogs.dev 精选视频频道。'
  }));

  const x_accounts = [];
  for (const { title, xmlUrl } of parseOpmlOutlines(twittersRaw)) {
    const handle = extractTwitterHandle(title);
    if (!handle) continue;
    const displayName = title.replace(/\(@[A-Za-z0-9_]+\)\s*$/, '').trim();
    x_accounts.push({
      name: displayName || handle,
      handle,
      fetchMethod: 'rss',
      rssUrl: xmlUrl,
      source: 'bestblogs',
      attribution: 'bestblogs.dev'
    });
  }

  const output = {
    _comment:
      'BestBlogs 扩展信息源。由 scripts/import-bestblogs-opml.js 从 OPML 生成，请勿手改条目；更新 OPML 后重新运行 import 脚本。',
    _attribution: {
      project: 'BestBlogs',
      attribution_zh: '信息源 OPML 来自 bestblogs.dev 的公开分享',
      attribution_en: 'OPML subscriptions shared publicly by bestblogs.dev',
      website: 'https://bestblogs.dev',
      repository: 'https://github.com/ginobefun/BestBlogs',
      article: 'https://www.ginonotes.com/posts/bestblogs-sources-part2-podcasts-videos',
      philosophy_zh: '追踪那些真正在做产品、有独立见解的建造者（Builders），而非只会搬运信息的网红（Influencers）。',
      philosophy_en: 'Follow builders who ship products and share original opinions — not influencers who only repackage news.'
    },
    _opml_files: {
      all: 'config/bestblogs/opml/BestBlogs_RSS_ALL.opml',
      articles: 'config/bestblogs/opml/BestBlogs_RSS_Articles.opml',
      podcasts: 'config/bestblogs/opml/BestBlogs_RSS_Podcasts.opml',
      videos: 'config/bestblogs/opml/BestBlogs_RSS_Videos.opml',
      twitters: 'config/bestblogs/opml/BestBlogs_RSS_Twitters.opml'
    },
    stats: {
      articles: articles.length,
      podcasts: podcasts.length,
      videos: videos.length,
      x_accounts: x_accounts.length,
      total: articles.length + podcasts.length + videos.length + x_accounts.length
    },
    blogs: articles,
    podcasts,
    videos,
    x_accounts
  };

  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');
  console.error(`Wrote ${OUTPUT_PATH}`);
  console.error(`  articles (blogs/rss): ${articles.length}`);
  console.error(`  podcasts: ${podcasts.length}`);
  console.error(`  videos: ${videos.length}`);
  console.error(`  x_accounts (rss): ${x_accounts.length}`);
  console.error(`  total: ${output.stats.total}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
