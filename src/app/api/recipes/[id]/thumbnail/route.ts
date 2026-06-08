import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createServerClient } from '@/lib/supabase';

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id: recipeId } = await params;

  const formData = await req.formData();
  const file = formData.get('image') as File | null;
  if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 });

  // Validate
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Sirf photo upload karo' }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Photo 5MB se chhoti honi chahiye' }, { status: 400 });
  }

  const bucket = process.env.AWS_S3_BUCKET_NAME!;
  const region = process.env.AWS_REGION!;
  const key = `thumbnails/${recipeId}/${userId}-${Date.now()}.jpg`;

  const arrayBuffer = await file.arrayBuffer();
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: Buffer.from(arrayBuffer),
    ContentType: file.type,
  }));

  const thumbnailUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

  const supabase = createServerClient();
  await supabase
    .from('recipes')
    .update({ thumbnail_url: thumbnailUrl })
    .eq('id', recipeId);

  return NextResponse.json({ thumbnail_url: thumbnailUrl });
}
