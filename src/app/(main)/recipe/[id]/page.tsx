import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase'
import RecipeDetailClient from './RecipeDetailClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function RecipeDetailPage({ params }: Props) {
  const { id } = await params
  const { userId } = await auth()  // won't throw — just null if unauth

  const supabase = createServerClient()

  // Always fetch recipe (public)
  const { data: recipe, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !recipe) {
    return (
      <div className="flex min-h-screen items-center justify-center flex-col gap-3 text-center px-6">
        <span className="text-4xl">🙁</span>
        <p className="text-[16px] font-semibold text-[#1A1A1A]">Yeh recipe nahi mili</p>
        <p className="text-[13px] text-[#8B7355]">Shayad delete ho gayi. Ghar wapas jaao.</p>
        <a href="/home" className="mt-2 rounded-xl bg-[#E8640C] px-6 py-3 text-white text-[14px] font-semibold">
          Ghar jaao →
        </a>
      </div>
    )
  }

  // Fetch user only if logged in
  let user = null
  if (userId) {
    const { data } = await supabase
      .from('users')
      .select('family_size, subscription_status, preferred_unit, is_vrat_mode')
      .eq('clerk_user_id', userId)
      .single()
    user = data
  }

  return (
    <RecipeDetailClient
      recipe={recipe}
      user={user}
      isAuthenticated={!!userId}
    />
  )
}
