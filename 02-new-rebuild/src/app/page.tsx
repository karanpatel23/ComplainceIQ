import Link from "next/link";
import { ArrowRight, Download, FileCheck2 } from "lucide-react";
import { Reveal } from "@/components/motion";
import { GlobeNetworkVisual, HeroIndustrialVisual, ProcessRouteVisual, ProductMechanicalVisual, type ProductVisualVariant } from "@/components/industrial-visuals";
import { Button, Panel, Section, StatStrip } from "@/components/ui";
import { capabilities, company, exportReadiness, industries, productCategories, qualityPoints, trustSignals } from "@/lib/content";

export default function Home() {
  return (
    <>
      <section className="relative overflow-hidden bg-paper px-5 pb-16 pt-32 sm:px-8 lg:px-12">
        <div className="absolute inset-0 engineering-grid opacity-60" />
        <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.95fr_1.05fr] lg:items-center">
          <Reveal>
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.32em] text-copper">{company.certification} · Established {company.founded} · Ahmedabad, India</p>
            <h1 className="text-balance font-display text-5xl font-semibold tracking-tight text-graphite sm:text-7xl">Precision engineered components for OEM and industrial buyers.</h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-smoke">Drawing-based manufacturing for machined parts, castings, sheet metal components, gears, shafts, valve parts and export-ready industrial assemblies.</p>
            <div className="mt-9 flex flex-col gap-4 sm:flex-row"><Button href="/contact">Send RFQ <ArrowRight className="ml-2" size={18} /></Button><Link href="/products" className="inline-flex items-center text-sm font-bold text-graphite underline decoration-brass/40 underline-offset-8 hover:text-copper">View manufacturing scope</Link></div>
          </Reveal>
          <Reveal delay={0.12}><HeroIndustrialVisual /></Reveal>
        </div>
      </section>

      <Section className="pt-24" eyebrow="Manufacturing credibility" title="A long-running supplier profile built for repeat industrial sourcing." intro="Royal Engitech combines multi-process manufacturing, ISO quality discipline and export-aware dispatch support from Ahmedabad, India.">
        <StatStrip items={trustSignals} />
      </Section>

      <Section className="bg-porcelain" eyebrow="What Royal Engitech manufactures" title="A focused component portfolio for machinery, motion and fluid-control applications." intro="Buyers can source custom parts by drawing, sample, product family, material and application requirement.">
        <div className="overflow-hidden rounded-[2rem] border border-line bg-white shadow-metal">
          {productCategories.map((product, index) => (
            <Link key={product.id} href={`/products#${product.id}`} className="grid gap-6 border-b border-line p-6 transition last:border-b-0 hover:bg-paper lg:grid-cols-[90px_260px_1fr_220px] lg:items-center">
              <span className="font-display text-4xl font-semibold text-brass">{String(index + 1).padStart(2, "0")}</span>
              <div className="max-w-[240px]"><ProductMechanicalVisual variant={product.visual as ProductVisualVariant} /></div>
              <div>
                <h3 className="font-display text-2xl font-semibold text-graphite">{product.title}</h3>
                <p className="mt-3 leading-7 text-smoke">{product.summary}</p>
              </div>
              <div className="text-sm leading-6 text-smoke"><strong className="text-graphite">Applications:</strong><br />{product.applications.slice(0, 3).join(" · ")}</div>
            </Link>
          ))}
        </div>
      </Section>

      <Section eyebrow="From drawing to dispatch" title="A buyer-focused production route replaces decorative filler." intro="The workflow is designed to help purchasing and engineering teams move from RFQ information to planned production, inspection and shipment.">
        <ProcessRouteVisual />
        <div className="mt-8 grid gap-x-8 gap-y-3 border-y border-line py-6 md:grid-cols-2 lg:grid-cols-3">
          {[
            "Drawing-based manufacturing",
            "Multi-process capability",
            "ISO quality system",
            "Repeat production support",
            "Export documentation readiness",
            "Packaging and dispatch discipline",
          ].map((point) => <p key={point} className="text-sm font-bold uppercase tracking-[0.16em] text-smoke">{point}</p>)}
        </div>
      </Section>

      <Section className="bg-porcelain" eyebrow="Manufacturing capabilities" title="A connected production system, not isolated services." intro="CNC/VMC machining, foundry coordination, fabrication, CAD/CAM, tooling and dispatch readiness are organized around the customer drawing and application.">
        <div className="overflow-hidden rounded-[2rem] border border-line bg-white shadow-metal">
          {capabilities.map((capability, index) => (
            <div key={capability.label} className="grid gap-4 border-b border-line p-6 last:border-b-0 md:grid-cols-[120px_260px_1fr] md:items-center">
              <span className="font-display text-4xl font-semibold text-brass">{String(index + 1).padStart(2, "0")}</span>
              <h3 className="text-xl font-semibold text-graphite">{capability.label}</h3>
              <p className="leading-7 text-smoke">{capability.detail}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Industries served" title="Application examples for industrial buyers." intro="The company supplies components for sectors where dimensional accuracy, process consistency and supplier communication matter.">
        <div className="divide-y divide-line overflow-hidden rounded-[2rem] border border-line bg-white shadow-metal">
          {industries.map((industry) => (
            <div key={industry.title} className="grid gap-5 p-6 md:grid-cols-[240px_1fr] md:items-center">
              <div className="flex items-center gap-3"><industry.icon className="text-copper" /><h3 className="font-display text-2xl font-semibold text-graphite">{industry.title}</h3></div>
              <p className="leading-7 text-smoke">{industry.text} Typical sourcing examples include {industry.examples.join(", ")}.</p>
            </div>
          ))}
        </div>
      </Section>

      <Section className="bg-graphite text-white" eyebrow="Quality and export readiness" title="Inspection, documentation and dispatch discipline for long-term supplier relationships." intro="International buyers need confidence in process control, packaging and communication as much as manufacturing capacity.">
        <div className="grid gap-8 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
          <GlobeNetworkVisual />
          <div>
            <div className="grid gap-3">{qualityPoints.map((point) => <p key={point} className="border-b border-white/10 py-3 text-lg font-semibold text-white">{point}</p>)}</div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">{exportReadiness.map((item) => <Panel key={item.title} className="bg-white text-graphite"><item.icon className="mb-4 text-copper" /><h3 className="text-xl font-semibold">{item.title}</h3><p className="mt-3 text-smoke">{item.text}</p></Panel>)}</div>
          </div>
        </div>
      </Section>

      <Section className="bg-brushed" title="Ready to review a component drawing or sourcing requirement?" intro="Send material, quantity, tolerance, application and destination details so the team can review the most suitable manufacturing route.">
        <div className="flex flex-col gap-4 sm:flex-row"><Button href="/contact">Start RFQ</Button><Button href="/downloads/royal-engitech-catalog.pdf" variant="secondary"><Download className="mr-2" size={18}/>Download catalog</Button><Button href="/downloads/royal-engitech-iso-certificate-2024.pdf" variant="ghost"><FileCheck2 className="mr-2" size={18}/>ISO certificate</Button></div>
      </Section>
    </>
  );
}
