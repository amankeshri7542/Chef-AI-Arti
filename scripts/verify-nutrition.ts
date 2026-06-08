import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { count } = await supabase
    .from('recipes')
    .select('*', { count: 'exact', head: true })
    .not('nutrition', 'is', null);
  console.log(`\nnutrition IS NOT NULL: ${count}\n`);

  const { data } = await supabase
    .from('recipes')
    .select('name_hinglish, nutrition')
    .not('nutrition', 'is', null)
    .limit(5);

  for (const r of data ?? []) {
    const n = r.nutrition;
    console.log(
      `${r.name_hinglish} → ${n.heaviness} | ${n.per_serving.calories} kcal | P:${n.per_serving.protein_g}g C:${n.per_serving.carbs_g}g F:${n.per_serving.fat_g}g Fi:${n.per_serving.fiber_g}g [${n.confidence}]`,
    );
  }
}

main().catch(console.error);
