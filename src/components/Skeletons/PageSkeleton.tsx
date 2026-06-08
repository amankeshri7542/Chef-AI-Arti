import RecipeCardSkeleton from './RecipeCardSkeleton';

export default function PageSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <RecipeCardSkeleton />
      <RecipeCardSkeleton />
      <RecipeCardSkeleton />
      <RecipeCardSkeleton />
    </div>
  );
}
