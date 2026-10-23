import type { Metadata } from 'next';
import AuthenticationContent from './content';

const title = 'Canton Application Authentication';
const description = 'Add server-verified Canton sign-in to PartyLayer with single-use challenges, exact origin and account binding, and explicit logout.';
const url = 'https://partylayer.xyz/docs/authentication';
export const metadata: Metadata = {
  title, description, alternates: { canonical: url }, openGraph: { title, description, url },
};

export default function AuthenticationPage() {
  return <AuthenticationContent />;
}
