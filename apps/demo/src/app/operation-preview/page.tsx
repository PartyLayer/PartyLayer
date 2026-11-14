import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OperationPreview } from './preview';

export const metadata: Metadata = { title: 'Operation kit local preview', robots: { index: false, follow: false } };

export default function Page() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <OperationPreview />;
}
