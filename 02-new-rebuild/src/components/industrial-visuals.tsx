"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type ProductVisualVariant =
  | "cnc"
  | "aluminum"
  | "nonFerrous"
  | "castIron"
  | "sheetMetal"
  | "gears"
  | "shafts"
  | "brassValve";

function BlueprintLines() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] opacity-70">
      <span className="absolute left-8 top-8 h-px w-32 bg-slateblue/20" />
      <span className="absolute left-8 top-8 h-24 w-px bg-slateblue/20" />
      <span className="absolute bottom-10 right-10 h-px w-40 bg-brass/25" />
      <span className="absolute bottom-10 right-10 h-28 w-px bg-brass/25" />
      <span className="absolute left-1/2 top-1/2 h-[1px] w-[120%] -translate-x-1/2 -rotate-12 bg-gradient-to-r from-transparent via-slateblue/15 to-transparent" />
    </div>
  );
}

export function HeroIndustrialVisual() {
  return (
    <div className="relative mx-auto h-[480px] max-w-[620px] overflow-hidden rounded-[2.75rem] border border-line bg-brushed shadow-editorial">
      <BlueprintLines />
      <motion.div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slateblue/20" animate={{ rotate: 360 }} transition={{ duration: 46, repeat: Infinity, ease: "linear" }} />
      <motion.div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-brass/30" animate={{ rotate: -360 }} transition={{ duration: 72, repeat: Infinity, ease: "linear" }} />
      <motion.div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2" animate={{ y: [0, -10, 0], rotateZ: [-1.5, 1.5, -1.5] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}>
        <motion.div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full" animate={{ rotate: 360 }} transition={{ duration: 28, repeat: Infinity, ease: "linear" }}>
          <div className="absolute inset-5 rounded-full border border-white/80 bg-gradient-to-br from-white via-steel to-brass/20 shadow-metal" />
          <div className="absolute inset-16 rounded-full border border-slateblue/20 bg-paper shadow-inner" />
          <div className="absolute inset-x-8 top-1/2 h-3 -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent via-slateblue/25 to-transparent" />
          <div className="absolute inset-y-8 left-1/2 w-3 -translate-x-1/2 rounded-full bg-gradient-to-b from-transparent via-brass/25 to-transparent" />
        </motion.div>
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <span key={deg} className="absolute left-1/2 top-1/2 h-10 w-10 rounded-full border border-white/80 bg-gradient-to-br from-white to-steel shadow-metal" style={{ transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-132px)` }} />
        ))}
        <div className="absolute left-1/2 top-1/2 h-10 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent via-slateblue/20 to-transparent blur-sm" />
      </motion.div>
      <motion.div className="absolute bottom-8 left-8 right-8 rounded-[1.5rem] border border-white/70 bg-white/72 p-5 shadow-metal backdrop-blur" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.7 }}>
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-copper">Precision component systems</p>
        <p className="mt-2 text-sm leading-6 text-smoke">Machining, casting, fabrication and inspection represented as a clean engineered assembly.</p>
      </motion.div>
    </div>
  );
}

export function ProcessRouteVisual({ className }: { className?: string }) {
  const steps = ["Drawing", "Material", "Production", "Inspection", "Dispatch"];
  return (
    <div className={cn("overflow-hidden rounded-[2rem] border border-line bg-white shadow-metal", className)}>
      <div className="grid divide-y divide-line lg:grid-cols-5 lg:divide-x lg:divide-y-0">
        {steps.map((step, index) => (
          <div key={step} className="relative min-h-36 p-6">
            <span className="font-display text-4xl font-semibold text-brass">{index + 1}</span>
            <p className="mt-6 text-lg font-semibold text-graphite">{step}</p>
            <span className="absolute bottom-5 right-5 h-10 w-10 rounded-full border border-slateblue/15 bg-gradient-to-br from-white via-steel/50 to-brass/10" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CapabilitySystemVisual() {
  const items = ["Machining", "Casting", "Fabrication", "Inspection", "Dispatch"];
  return (
    <div className="relative min-h-[420px] overflow-hidden rounded-[2.5rem] border border-line bg-porcelain p-8 shadow-editorial">
      <BlueprintLines />
      <div className="relative grid h-full gap-4">
        <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-copper">Drawing-based supply system</p>
          <h3 className="mt-3 text-3xl font-semibold text-graphite">One coordinated route from RFQ to packed component.</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-5">
          {items.map((item, index) => (
            <div key={item} className="min-h-28 border-l-2 border-brass bg-white p-4 shadow-sm">
              <span className="text-xs font-bold text-smoke">0{index + 1}</span>
              <p className="mt-4 font-semibold text-graphite">{item}</p>
            </div>
          ))}
        </div>
        <div className="mt-2 h-2 rounded-full bg-gradient-to-r from-slateblue/25 via-brass/45 to-copper/25" />
      </div>
    </div>
  );
}

function GearShape({ className }: { className?: string }) {
  return (
    <motion.div className={cn("relative h-28 w-28 rounded-full", className)} animate={{ rotate: 360 }} transition={{ duration: 24, repeat: Infinity, ease: "linear" }}>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => <span key={deg} className="absolute left-1/2 top-1/2 h-5 w-10 rounded bg-slateblue/25" style={{ transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-58px)` }} />)}
      <span className="absolute inset-3 rounded-full border border-white/80 bg-gradient-to-br from-white via-steel to-brass/15 shadow-metal" />
      <span className="absolute inset-11 rounded-full bg-paper ring-1 ring-slateblue/20" />
    </motion.div>
  );
}

export function ProductMechanicalVisual({ variant, className }: { variant: ProductVisualVariant; className?: string }) {
  const brass = variant === "brassValve";
  const heavy = variant === "castIron";
  const silver = variant === "aluminum" || variant === "sheetMetal";
  return (
    <div className={cn("relative grid min-h-52 place-items-center overflow-hidden rounded-[1.5rem] border border-line bg-brushed p-6", className)}>
      <BlueprintLines />
      {variant === "gears" ? <GearShape /> : null}
      {variant === "cnc" ? <motion.div className="h-24 w-44 rounded-full border border-white/90 bg-gradient-to-r from-steel via-white to-steel shadow-metal" animate={{ y: [0, -5, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}><span className="mx-auto mt-7 block h-10 w-20 rounded-full border border-slateblue/20 bg-paper shadow-inner" /></motion.div> : null}
      {variant === "aluminum" ? <motion.div className="h-28 w-40 skew-x-[-10deg] rounded-2xl border border-white/90 bg-gradient-to-br from-white via-steel to-slateblue/10 shadow-metal" animate={{ y: [0, -6, 0] }} transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}><span className="ml-10 mt-8 block h-12 w-16 rounded-full border border-slateblue/15 bg-paper/80" /></motion.div> : null}
      {variant === "nonFerrous" ? <motion.div className="h-28 w-36 rounded-[2rem] border border-white/90 bg-gradient-to-br from-brass/35 via-white to-copper/25 shadow-metal" animate={{ rotate: [-2, 2, -2] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}><span className="mx-auto mt-8 block h-12 w-16 rounded-full bg-paper ring-1 ring-copper/20" /></motion.div> : null}
      {variant === "castIron" ? <motion.div className="h-28 w-44 rounded-xl border border-slateblue/20 bg-gradient-to-br from-slateblue/35 via-steel to-graphite/20 shadow-metal" animate={{ y: [0, -4, 0] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}><span className="ml-8 mt-8 block h-12 w-20 rounded-lg border border-white/60 bg-paper/70" /></motion.div> : null}
      {variant === "sheetMetal" ? <motion.div className="relative h-28 w-44" animate={{ y: [0, -5, 0] }} transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}><span className="absolute left-4 top-10 h-20 w-32 skew-y-[-12deg] rounded-xl border border-white/80 bg-gradient-to-br from-white via-steel to-slateblue/10 shadow-metal" /><span className="absolute right-5 top-4 h-24 w-14 skew-y-[18deg] rounded-xl border border-line bg-gradient-to-br from-steel to-white shadow-sm" /></motion.div> : null}
      {variant === "shafts" ? <motion.div className="relative h-24 w-52" animate={{ x: [0, 5, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}><span className="absolute left-0 top-1/2 h-8 w-full -translate-y-1/2 rounded-full border border-white/90 bg-gradient-to-r from-steel via-white to-steel shadow-metal" /><span className="absolute left-10 top-1/2 h-16 w-16 -translate-y-1/2 rounded-full border border-slateblue/15 bg-white/80" /><span className="absolute right-10 top-1/2 h-16 w-16 -translate-y-1/2 rounded-full border border-slateblue/15 bg-white/80" /></motion.div> : null}
      {variant === "brassValve" ? <motion.div className="relative h-28 w-48" animate={{ y: [0, -5, 0] }} transition={{ duration: 5.8, repeat: Infinity, ease: "easeInOut" }}><span className="absolute left-2 top-1/2 h-12 w-44 -translate-y-1/2 rounded-full border border-white/70 bg-gradient-to-r from-brass via-white to-brass shadow-metal" /><span className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80 bg-gradient-to-br from-brass/80 via-white to-copper/40 shadow-metal" /><span className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-paper ring-1 ring-copper/20" /></motion.div> : null}
      {!brass && !heavy && !silver ? null : <span className="absolute bottom-5 right-6 text-[10px] font-bold uppercase tracking-[0.2em] text-smoke/70">Engineered form</span>}
    </div>
  );
}

export function ExplodedComponentVisual() {
  return (
    <div className="relative min-h-[360px] overflow-hidden rounded-[2.5rem] border border-line bg-porcelain p-8 shadow-editorial">
      <BlueprintLines />
      <div className="absolute inset-0 engineering-grid opacity-40" />
      <div className="relative grid h-full place-items-center">
        <motion.div className="relative h-64 w-80" animate={{ y: [0, -8, 0] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}>
          {[
            { left: "8%", top: "44%", width: "105px", height: "34px" },
            { left: "36%", top: "36%", width: "112px", height: "72px" },
            { left: "70%", top: "44%", width: "72px", height: "34px" },
          ].map((part, index) => (
            <motion.span key={index} className="absolute rounded-full border border-white/90 bg-gradient-to-br from-white via-steel to-brass/20 shadow-metal" style={part} animate={{ x: [0, index === 0 ? -10 : index === 2 ? 10 : 0, 0], rotate: [0, index === 1 ? 4 : -4, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: index * 0.2 }} />
          ))}
          <span className="absolute left-[25%] top-1/2 h-px w-[46%] bg-slateblue/20" />
          <span className="absolute left-[29%] top-[43%] h-12 w-px bg-brass/20" />
          <span className="absolute right-[27%] top-[43%] h-12 w-px bg-brass/20" />
        </motion.div>
      </div>
    </div>
  );
}

export function GlobeNetworkVisual() {
  return (
    <div className="relative min-h-[360px] overflow-hidden rounded-[2.5rem] border border-line bg-brushed p-8 shadow-editorial">
      <BlueprintLines />
      <motion.div className="absolute left-1/2 top-1/2 h-60 w-60 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slateblue/20 bg-white/55 shadow-metal" animate={{ rotate: 360 }} transition={{ duration: 90, repeat: Infinity, ease: "linear" }}>
        <span className="absolute inset-8 rounded-full border border-brass/25" />
        <span className="absolute inset-y-4 left-1/2 w-px -translate-x-1/2 bg-slateblue/15" />
        <span className="absolute inset-x-4 top-1/2 h-px -translate-y-1/2 bg-slateblue/15" />
        <span className="absolute left-8 top-14 h-3 w-3 rounded-full bg-copper shadow-metal" />
        <span className="absolute right-12 top-24 h-3 w-3 rounded-full bg-slateblue shadow-metal" />
        <span className="absolute bottom-14 left-24 h-3 w-3 rounded-full bg-brass shadow-metal" />
      </motion.div>
      <motion.div className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-brass/30" animate={{ rotate: -360 }} transition={{ duration: 70, repeat: Infinity, ease: "linear" }} />
      <div className="absolute bottom-8 left-8 right-8 rounded-2xl border border-white/70 bg-white/75 p-5 backdrop-blur">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-copper">Global supply conversations</p>
        <p className="mt-2 text-sm leading-6 text-smoke">Networked sourcing support for international buyer communication.</p>
      </div>
    </div>
  );
}

export function MeasurementVisual() {
  return (
    <div className="relative min-h-[340px] overflow-hidden rounded-[2.5rem] border border-line bg-porcelain p-8 shadow-editorial">
      <BlueprintLines />
      <motion.div className="absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full border-[14px] border-steel bg-white shadow-metal" animate={{ rotate: [0, 8, 0] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}>
        <span className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-brass/40 bg-paper" />
      </motion.div>
      <motion.div className="absolute left-20 top-20 h-2 w-72 origin-left rounded-full bg-gradient-to-r from-slateblue/55 to-transparent" animate={{ rotate: [-14, 10, -14] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} />
      <div className="absolute bottom-8 left-8 right-8 grid grid-cols-3 gap-3 text-center text-xs font-bold uppercase tracking-[0.18em] text-smoke">
        <span>Measure</span><span>Verify</span><span>Dispatch</span>
      </div>
    </div>
  );
}
