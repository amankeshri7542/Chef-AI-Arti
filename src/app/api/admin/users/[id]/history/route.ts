import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin-auth';
import { createServerClient } from '@/lib/supabase';

// GET — a user's cooking history (most recent 50)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('cooking_history')
    .select('cooked_at, family_size, recipes(name_hinglish)')
    .eq('user_id', id)
    .order('cooked_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const history = (data ?? []).map((row) => {
    const r = row as unknown as {
      cooked_at: string;
      family_size: number;
      recipes: { name_hinglish: string } | null;
    };
    return {
      recipe_name: r.recipes?.name_hinglish ?? 'Unknown',
      cooked_at: r.cooked_at,
      family_size: r.family_size,
    };
  });

  return NextResponse.json({ history });
}
