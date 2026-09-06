'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tab = { id: string; label: string; content: ReactNode };

/** Panels swap client-side rather than by route, so a mobile visitor stays on one scroll. */
export function Tabs({ tabs, defaultTabId }: { tabs: Tab[]; defaultTabId?: string }) {
  const [activeId, setActiveId] = useState(defaultTabId ?? tabs[0]?.id ?? '');
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === activeId}
            onClick={() => setActiveId(tab.id)}
            className={cn(
              'min-h-11 shrink-0 rounded-(--radius-control) px-4 text-sm font-medium transition-colors',
              tab.id === activeId
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-surface text-foreground hover:bg-muted',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{active?.content}</div>
    </div>
  );
}
