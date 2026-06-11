import { NextRequest, NextResponse } from 'next/server';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { isAdminRequest } from '@/lib/admin-auth';
import { createServerClient } from '@/lib/supabase';

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// DELETE — remove a community photo (DB row + S3 object)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const supabase = createServerClient();

  const { data: photo } = await supabase
    .from('recipe_photos')
    .select('id, s3_url')
    .eq('id', id)
    .single<{ id: string; s3_url: string }>();

  if (!photo) {
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
  }

  // Delete S3 object — key is the URL path after the bucket host.
  try {
    const bucket = process.env.AWS_S3_BUCKET_NAME!;
    const url = new URL(photo.s3_url);
    const key = decodeURIComponent(url.pathname.replace(/^\//, ''));
    if (key) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    }
  } catch (err) {
    // Log but don't block DB cleanup — orphaned S3 objects are harmless.
    console.error('[admin-photos] S3 delete failed:', (err as Error).message);
  }

  const { error } = await supabase.from('recipe_photos').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
