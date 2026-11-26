import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { and, desc, eq, gt, isNull, lte, notExists, or, sql } from 'drizzle-orm';
import { createServer as createViteServer } from 'vite';
import { createApiApp } from './src/server/app';
import { env, validateProductionEnvironment } from './src/server/config/env';
import { checkDatabaseConnection, db, schema, nowUtc } from './src/db/index';
import { logger } from './src/server/config/logger';
import { CMS_CONTENT_SECTIONS, type CmsContentType } from './packages/shared/types';

function escapeHtmlAttribute(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character);
}

async function startServer() {
  validateProductionEnvironment();
  await checkDatabaseConnection();

  const app = createApiApp();
  const distDir = path.resolve(process.cwd(), 'dist');
  const vite = env.isProduction ? null : await createViteServer({
    server: {
      middlewareMode: true,
      ws: process.env.DISABLE_HMR !== 'true'
        ? { port: Number(process.env.VITE_HMR_PORT || 26000) }
        : undefined,
    },
    appType: 'spa',
  });

  app.get('/sitemap.xml', async (_req, res) => {
    try {
      const stories = await db.select({
        slug: schema.stories.slug,
        publishedAt: schema.stories.publishedAt,
      }).from(schema.stories)
        .innerJoin(schema.storyConsents, eq(schema.stories.id, schema.storyConsents.storyId))
        .where(and(
          eq(schema.stories.status, 'PUBLISHED'),
          eq(schema.storyConsents.consentStory, true),
          or(
            eq(schema.storyConsents.consentMedia, true),
            and(
              isNull(schema.stories.coverImageUrl),
              notExists(db.select({ value: sql<number>`1` }).from(schema.storyMedia)
                .where(eq(schema.storyMedia.storyId, schema.stories.id))),
            ),
          ),
          or(eq(schema.stories.isMinorSubject, false), eq(schema.storyConsents.guardianConsentRecorded, true)),
          isNull(schema.storyConsents.withdrawnAt),
          isNull(schema.stories.deletedAt),
        ))
        .orderBy(desc(schema.stories.publishedAt));
      const now = nowUtc();
      const cmsRecords = await db.select({
        type: schema.cmsContent.type,
        slug: schema.cmsContent.slug,
        publishedAt: schema.cmsContent.publishedAt,
      }).from(schema.cmsContent).where(and(
        isNull(schema.cmsContent.deletedAt),
        or(
          eq(schema.cmsContent.status, 'PUBLISHED'),
          and(
            eq(schema.cmsContent.status, 'SCHEDULED'),
            lte(schema.cmsContent.scheduledAt, now),
          ),
        ),
        or(isNull(schema.cmsContent.expiresAt), gt(schema.cmsContent.expiresAt, now)),
      ));
      const storyEntries = stories.map((story) => {
        const url = new URL(`/stories/${encodeURIComponent(story.slug)}`, env.appUrl).href;
        const lastmod = story.publishedAt ? new Date(story.publishedAt).toISOString() : '';
        return `<url><loc>${escapeHtmlAttribute(url)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`;
      }).join('');
      const cmsEntries = cmsRecords.map((record) => {
        const section = CMS_CONTENT_SECTIONS[record.type as CmsContentType];
        if (!section) return '';
        const url = new URL(`/${section.path}/${encodeURIComponent(record.slug)}`, env.appUrl).href;
        const lastmod = record.publishedAt ? new Date(record.publishedAt).toISOString() : '';
        return `<url><loc>${escapeHtmlAttribute(url)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`;
      }).join('');
      res.setHeader('Cache-Control', 'no-store');
      res.type('application/xml').send(
        `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${storyEntries}${cmsEntries}</urlset>`,
      );
    } catch (error) {
      logger.error('Published story sitemap could not be generated', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(503).type('text').send('The published-content sitemap is temporarily unavailable.');
    }
  });

  app.get('/stories/:slug', async (req, res, next) => {
    try {
      const [story] = await db.select({
        title: schema.stories.title,
        excerpt: schema.stories.excerpt,
        slug: schema.stories.slug,
        coverImageUrl: schema.stories.coverImageUrl,
        coverAltText: schema.stories.coverAltText,
        consentMedia: schema.storyConsents.consentMedia,
      }).from(schema.stories)
        .innerJoin(schema.storyConsents, eq(schema.stories.id, schema.storyConsents.storyId))
        .where(and(
          eq(schema.stories.slug, req.params.slug),
          eq(schema.stories.status, 'PUBLISHED'),
          eq(schema.storyConsents.consentStory, true),
          or(
            eq(schema.storyConsents.consentMedia, true),
            and(
              isNull(schema.stories.coverImageUrl),
              notExists(db.select({ value: sql<number>`1` }).from(schema.storyMedia)
                .where(eq(schema.storyMedia.storyId, schema.stories.id))),
            ),
          ),
          or(eq(schema.stories.isMinorSubject, false), eq(schema.storyConsents.guardianConsentRecorded, true)),
          isNull(schema.storyConsents.withdrawnAt),
          isNull(schema.stories.deletedAt),
        ))
        .limit(1);
      if (!story) return next();

      const canonicalUrl = new URL(`/stories/${encodeURIComponent(story.slug)}`, env.appUrl).href;
      let imageUrl = '';
      if (story.consentMedia && story.coverImageUrl) {
        try {
          const image = new URL(story.coverImageUrl, env.appUrl);
          const appOrigin = new URL(env.appUrl).origin;
          if (image.origin === appOrigin ||
            (image.protocol === 'https:' && env.storyImageAllowedHosts.includes(image.hostname.toLowerCase()))) {
            imageUrl = image.href;
          }
        } catch {
          imageUrl = '';
          logger.warn('Invalid featured story image omitted from social metadata', { slug: story.slug });
        }
      }
      const metadata = [
        ['name', 'description', story.excerpt],
        ['property', 'og:title', story.title],
        ['property', 'og:description', story.excerpt],
        ['property', 'og:type', 'article'],
        ['property', 'og:url', canonicalUrl],
        ['property', 'og:image', imageUrl],
        ['property', 'og:image:alt', story.coverAltText || story.title],
        ['name', 'twitter:card', imageUrl ? 'summary_large_image' : 'summary'],
        ['name', 'twitter:title', story.title],
        ['name', 'twitter:description', story.excerpt],
      ].filter(([, , content]) => content);
      const metaTags = metadata.map(([attribute, name, content]) =>
        `<meta ${attribute}="${escapeHtmlAttribute(name)}" content="${escapeHtmlAttribute(content)}">`,
      ).join('');
      const canonicalTag = `<link rel="canonical" href="${escapeHtmlAttribute(canonicalUrl)}">`;
      const titleTag = `<title>${escapeHtmlAttribute(`${story.title} | HumanityBridge`)}</title>`;
      const template = fs.readFileSync(
        env.isProduction ? path.join(distDir, 'index.html') : path.resolve(process.cwd(), 'index.html'),
        'utf-8',
      );
      const html = vite
        ? await vite.transformIndexHtml(req.originalUrl, template)
        : template;
      const cleanHead = metadata.reduce((current, [attribute, name]) =>
        current.replace(new RegExp(`<meta\\s+${attribute}=["']${name}["'][^>]*\\/?>`, 'ig'), ''),
      html);
      res.status(200).type('html').send(
        cleanHead.replace(/<title>[\s\S]*?<\/title>/i, titleTag)
          .replace('</head>', `${metaTags}${canonicalTag}</head>`),
      );
    } catch (error) {
      logger.error('Published story page could not be rendered', {
        slug: req.params.slug,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(503).type('text').send('This story page is temporarily unavailable.');
    }
  });

  if (env.isProduction) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    if (!vite) throw new Error('Vite development server was not initialized.');
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) return next();
      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        const template = fs.readFileSync(indexPath, 'utf-8');
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (err) {
        next(err);
      }
    });
  }

  const publishScheduledStories = async () => {
    try {
      const now = nowUtc();
      const due = await db.select({
        id: schema.stories.id,
        publishedAt: schema.stories.publishedAt,
      }).from(schema.stories).where(and(
        eq(schema.stories.status, 'SCHEDULED'),
        isNull(schema.stories.deletedAt),
      ));
      for (const story of due) {
        if (!story.publishedAt) continue;
        const scheduledAt = new Date(String(story.publishedAt));
        if (scheduledAt.getTime() <= new Date(now).getTime()) {
          await db.update(schema.stories).set({
            status: 'PUBLISHED',
            updatedAt: now,
          }).where(eq(schema.stories.id, story.id));
          logger.info('Scheduled story publication completed', { storyId: story.id });
        }
      }
    } catch (error) {
      logger.error('Scheduled story publisher failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
  await publishScheduledStories();
  setInterval(() => { void publishScheduledStories(); }, 60_000).unref();

  app.listen(env.port, '0.0.0.0', () => {
    logger.info(`HumanityBridge full-stack platform running on http://0.0.0.0:${env.port}`);
  });
}

startServer().catch((err) => {
  logger.error('HumanityBridge startup failed', {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
