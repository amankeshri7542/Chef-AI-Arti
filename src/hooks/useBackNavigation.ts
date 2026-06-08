'use client';

import { useRouter } from 'next/navigation';

export function useBackNavigation(fallback: string = '/home') {
  const router = useRouter();
  return function goBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  };
}
