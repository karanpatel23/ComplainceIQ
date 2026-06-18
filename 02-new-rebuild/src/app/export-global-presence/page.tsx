import { ArrowRight } from "lucide-react";
import { GlobeNetworkVisual } from "@/components/industrial-visuals";
import { Button, PageHero, Panel, Section } from "@/components/ui";
import { company, exportReadiness, rfqSteps } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Export & Global Presence", path: "/export-global-presence", description: "Royal Engitech is an export-focused precision components manufacturer in Ahmedabad, India serving international industrial buyers." });

export default function ExportPage(){
  return (
    <>
      <PageHero eyebrow="Export / Global Presence" title="A dependable Indian manufacturing partner for international buyers." intro="From Ahmedabad, Gujarat, Royal Engitech supports component inquiries that require drawing review, documentation readiness, careful packaging and reliable communication." image={<GlobeNetworkVisual />} />

      <Section title="Why international buyers can evaluate Royal Engitech with confidence" intro="The company profile is built around practical sourcing expectations: technical review, process discipline, supplier responsiveness and shipment preparation.">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">{exportReadiness.map((item)=><Panel key={item.title}><item.icon className="mb-4 text-copper" /><h2 className="text-xl font-semibold text-graphite">{item.title}</h2><p className="mt-3 leading-7 text-smoke">{item.text}</p></Panel>)}</div>
      </Section>

      <Section className="bg-porcelain" eyebrow="RFQ to delivery" title="A clear process for export-oriented component inquiries." intro="Share the technical requirement, and the team can review the appropriate route for manufacturing, inspection and dispatch.">
        <div className="grid gap-5 lg:grid-cols-4">
          {rfqSteps.map((step,index)=><div key={step} className="relative rounded-[2rem] border border-line bg-white p-6 shadow-sm"><span className="font-display text-5xl font-semibold text-brass">{index+1}</span><p className="mt-5 text-lg font-semibold leading-7 text-graphite">{step}</p>{index<rfqSteps.length-1 && <ArrowRight className="absolute -right-4 top-1/2 hidden text-brass lg:block" />}</div>)}
        </div>
      </Section>

      <Section title="Documentation and communication readiness" intro="Buyers can request product information, certification references, packaging requirements and dispatch communication through the inquiry flow.">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
          <GlobeNetworkVisual />
          <Panel><h2 className="text-3xl font-semibold text-graphite">Located in Ahmedabad, India</h2><p className="mt-4 leading-8 text-smoke">{company.address}</p><p className="mt-4 leading-8 text-smoke">The contact flow captures country, product interest and technical message so export conversations can begin with the right context.</p><Button href="/contact" className="mt-7">Start export inquiry</Button></Panel>
        </div>
      </Section>
    </>
  );
}
