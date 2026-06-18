import Image from "next/image";
import { Download } from "lucide-react";
import { MeasurementVisual } from "@/components/industrial-visuals";
import { Button, PageHero, Panel, Section } from "@/components/ui";
import { qualityPoints, qualityProcess, workshopMachines } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Quality & Infrastructure", path: "/quality-infrastructure", description: "Review Royal Engitech infrastructure, workshop, fabrication, foundry and ISO quality focus." });

export default function QualityInfrastructurePage(){
  return (
    <>
      <PageHero eyebrow="Quality / Infrastructure" title="Manufacturing depth supported by quality discipline." intro="Royal Engitech combines workshop, foundry, fabrication, CAD/CAM, inspection and dispatch practices to support precision engineered components." image={<MeasurementVisual />} />

      <Section title="Quality assurance sequence" intro="Quality is treated as a process that begins with drawing review and continues through material planning, manufacturing, inspection, packaging and dispatch.">
        <div className="grid gap-5 lg:grid-cols-5">
          {qualityProcess.map((step, index)=>(
            <Panel key={step.title} className="relative overflow-hidden">
              <span className="absolute right-4 top-3 font-display text-6xl font-semibold text-line/70">{index+1}</span>
              <step.icon className="relative mb-5 text-copper" />
              <h2 className="relative text-xl font-semibold text-graphite">{step.title}</h2>
              <p className="relative mt-3 text-sm leading-6 text-smoke">{step.text}</p>
            </Panel>
          ))}
        </div>
      </Section>

      <Section className="bg-porcelain" eyebrow="Infrastructure" title="Workshop, fabrication and foundry capability" intro="Key infrastructure details from the company profile are grouped into practical buyer categories.">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
          <div className="grid gap-5">
            <Image src="/images/hero-cnc-vmc.jpg" alt="VMC machining infrastructure" width={900} height={420} className="rounded-[2rem] border border-line bg-white p-2 shadow-editorial" />
            <Image src="/images/foundry-pouring.jpg" alt="Foundry pouring capability" width={900} height={420} className="rounded-[2rem] border border-line bg-white p-2 shadow-editorial" />
          </div>
          <div className="overflow-hidden rounded-[2rem] border border-line bg-white shadow-metal">
            {workshopMachines.map(([area, process, capability])=>(
              <div key={area} className="border-b border-line p-6 last:border-b-0">
                <h3 className="text-2xl font-semibold text-graphite">{area}</h3>
                <p className="mt-2 leading-7 text-smoke">{process}</p>
                <p className="mt-2 text-sm font-semibold text-copper">{capability}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Quality commitments" intro="Royal Engitech emphasizes measurable quality, competitive pricing, on-time delivery, known machinery, CAD/CAM support and more than fifty years of engineering experience.">
        <div className="grid gap-6 lg:grid-cols-[1fr_.85fr]">
          <div className="grid gap-3">{qualityPoints.map((q)=><div className="border-b border-line py-4 text-lg font-medium text-graphite" key={q}>{q}</div>)}</div>
          <Panel>
            <h3 className="text-2xl font-semibold text-graphite">ISO certificate and catalog</h3>
            <p className="mt-3 leading-7 text-smoke">Download the ISO certificate and product catalog for buyer documentation review.</p>
            <div className="mt-6 flex flex-col gap-3"><Button href="/downloads/royal-engitech-iso-certificate-2024.pdf"><Download className="mr-2" size={18}/>ISO Certificate</Button><Button href="/downloads/royal-engitech-catalog.pdf" variant="secondary"><Download className="mr-2" size={18}/>Product Catalog</Button></div>
          </Panel>
        </div>
      </Section>
    </>
  );
}
