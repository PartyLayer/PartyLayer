/**
 * Small presentational helpers for the demo chrome. These are the APP's own UI
 * (cards, skeletons, badges, states), distinct from the themed PartyLayer
 * primitives (ConnectButton, PartyAvatar, CostPreview, TransactionToast) which the
 * sections import from `@partylayer/react`.
 */
import { useState, type ReactNode } from 'react';

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

/**
 * Caption shown under a CostPreview. It always renders one line, so the preview never shows
 * numbers without a caption: a truthful live label when the estimate is a genuine live value,
 * otherwise the illustrative fallback (F3). Unit note: the CostEstimation traffic-cost fields
 * (see @partylayer/core cost.ts) mirror the Canton node CostEstimation schema, which does not
 * name a unit, so they are labeled as traffic units rather than guessing bytes.
 */
export function CostCaption({ live }: { live: boolean }) {
  return (
    <p className="cost-caption" role="note">
      {live
        ? 'Live network cost estimate (values in traffic units)'
        : 'Illustrative network cost, not a live estimate'}
    </p>
  );
}

/** Middle-truncate a long id so both ends stay readable; short ids show in full. */
function middleTruncate(value: string, head = 8, tail = 8): string {
  return value.length <= head + tail + 3 ? value : value.slice(0, head) + '...' + value.slice(-tail);
}

/**
 * A monospace id that middle-truncates when long (live contract ids and party ids) and
 * copies the full value on click. Demo fixtures use short readable ids, so they show whole.
 */
export function CopyId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      },
      () => {},
    );
  };
  return (
    <button type="button" className="copy-id" onClick={copy} title={'Copy ' + value} aria-label={'Copy ' + value}>
      <code>{middleTruncate(value)}</code>
      <span className="copy-id-tag" aria-hidden="true">
        {copied ? 'copied' : 'copy'}
      </span>
    </button>
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
