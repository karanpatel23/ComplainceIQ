import { Download, FileText } from "lucide-react";
import { ExplodedComponentVisual, ProductMechanicalVisual, type ProductVisualVariant } from "@/components/industrial-visuals";
import { Button, PageHero, Panel, Section } from "@/components/ui";
import { productCategories, workshopMachines } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Products & Capabilities", path: "/products", description: "Explore Royal Engitech precision CNC turned parts, aluminum parts, castings, sheet metal parts, gears, timing pulleys, ground shafts and brass NRV components." });

export default function ProductsPage() {
  return (
    <>
      <PageHero eyebrow="Products / Capabilities" title="Custom components manufactured from buyer drawings, samples and specifications." intro="Product families span CNC machined parts, castings, sheet metal, gears, pulleys, ground shafts and brass non-return valve references for industrial sectors." image={<ExplodedComponentVisual />} />

      <Section title="Product matrix" intro="Use these categories to route your RFQ. Each family can be reviewed for material, quantity, tolerance, finish and delivery destination.">
        <div className="grid gap-5 md:grid-cols-2">
          {productCategories.map((p) => (
            <article id={p.id} key={p.id} className="scroll-mt-28 overflow-hidden rounded-[2rem] border border-line bg-white shadow-metal">
              <div className="grid gap-6 p-6 lg:grid-cols-[220px_1fr]">
                <ProductMechanicalVisual variant={p.visual as ProductVisualVariant} />
                <div>
                  <p.icon className="mb-3 text-copper" />
                  <h2 className="font-display text-2xl font-semibold text-graphite">{p.title}</h2>
                  <p className="mt-3 leading-7 text-smoke">{p.summary}</p>
                  <p className="mt-3 text-sm font-semibold text-graphite">Capacity / note: <span className="font-normal text-smoke">{p.details}</span></p>
                  <p className="mt-2 text-sm font-semibold text-graphite">Materials: <span className="font-normal text-smoke">{p.materials}</span></p>
                  <div className="mt-4 flex flex-wrap gap-2">{p.applications.map((a)=><span key={a} className="rounded-full border border-line bg-paper px-3 py-1 text-xs font-semibold text-smoke">{a}</span>)}</div>
                  <Button href={`/contact?interest=${encodeURIComponent(p.title)}`} className="mt-6">Inquire about this product</Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Section className="bg-porcelain" eyebrow="Capability table" title="Manufacturing capability references" intro="Workshop, fabrication and foundry details are presented in a buyer-friendly table so technical teams can quickly understand shop-floor coverage.">
        <div className="overflow-hidden rounded-[2rem] border border-line bg-white shadow-metal">
          <div className="grid grid-cols-[.8fr_1.2fr_1fr] bg-graphite px-5 py-4 text-sm font-bold uppercase tracking-[0.18em] text-white"><span>Area</span><span>Equipment / process</span><span>Reference capability</span></div>
          {workshopMachines.map(([area, process, capability]) => (
            <div key={area} className="grid gap-3 border-b border-line px-5 py-5 last:border-b-0 md:grid-cols-[.8fr_1.2fr_1fr]">
              <strong className="text-graphite">{area}</strong><p className="text-smoke">{process}</p><p className="text-smoke">{capability}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Catalog and valve download references" intro="Downloadable references are retained for buyers who want a quick product overview or brass NRV details.">
        <div className="grid gap-6 md:grid-cols-2">
          <Panel className="flex flex-col justify-between"><div><FileText className="mb-4 text-copper" /><h3 className="text-2xl font-semibold text-graphite">Royal Engitech Product Catalog</h3><p className="mt-3 leading-7 text-smoke">Overview of product categories and company capabilities.</p></div><Button href="/downloads/royal-engitech-catalog.pdf" className="mt-6"><Download className="mr-2" size={18}/>Download catalog</Button></Panel>
          <Panel className="flex flex-col justify-between"><div><FileText className="mb-4 text-copper" /><h3 className="text-2xl font-semibold text-graphite">Brass Spring Non Return Valve</h3><p className="mt-3 leading-7 text-smoke">Reference PDF for brass spring-loaded check valve applications.</p></div><Button href="/downloads/brass-nrv.pdf" className="mt-6"><Download className="mr-2" size={18}/>Download brass NRV PDF</Button></Panel>
        </div>
      </Section>
    </>
  );
}
