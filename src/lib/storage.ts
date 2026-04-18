import { supabase } from './supabase';

export type FrameImageAccessStrategy =
  | 'missing'
  | 'data-url'
  | 'public'
  | 'signed'
  | 'external'
  | 'inaccessible';

export interface ResolvedFrameImageUrl {
  originalUrl: string | null;
  resolvedUrl: string | null;
  strategy: FrameImageAccessStrategy;
  bucket?: string;
  path?: string;
  warning?: string;
  error?: string;
}

interface ParsedSupabaseStorageUrl {
  bucket: string;
  path: string;
  visibility: 'public' | 'signed' | 'authenticated';
}

interface ResolveFrameImageUrlOptions {
  expiresInSeconds?: number;
  preferSignedForSupabase?: boolean;
}

const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 60 * 2;

function parseSupabaseStorageUrl(url: string): ParsedSupabaseStorageUrl | null {
  try {
    const parsed = new URL(url);
    const patterns: Array<{
      regex: RegExp;
      visibility: ParsedSupabaseStorageUrl['visibility'];
    }> = [
      {
        regex: /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/,
        visibility: 'public',
      },
      {
        regex: /\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/,
        visibility: 'signed',
      },
      {
        regex: /\/storage\/v1\/object\/authenticated\/([^/]+)\/(.+)$/,
        visibility: 'authenticated',
      },
    ];

    for (const pattern of patterns) {
      const match = parsed.pathname.match(pattern.regex);
      if (!match) continue;

      return {
        bucket: decodeURIComponent(match[1]),
        path: decodeURIComponent(match[2]),
        visibility: pattern.visibility,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export async function resolveFrameImageUrlForAI(
  imageUrl: string | null | undefined,
  options: ResolveFrameImageUrlOptions = {},
): Promise<ResolvedFrameImageUrl> {
  if (!imageUrl) {
    return {
      originalUrl: null,
      resolvedUrl: null,
      strategy: 'missing',
      error: 'No frame image was found for this storyboard step.',
    };
  }

  if (imageUrl.startsWith('data:')) {
    return {
      originalUrl: imageUrl,
      resolvedUrl: imageUrl,
      strategy: 'data-url',
      warning:
        'Using an inline image payload because this frame does not have a shareable storage URL yet.',
    };
  }

  if (imageUrl.startsWith('blob:')) {
    return {
      originalUrl: imageUrl,
      resolvedUrl: null,
      strategy: 'inaccessible',
      error:
        'This frame image only exists in the current browser session. Save or polish the frame before running the GLM workflow.',
    };
  }

  const parsedStorageUrl = parseSupabaseStorageUrl(imageUrl);
  if (!parsedStorageUrl) {
    return {
      originalUrl: imageUrl,
      resolvedUrl: imageUrl,
      strategy: 'external',
    };
  }

  const expiresInSeconds =
    options.expiresInSeconds ?? DEFAULT_SIGNED_URL_TTL_SECONDS;
  const preferSignedForSupabase = options.preferSignedForSupabase ?? true;

  if (preferSignedForSupabase) {
    const { data, error } = await supabase.storage
      .from(parsedStorageUrl.bucket)
      .createSignedUrl(parsedStorageUrl.path, expiresInSeconds);

    if (!error && data?.signedUrl) {
      return {
        originalUrl: imageUrl,
        resolvedUrl: data.signedUrl,
        strategy: 'signed',
        bucket: parsedStorageUrl.bucket,
        path: parsedStorageUrl.path,
      };
    }

    if (parsedStorageUrl.visibility === 'public') {
      return {
        originalUrl: imageUrl,
        resolvedUrl: imageUrl,
        strategy: 'public',
        bucket: parsedStorageUrl.bucket,
        path: parsedStorageUrl.path,
        warning:
          'Signed URL generation was unavailable, so the workflow fell back to the existing public storage URL.',
      };
    }

    return {
      originalUrl: imageUrl,
      resolvedUrl: null,
      strategy: 'inaccessible',
      bucket: parsedStorageUrl.bucket,
      path: parsedStorageUrl.path,
      error:
        error?.message ||
        'A secure image link could not be created for this frame.',
    };
  }

  return {
    originalUrl: imageUrl,
    resolvedUrl: imageUrl,
    strategy: parsedStorageUrl.visibility === 'public' ? 'public' : 'external',
    bucket: parsedStorageUrl.bucket,
    path: parsedStorageUrl.path,
  };
}

/**
 * Upload a frame image (sketch or polished) to Supabase Storage
 * @param userId - Current user ID
 * @param boardId - Board ID
 * @param frameId - Frame ID
 * @param dataUrl - Base64 data URL of the image
 * @param type - Type of image (sketch or polished)
 * @returns Public URL of the uploaded image, or null if failed
 */
export async function uploadFrameImage(
  userId: string,
  boardId: string,
  frameId: string,
  dataUrl: string,
  type: 'sketch' | 'polished'
): Promise<string | null> {
  try {
    // Convert base64 data URL to blob
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const blob = new Blob([buffer], { type: 'image/png' });

    // Create unique file path
    const path = `${userId}/${boardId}/${frameId}_${type}_${Date.now()}.png`;

    // Upload to Supabase Storage
    const { error } = await supabase.storage
      .from('frames')
      .upload(path, blob, {
        contentType: 'image/png',
        upsert: true // Replace if exists
      });

    if (error) {
      console.error('Storage upload error:', error);
      throw error;
    }

    // Get public URL
    const { data } = supabase.storage.from('frames').getPublicUrl(path);
    return data.publicUrl;
  } catch (error) {
    console.error('Upload failed:', error);
    return null;
  }
}

/**
 * Delete a frame image from storage
 * @param url - Public URL of the image to delete
 */
export async function deleteFrameImage(url: string): Promise<void> {
  try {
    // Extract path from public URL
    const urlParts = url.split('/storage/v1/object/public/frames/');
    if (urlParts.length < 2) return;

    const path = urlParts[1];

    const { error } = await supabase.storage
      .from('frames')
      .remove([path]);

    if (error) {
      console.error('Storage delete error:', error);
    }
  } catch (error) {
    console.error('Delete failed:', error);
  }
}
