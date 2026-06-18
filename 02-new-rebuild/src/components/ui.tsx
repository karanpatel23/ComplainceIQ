import Link from "next/link";
import type { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

export function Button({ href, children, variant = "primary", className }: PropsWithChildren<{ href: string; variant?: "primary" | "secondary" | "ghost"; className?: string }>) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-brass focus:ring-offset-2 focus:ring-offset-paper",
        variant === "primary" && "bg-graphite text-white shadow-metal hover:bg-slateblue",
        variant === "secondary" && "border border-graphite/15 bg-porcelain text-graphite shadow-sm hover:border-brass hover:text-copper",
        variant === "ghost" && "text-graphite underline decoration-brass/40 underline-offset-8 hover:text-copper",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function Section({ children, eyebrow, title, intro, className }: PropsWithChildren<{ eyebrow?: string; title?: string; intro?: string; className?: string }>) {
  return (
    <section className={cn("px-5 py-20 sm:px-8 lg:px-12", className)}>
      <div className="mx-auto max-w-7xl">
        {(eyebrow || title || intro) && (
          <div className="mb-12 grid gap-6 lg:grid-cols-[.48fr_.52fr] lg:items-end">
            <div>
              {eyebrow && <p className="mb-4 text-xs font-bold uppercase tracking-[0.28em] text-copper">{eyebrow}</p>}
              {title && <h2 className="text-balance font-display text-3xl font-semibold tracking-tight text-graphite sm:text-5xl">{title}</h2>}
            </div>
            {intro && <p className="max-w-2xl text-lg leading-8 text-smoke lg:justify-self-end">{intro}</p>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

export function Panel({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn("rounded-[2rem] border border-line/80 bg-porcelain p-6 shadow-metal", className)}>{children}</div>;
}

export function PageHero({ eyebrow, title, intro, image }: { eyebrow: string; title: string; intro: string; image?: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden bg-paper px-5 pb-16 pt-32 sm:px-8 lg:px-12">
      <div className="absolute inset-0 engineering-grid opacity-60" />
      <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.95fr_.75fr] lg:items-end">
        <div>
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.32em] text-copper">{eyebrow}</p>
          <h1 className="text-balance font-display text-4xl font-semibold tracking-tight text-graphite sm:text-6xl">{title}</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-smoke">{intro}</p>
        </div>
        {image && <div className="lg:justify-self-end">{image}</div>}
      </div>
      <div className="metal-rule absolute inset-x-0 bottom-0 h-px" />
    </div>
  );
}

export function StatStrip({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="grid divide-y divide-line overflow-hidden rounded-[2rem] border border-line bg-porcelain shadow-metal sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="p-6">
          <p className="font-display text-3xl font-semibold text-graphite">{item.value}</p>
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.22em] text-smoke">{item.label}</p>
        </div>
      ))}
    </div>
  );
}
