import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_IMAGES_BUCKET = 'images';

let cachedClient: SupabaseClient | null = null;
let cachedLegacyMetadataUserId: string | null | undefined;

function getSupabaseUrl() {
  return String(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
}

function getSupabaseServiceRoleKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
}

function sanitizePathSegment(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function extensionForMimeType(mimeType: string) {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('gif')) return 'gif';
  return 'jpg';
}

function createStoragePath(input: { ownerKey: string; folder: string; fileName?: string; mimeType: string }) {
  const ownerKey = sanitizePathSegment(input.ownerKey) || 'mulen-project';
  const folder = sanitizePathSegment(input.folder) || 'misc';
  const providedName = input.fileName?.split('/').pop()?.split('\\').pop() || '';
  const baseName = sanitizePathSegment(providedName.replace(/\.[^.]+$/, '')) || `${folder}-${Date.now()}`;
  const extension = providedName.includes('.') ? providedName.split('.').pop() || extensionForMimeType(input.mimeType) : extensionForMimeType(input.mimeType);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${ownerKey}/${folder}/${Date.now()}-${suffix}-${baseName}.${extension}`;
}

function getSupabaseAdminClient() {
  if (cachedClient) return cachedClient;

  const url = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  if (!url || !serviceRoleKey) {
    return null;
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedClient;
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function decodeDataUrl(dataUrl: string) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Inline image payload is not a valid base64 data URL.');
  }

  return {
    mimeType: match[1] || 'image/jpeg',
    buffer: Buffer.from(match[2] || '', 'base64'),
  };
}

export function canUseSupabaseStorage() {
  return Boolean(getSupabaseAdminClient());
}

async function resolveLegacyMetadataUserId(ownerKey?: string) {
  if (cachedLegacyMetadataUserId !== undefined) {
    return cachedLegacyMetadataUserId;
  }

  const explicitUserId = String(process.env.MULEN_SUPABASE_USER_ID || '').trim();
  if (looksLikeUuid(explicitUserId)) {
    cachedLegacyMetadataUserId = explicitUserId;
    return cachedLegacyMetadataUserId;
  }

  if (ownerKey && looksLikeUuid(ownerKey)) {
    cachedLegacyMetadataUserId = ownerKey;
    return cachedLegacyMetadataUserId;
  }

  const client = getSupabaseAdminClient();
  if (!client) {
    cachedLegacyMetadataUserId = null;
    return cachedLegacyMetadataUserId;
  }

  try {
    const { data, error } = await client.from('users').select('id').limit(2);
    if (error || !Array.isArray(data)) {
      cachedLegacyMetadataUserId = null;
      return cachedLegacyMetadataUserId;
    }

    cachedLegacyMetadataUserId = data.length === 1 && looksLikeUuid(String(data[0]?.id || '')) ? String(data[0].id) : null;
    return cachedLegacyMetadataUserId;
  } catch {
    cachedLegacyMetadataUserId = null;
    return cachedLegacyMetadataUserId;
  }
}

export async function uploadDataUrlToSupabase(input: {
  ownerKey: string;
  folder: string;
  fileName?: string;
  dataUrl: string;
  mimeType?: string;
}) {
  const client = getSupabaseAdminClient();
  if (!client) {
    throw new Error('Supabase storage is not configured.');
  }

  const decoded = decodeDataUrl(input.dataUrl);
  const mimeType = input.mimeType || decoded.mimeType || 'image/jpeg';
  const storagePath = createStoragePath({
    ownerKey: input.ownerKey,
    folder: input.folder,
    fileName: input.fileName,
    mimeType,
  });

  const { data, error } = await client.storage.from(SUPABASE_IMAGES_BUCKET).upload(storagePath, decoded.buffer, {
    contentType: mimeType,
    cacheControl: '3600',
    upsert: false,
  });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  const { data: publicUrlData } = client.storage.from(SUPABASE_IMAGES_BUCKET).getPublicUrl(data.path);
  return {
    bucket: SUPABASE_IMAGES_BUCKET,
    storagePath: data.path,
    publicUrl: publicUrlData.publicUrl,
    mimeType,
  };
}

export async function persistSavedImageMetadata(input: {
  ownerKey?: string;
  fileName: string;
  storagePath: string;
  category: 'reference' | 'style';
  fileSize?: number;
}) {
  const client = getSupabaseAdminClient();
  if (!client) return false;

  const userId = await resolveLegacyMetadataUserId(input.ownerKey);
  if (!userId) return false;

  const { error } = await client.from('saved_images').insert({
    user_id: userId,
    file_name: input.fileName,
    storage_path: input.storagePath,
    category: input.category,
    file_size: input.fileSize ?? 0,
  });

  return !error;
}

export async function persistGeneratedImageMetadata(input: {
  ownerKey?: string;
  prompt: string;
  storagePath: string;
  resolution?: string;
  aspectRatio?: string;
  params?: Record<string, unknown>;
}) {
  const client = getSupabaseAdminClient();
  if (!client) return false;

  const userId = await resolveLegacyMetadataUserId(input.ownerKey);
  if (!userId) return false;

  const { error } = await client.from('generated_images').insert({
    user_id: userId,
    prompt: input.prompt,
    storage_path: input.storagePath,
    resolution: input.resolution ?? null,
    aspect_ratio: input.aspectRatio ?? null,
    params: input.params ?? {},
  });

  return !error;
}
