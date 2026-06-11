import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { isAdminRequest } from '@/lib/admin-auth';
import { createServerClient } from '@/lib/supabase';
import { validateFoodPhoto } from '@/lib/openai';

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// POST — admin uploads a community photo on behalf of a recipe
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: recipeId } = await params;
  const supabase = createServerClient();

  const { data: recipe } = await supabase
    .from('recipes')
    .select('id')
    .eq('id', recipeId)
    .single();
  if (!recipe) {
    return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get('image') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 });
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Only image files allowed' }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image must be under 5MB' }, { status: 400 });
  }

  const arrayBuf = await file.arrayBuffer();
  const imageBase64 = Buffer.from(arrayBuf).toString('base64');
  const { valid } = await validateFoodPhoto(imageBase64);
  if (!valid) {
    return NextResponse.json(
      { error: 'Not a food photo — upload a photo of the cooked dish' },
      { status: 400 },
    );
  }

  const bucket = process.env.AWS_S3_BUCKET_NAME!;
  const region = process.env.AWS_REGION!;
  const key = `community/${recipeId}/admin-${Date.now()}.jpg`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(arrayBuf),
      ContentType: 'image/jpeg',
    }),
  );

  const s3Url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

  const { data: photoRow, error: insertError } = await supabase
    .from('recipe_photos')
    .insert({ recipe_id: recipeId, user_id: 'admin', s3_url: s3Url, is_public: true })
    .select('id, s3_url, created_at')
    .single();

  if (insertError) {
    console.error('[admin-photo] insert error:', insertError.message);
    return NextResponse.json({ error: 'Failed to save photo' }, { status: 500 });
  }

  return NextResponse.json({ photo: photoRow });
}
