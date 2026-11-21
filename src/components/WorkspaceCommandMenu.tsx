import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Command, Search, X } from 'lucide-react';
import type { DashboardNavItem } from '../layouts/DashboardLayout';

interface WorkspaceCommandMenuProps {
  items: DashboardNavItem[];
  onSelect: (id: string) => void;
}

export function WorkspaceCommandMenu({ items, onSelect }: WorkspaceCommandMenuProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
      return () => window.cancelAnimationFrame(frame);
    }
    setQuery('');
  }, [open]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) =>
      item.label.toLowerCase().includes(needle) ||
      (item.group || '').toLowerCase().includes(needle),
    );
  }, [items, query]);

  const choose = (id: string) => {
    onSelect(id);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search workspace sections"
        className="hb-workspace-search-trigger"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        <span>Search workspace</span>
        <kbd>Ctrl K</kbd>
      </button>
      {open && (
        <div
          className="hb-command-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            className="hb-command-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hb-command-title"
          >
            <h2 id="hb-command-title" className="sr-only">Search workspace sections</h2>
            <div className="hb-command-input-wrap">
              <Search className="h-5 w-5 shrink-0" aria-hidden="true" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a dashboard section..."
                aria-label="Find a dashboard section"
              />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close search">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="hb-command-caption">WORKSPACE SECTIONS</p>
            <div className="hb-command-results">
              {filtered.length ? filtered.map((item) => (
                <button key={item.id} type="button" onClick={() => choose(item.id)}>
                  <span className="hb-command-icon">{item.icon}</span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-semibold">{item.label}</span>
                    <span className="block text-[11px] opacity-60">{item.group || 'Workspace'}</span>
                  </span>
                  <Command className="h-3.5 w-3.5 opacity-40" aria-hidden="true" />
                </button>
              )) : (
                <p className="px-4 py-8 text-center text-sm opacity-60">No matching workspace section.</p>
              )}
            </div>
            <div className="hb-command-footer">Navigate securely using your assigned permissions.</div>
          </section>
        </div>
      )}
    </>
  );
}
