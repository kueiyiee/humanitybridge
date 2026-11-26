import { isIP } from 'node:net';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '../../db/index';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';

export async function validateStoryImageUrl(value: unknown): Promise<string> {
  if (typeof value !== 'string' || value.trim().length > 500) {
    throw new AppError(400, 'Story images must use an HTTPS image URL or a managed HumanityBridge upload');
  }
  const imageUrl = value.trim();
  const managed = imageUrl.match(/^\/api\/v1\/media\/public\/([a-f0-9-]+\.(?:jpe?g|png|webp|avif))$/i);
  if (managed) {
    const [file] = await db.select({ id: schema.mediaFiles.id })
      .from(schema.mediaFiles)
      .where(and(
        eq(schema.mediaFiles.safeFilename, managed[1]),
        eq(schema.mediaFiles.storageScope, 'PUBLIC_STORY'),
      ))
      .limit(1);
    if (!file) throw new AppError(400, 'The selected HumanityBridge media file is unavailable');
    return imageUrl;
  }

  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    throw new AppError(400, 'Enter a valid HTTPS image URL');
  }
  const hostname = parsed.hostname.toLowerCase();
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    (parsed.port && parsed.port !== '443') ||
    isIP(hostname.replace(/^\[|\]$/g, '')) ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.test') ||
    !env.storyImageAllowedHosts.includes(hostname)
  ) {
    throw new AppError(400, 'External image host is not approved. Use HumanityBridge media storage or a configured image host.');
  }
  const extension = parsed.pathname.match(/\.(jpe?g|png|webp|avif)$/i)?.[1]?.toLowerCase();
  const declaredFormat = (
    parsed.searchParams.get('fm') ||
    parsed.searchParams.get('format') ||
    (parsed.searchParams.get('auto') === 'format' ? 'auto' : '')
  ).toLowerCase();
  if (!extension && !['jpg', 'jpeg', 'png', 'webp', 'avif', 'auto'].includes(declaredFormat)) {
    throw new AppError(400, 'External image URLs must identify a supported image format');
  }
  return parsed.href;
}
