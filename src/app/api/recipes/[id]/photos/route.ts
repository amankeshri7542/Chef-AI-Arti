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

// ─── GET — fetch community photos for a recipe ────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: recipeId } = await params;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('recipe_photos')
    .select('id, s3_url, user_id, caption, created_at')
    .eq('recipe_id', recipeId)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('[photos] GET error:', error.message);
    return NextResponse.json({ photos: [] });
  }

  return NextResponse.json({ photos: data ?? [] });
}

// ─── POST — upload a community photo ─────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Login karo pehle' }, { status: 401 });
  }

  const { id: recipeId } = await params;
  const supabase = createServerClient();

  // Get internal user id
  const { data: userRow } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_user_id', userId)
    .single();

  if (!userRow) {
    return NextResponse.json({ error: 'User nahi mila' }, { status: 404 });
  }

  const internalUserId = userRow.id;

  // Require cooking history
  const { data: history } = await supabase
    .from('cooking_history')
    .select('id')
    .eq('recipe_id', recipeId)
    .eq('user_id', internalUserId)
    .limit(1)
    .single();

  if (!history) {
    return NextResponse.json(
      { error: 'Pehle recipe banao, phir photo upload karo! 🍳' },
      { status: 403 },
    );
  }

  const formData = await req.formData();
  const file = formData.get('image') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'Photo nahi mili' }, { status: 400 });
  }

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Sirf photo upload karo' }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Photo 5MB se chhoti honi chahiye' }, { status: 400 });
  }

  const bucket = process.env.AWS_S3_BUCKET_NAME!;
  const region = process.env.AWS_REGION!;
  const key = `community/${recipeId}/${internalUserId}-${Date.now()}.jpg`;

  const arrayBuffer = await file.arrayBuffer();
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(arrayBuffer),
      ContentType: 'image/jpeg',
    }),
  );

  const s3Url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

  // Insert into recipe_photos
  const { data: photoRow, error: insertError } = await supabase
    .from('recipe_photos')
    .insert({ recipe_id: recipeId, user_id: internalUserId, s3_url: s3Url, is_public: true })
    .select('id, s3_url, created_at')
    .single();

  if (insertError) {
    console.error('[photos] insert error:', insertError.message);
    return NextResponse.json({ error: 'Photo save nahi hui' }, { status: 500 });
  }

  // If recipe has no thumbnail yet → set this as the thumbnail
  const { data: recipe } = await supabase
    .from('recipes')
    .select('thumbnail_url')
    .eq('id', recipeId)
    .single();

  if (recipe && !recipe.thumbnail_url) {
    await supabase
      .from('recipes')
      .update({ thumbnail_url: s3Url, thumbnail_source: 'user' })
      .eq('id', recipeId);
  }

  return NextResponse.json({ photo: photoRow });
}
