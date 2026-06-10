/**
 * scripts/validate-batch2.ts
 * Validates + auto-fixes the generated batch2 recipe files, dedups against the
 * existing seed set, then writes the merged result to scripts/seed/recipes-batch2.json.
 *
 * Run: npx tsx scripts/validate-batch2.ts
 */
import fs from 'fs';
import path from 'path';

const SEED = path.join(__dirname, 'seed');
const BATCH_FILES = ['recipes-batch2a.json', 'recipes-batch2b.json', 'recipes-batch2b-extra.json', 'recipes-batch2c.json', 'recipes-batch2d.json'];
const OUT = path.join(SEED, 'recipes-batch2.json');

const CATEGORY = ['sabzi', 'dal', 'roti', 'chawal', 'nashta', 'meetha'];
const DIET = ['veg', 'non-veg', 'eggetarian'];
const SPICE = ['mild', 'medium', 'hot'];
const STYLE = ['sukha', 'tariwala', 'bhuna', 'dum', 'tadka-based', 'steamed', 'fried', 'roasted', 'boiled'];
const REGION = ['UP', 'Bihar', 'Jharkhand', 'Delhi-NCR', 'Punjab', 'Haryana', 'Rajasthan', 'MP', 'Bengal', 'Uttarakhand', 'pan-north-indian'];
const HEAVY = ['halka', 'medium', 'bhaari'];
const MEAL = ['breakfast', 'lunch', 'dinner', 'snack'];
const SCALE = ['linear', 'salt', 'spice', 'oil', 'water', 'fixed'];
const VIBES = ['halki-dish', 'taakat-wali', 'jaldi-bane', 'bacchon-ki-fav', 'tyohar-special', 'teekha-alert', 'vrat-wali', 'comfort-food', 'tiffin-ready', 'monsoon-special', 'sardi-warmth', 'garmi-cool', 'protein-rich', 'one-pot', 'leftover-friendly', 'guest-special', 'bujurg-friendly', 'low-oil', 'bina-pyaz-lehsun'];

// crude closest-vibe map for common bad slugs
const VIBE_FIX: Record<string, string> = {
  'bhaari-dish': 'taakat-wali', 'meetha': 'bacchon-ki-fav', 'street-style': 'comfort-food',
  'punjabi-tadka': 'comfort-food', 'bihari-special': 'comfort-food', 'healthy': 'halki-dish',
  'quick': 'jaldi-bane', 'festive': 'tyohar-special', 'spicy': 'teekha-alert',
};

type Rec = Record<string, any>;

function leadingNum(s: string): number {
  const m = String(s).match(/(\d+(?:\.\d+)?)/);
  if (m) return parseFloat(m[1]);
  if (/half|aadh|adha/i.test(s)) return 0.5;
  return 1;
}

const existing = JSON.parse(fs.readFileSync(path.join(SEED, 'recipes.json'), 'utf-8')) as Rec[];
const existingNames = new Set(existing.map((r) => r.name_hinglish.trim().toLowerCase()));

const all: Rec[] = [];
const errors: string[] = [];
let fixes = 0;

for (const file of BATCH_FILES) {
  const p = path.join(SEED, file);
  if (!fs.existsSync(p)) { errors.push(`MISSING FILE: ${file}`); continue; }
  const arr = JSON.parse(fs.readFileSync(p, 'utf-8')) as Rec[];
  console.log(`${file}: ${arr.length} recipes`);
  for (const r of arr) all.push(r);
}

const seenNames = new Set<string>();
for (const r of all) {
  const n = r.name_hinglish;
  const key = n?.trim().toLowerCase();
  const tag = `"${n}"`;

  // auto-fixes
  if (r.thumbnail_url === undefined) { r.thumbnail_url = null; fixes++; }
  if (!r.thumbnail_source) { r.thumbnail_source = 'none'; fixes++; }
  if (!r.source) { r.source = 'curated'; fixes++; }
  if (r.cooked_count === undefined) { r.cooked_count = 0; fixes++; }
  if (r.embedding_text === undefined) { r.embedding_text = null; fixes++; }
  if (Array.isArray(r.vibes)) {
    r.vibes = r.vibes.map((v: string) => {
      if (VIBES.includes(v)) return v;
      const fixed = VIBE_FIX[v] ?? 'comfort-food';
      errors.push(`${tag}: fixed bad vibe '${v}' -> '${fixed}'`);
      fixes++;
      return fixed;
    });
  }

  // required-field checks
  for (const f of ['name_hinglish', 'category', 'diet_type', 'ingredients', 'steps', 'spice_level', 'cooking_style', 'region_origin', 'heaviness']) {
    if (r[f] === undefined || r[f] === null) errors.push(`${tag}: missing ${f}`);
  }
  if (!CATEGORY.includes(r.category)) errors.push(`${tag}: bad category '${r.category}'`);
  if (!DIET.includes(r.diet_type)) errors.push(`${tag}: bad diet_type '${r.diet_type}'`);
  if (!SPICE.includes(r.spice_level)) errors.push(`${tag}: bad spice_level '${r.spice_level}'`);
  if (!STYLE.includes(r.cooking_style)) errors.push(`${tag}: bad cooking_style '${r.cooking_style}'`);
  if (!REGION.includes(r.region_origin)) errors.push(`${tag}: bad region_origin '${r.region_origin}'`);
  if (!HEAVY.includes(r.heaviness)) errors.push(`${tag}: bad heaviness '${r.heaviness}'`);
  if (Array.isArray(r.meal_type)) {
    for (const m of r.meal_type) if (!MEAL.includes(m)) errors.push(`${tag}: bad meal_type '${m}'`);
  } else errors.push(`${tag}: meal_type not array`);

  // ingredients
  if (Array.isArray(r.ingredients)) {
    for (const ing of r.ingredients) {
      if (!ing.scale_type || !SCALE.includes(ing.scale_type)) errors.push(`${tag}: ingredient '${ing.name}' bad/missing scale_type '${ing.scale_type}'`);
      if (!ing.qty_desi || !ing.qty_metric) errors.push(`${tag}: ingredient '${ing.name}' missing qty`);
    }
    // oil sanity
    const oil = r.ingredients.filter((i: Rec) => i.scale_type === 'oil');
    for (const o of oil) {
      if (/chammach/i.test(o.qty_desi) && leadingNum(o.qty_desi) > 3) errors.push(`${tag}: oil > 3 chammach (${o.qty_desi})`);
    }
  } else errors.push(`${tag}: ingredients not array`);

  // steps
  if (Array.isArray(r.steps)) {
    if (r.steps.length < 3) errors.push(`${tag}: <3 steps`);
    if (r.steps.length > 10) errors.push(`${tag}: >10 steps`);
  } else errors.push(`${tag}: steps not array`);

  // vrat rules
  if (r.is_vrat_friendly === true) {
    const ex = (r.excluded_items || []).map((x: string) => x.toLowerCase());
    if (!ex.includes('onion') || !ex.includes('garlic')) errors.push(`${tag}: vrat recipe missing onion/garlic in excluded_items`);
    if (r.diet_type !== 'veg') errors.push(`${tag}: vrat recipe not veg`);
    const ingNames = (r.ingredients || []).map((i: Rec) => i.name.toLowerCase()).join(' ');
    if (/pyaaz|pyaz|onion|lehsun|lahsun|garlic/.test(ingNames)) errors.push(`${tag}: vrat recipe has onion/garlic ingredient`);
  }

  // dedup
  if (existingNames.has(key)) errors.push(`${tag}: DUPLICATE of existing seed recipe`);
  if (seenNames.has(key)) errors.push(`${tag}: DUPLICATE within batch2`);
  seenNames.add(key);
}

console.log('\n━━━ Validation report ━━━');
console.log(`Total batch2 recipes: ${all.length}`);
console.log(`Auto-fixes applied: ${fixes}`);
console.log(`Issues: ${errors.length}`);
for (const e of errors) console.log('  - ' + e);

// category + region breakdown
const byCat: Record<string, number> = {};
const byRegion: Record<string, number> = {};
let vrat = 0;
for (const r of all) {
  byCat[r.category] = (byCat[r.category] || 0) + 1;
  byRegion[r.region_origin] = (byRegion[r.region_origin] || 0) + 1;
  if (r.is_vrat_friendly) vrat++;
}
console.log('\nBy category:', byCat);
console.log('By region:', byRegion);
console.log('Vrat-friendly:', vrat);

const hardErrors = errors.filter((e) => !e.includes('fixed bad vibe'));
if (hardErrors.length === 0) {
  fs.writeFileSync(OUT, JSON.stringify(all, null, 2));
  console.log(`\n✅ Wrote merged ${all.length} recipes to ${path.relative(process.cwd(), OUT)}`);
} else {
  console.log(`\n⚠️  ${hardErrors.length} hard issues — NOT writing merged file until resolved.`);
  process.exit(1);
}
