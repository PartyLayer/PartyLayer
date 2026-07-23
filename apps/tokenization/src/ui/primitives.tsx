/**
 * Small presentational helpers for the demo chrome. These are the APP's own UI
 * (cards, skeletons, badges, states), distinct from the themed PartyLayer
 * primitives (ConnectButton, PartyAvatar, CostPreview, TransactionToast) which the
 * sections import from `@partylayer/react`.
 */
import type { ReactNode } from 'react';

export function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="card">
      <header className="card-head">
        <h2>{title}</h2>
        {hint ? <span className="card-hint">{hint}</span> : null}
      </header>
      <div className="card-body">{children}</div>
    </section>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="skeleton" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-row" />
      ))}
    </div>
  );
}

export function ErrorState({ error }: { error: Error }) {
  return (
    <div className="state state-error" role="alert">
      <strong>Something went wrong.</strong>
      <span>{error.message}</span>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="state state-empty">{children}</div>;
}

export function Badge({
  tone = 'neutral',
  title,
  children,
}: {
  tone?: 'neutral' | 'lock' | 'ok';
  title?: string;
  children: ReactNode;
}) {
  return (
    <span className={'badge badge-' + tone} title={title}>
      {children}
    </span>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

/** A view of the standard read-hook state: pick loading, error, empty, or content. */
export function AsyncView<T>({
  isPending,
  error,
  data,
  isEmpty,
  empty,
  children,
  rows,
}: {
  isPending: boolean;
  error: Error | null;
  data: T | null | undefined;
  isEmpty: (data: T) => boolean;
  empty: ReactNode;
  children: (data: T) => ReactNode;
  rows?: number;
}) {
  if (isPending) return <Skeleton rows={rows} />;
  if (error) return <ErrorState error={error} />;
  if (data == null || isEmpty(data)) return <EmptyState>{empty}</EmptyState>;
  return <>{children(data)}</>;
}
