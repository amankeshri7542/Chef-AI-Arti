-- Onboarding v2 repair migration
-- Safe to run repeatedly in the Supabase SQL editor.
-- Keeps production aligned with the 7-step onboarding and profile editor.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS cooking_for VARCHAR(20),
  ADD COLUMN IF NOT EXISTS cooking_skill VARCHAR(20),
  ADD COLUMN IF NOT EXISTS time_preference VARCHAR(20),
  ADD COLUMN IF NOT EXISTS kitchen_setup TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS onboarding_v2_done BOOLEAN DEFAULT false;

-- The original users table accepted only veg/non-veg/eggetarian. The current
-- product also supports vegan and Jain preferences.
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_diet_type_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_diet_type_check
  CHECK (diet_type IN ('veg', 'non-veg', 'eggetarian', 'vegan', 'jain'));

-- Defensive constraints for values written by the application. NOT VALID lets
-- this migration be applied even if an old row contains an unexpected value;
-- new writes are still protected immediately.
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_cooking_for_check,
  DROP CONSTRAINT IF EXISTS users_cooking_skill_check,
  DROP CONSTRAINT IF EXISTS users_time_preference_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_cooking_for_check
    CHECK (cooking_for IS NULL OR cooking_for IN ('alone', 'couple', 'family', 'pg')) NOT VALID,
  ADD CONSTRAINT users_cooking_skill_check
    CHECK (cooking_skill IS NULL OR cooking_skill IN ('beginner', 'intermediate', 'expert')) NOT VALID,
  ADD CONSTRAINT users_time_preference_check
    CHECK (time_preference IS NULL OR time_preference IN ('15min', '30min', 'any')) NOT VALID;

COMMENT ON COLUMN public.users.cooking_for IS
  'Default household context: alone | couple | family | pg.';
COMMENT ON COLUMN public.users.cooking_skill IS
  'Instruction depth preference: beginner | intermediate | expert.';
COMMENT ON COLUMN public.users.time_preference IS
  'Typical cooking-time preference: 15min | 30min | any.';
COMMENT ON COLUMN public.users.kitchen_setup IS
  'Available equipment slugs used to avoid unsuitable recipe suggestions.';
COMMENT ON COLUMN public.users.onboarding_v2_done IS
  'True after the seven-question personalization flow has completed.';
