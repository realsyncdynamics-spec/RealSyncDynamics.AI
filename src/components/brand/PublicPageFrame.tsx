import type { ReactNode } from 'react';
import { PublicHeader, type PublicHeaderProps } from './PublicHeader';
import { PublicFooter, type PublicFooterColumn } from './PublicFooter';

/** Öffentlicher Seitenrahmen: PublicHeader + main + PublicFooter auf --brand-* Tokens. */
export function PublicPageFrame({
  header,
  footerColumns,
  mainClassName,
  children,
}: {
  header?: PublicHeaderProps;
  footerColumns?: readonly PublicFooterColumn[];
  mainClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--brand-bg-1)] text-[var(--brand-champ-hi)] font-[family-name:var(--brand-sans)]">
      <PublicHeader {...header} />
      <main id="main" className={mainClassName ?? 'flex-1'}>
        {children}
      </main>
      <PublicFooter linkColumns={footerColumns} />
    </div>
  );
}
