"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { navItems } from "@/lib/content";
import { Button } from "./ui";

export function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line/80 bg-porcelain/88 backdrop-blur-xl">
      <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-12" aria-label="Primary navigation">
        <Link href="/" className="group flex items-center gap-3" onClick={() => setOpen(false)}>
          <span className="grid h-11 w-11 place-items-center rounded-full border border-brass/40 bg-brushed font-display text-sm font-black tracking-widest text-graphite shadow-sm">RE</span>
          <span>
            <span className="block font-display text-sm font-bold uppercase tracking-[0.18em] text-graphite">Royal Engitech</span>
            <span className="hidden text-xs text-smoke sm:block">Precision manufacturing & exports</span>
          </span>
        </Link>
        <div className="hidden items-center gap-7 lg:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm font-semibold text-smoke transition hover:text-graphite">
              {item.label}
            </Link>
          ))}
        </div>
        <div className="hidden lg:block"><Button href="/contact">Send RFQ</Button></div>
        <button className="rounded-full border border-line bg-white p-3 text-graphite lg:hidden" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden border-t border-line bg-porcelain lg:hidden">
            <div className="space-y-1 px-5 py-5">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="block rounded-2xl px-4 py-3 text-base font-semibold text-graphite hover:bg-steel/70">
                  {item.label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
