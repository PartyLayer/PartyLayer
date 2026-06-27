import type { Metadata } from 'next';

/**
 * Route-scoped metadata for /cost-demo only. The root layout's title template and
 * generic PartyLayer SDK description do not describe this page, so override them
 * here. `title.absolute` bypasses the root "%s | PartyLayer" template.
 */
const title = 'Transaction cost visibility · PartyLayer';
const description =
  'Read live pre-submission cost estimates and a captured paid_traffic_cost from a Canton validator, through PartyLayer cost hooks and CostPreview (CIP-0104 reference).';

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  openGraph: { title, description },
  twitter: { title, description },
};

export default function CostDemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
