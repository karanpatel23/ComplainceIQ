import { CheckCircle2 } from "lucide-react";
import { Reveal } from "@/components/motion";
import { CapabilitySystemVisual, ExplodedComponentVisual } from "@/components/industrial-visuals";
import { Button, PageHero, Panel, Section, StatStrip } from "@/components/ui";
import { capabilities, company, trustSignals } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "About Us",
  path: "/about",
  description: "Learn about Royal Engitech, an ISO 9001:2015 precision engineered components manufacturer and exporter established in Ahmedabad in 1965.",
});

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About Royal Engitech"
        title="A precision engineering company shaped by practical manufacturing experience."
        intro={`${company.name} was incorporated in ${company.founded} in Ahmedabad, Gujarat, India, and manufactures high-tech precision engineered components and assemblies for Indian and international buyers.`}
        image={<ExplodedComponentVisual />}
      />

      <Section title="What the company does" intro="Royal Engitech supports customer requirements for castings, forgings, high-precision machined components, sheet metal parts, gears, shafts, valves, tooling and fixtures.">
        <div className="grid gap-10 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
          <Reveal><CapabilitySystemVisual /></Reveal>
          <Reveal delay={0.1}>
            <div className="prose prose-lg max-w-none text-smoke">
              <p>For buyers, the value is a coordinated manufacturing partner that can interpret drawings, plan production routes, build fixtures, machine critical geometry, inspect parts and prepare shipments with documentation and packaging discipline.</p>
              <p>Continuous investment in computerized technology and machinery supports the company&apos;s focus on precision, reliability and repeat production.</p>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {capabilities.map((capability) => (
                <div key={capability.label} className="flex gap-3 border-b border-line pb-4">
                  <CheckCircle2 className="mt-1 shrink-0 text-copper" size={20} />
                  <div><h3 className="font-semibold text-graphite">{capability.label}</h3><p className="mt-1 text-sm leading-6 text-smoke">{capability.detail}</p></div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </Section>

      <Section className="bg-porcelain" eyebrow="Manufacturing philosophy" title="Precision, communication and supplier reliability." intro="Royal Engitech works best with customers who need drawing-based manufacturing, process consistency and a responsive engineering-to-dispatch workflow.">
        <div className="grid gap-6 lg:grid-cols-3">
          <Panel><p className="text-xs font-bold uppercase tracking-[0.24em] text-copper">01</p><h3 className="mt-3 text-2xl font-semibold text-graphite">Engineer from the drawing</h3><p className="mt-3 leading-7 text-smoke">Material, tolerance, machining allowance, tooling and production method are evaluated against the customer requirement.</p></Panel>
          <Panel><p className="text-xs font-bold uppercase tracking-[0.24em] text-copper">02</p><h3 className="mt-3 text-2xl font-semibold text-graphite">Control the process</h3><p className="mt-3 leading-7 text-smoke">Fixtures, gauges, computerized measurement and production monitoring support accuracy from raw material to final dispatch.</p></Panel>
          <Panel><p className="text-xs font-bold uppercase tracking-[0.24em] text-copper">03</p><h3 className="mt-3 text-2xl font-semibold text-graphite">Support the buyer</h3><p className="mt-3 leading-7 text-smoke">Identification, packaging, certification and after-sales communication help build a dependable supply relationship.</p></Panel>
        </div>
      </Section>

      <Section title="Why buyers work with Royal Engitech" intro="A long operating history, in-house manufacturing depth and ISO quality focus make the company suitable for OEMs, exporters and industrial sourcing teams.">
        <StatStrip items={trustSignals} />
        <div className="mt-10"><Button href="/contact">Discuss a requirement</Button></div>
      </Section>
    </>
  );
}
