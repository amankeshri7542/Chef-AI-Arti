import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import ThaliClient from './ThaliClient';

export default async function AajKiThaliPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in?redirect_url=/aaj-ki-thali');

  return <ThaliClient />;
}
