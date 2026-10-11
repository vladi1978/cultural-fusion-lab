"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

export function CollapsiblePanel({
  title,
  subtitle,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="panel overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-[rgba(255,255,255,0.02)]"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg text-white">{title}</h3>
            {badge ? <span className="badge badge-cyan">{badge}</span> : null}
          </div>
          {subtitle ? (
            <p className="mt-1 text-xs text-[var(--text-dim)]">{subtitle}</p>
          ) : null}
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>
      {open ? <div className="border-t border-[var(--line)] px-5 py-4">{children}</div> : null}
    </section>
  );
}
