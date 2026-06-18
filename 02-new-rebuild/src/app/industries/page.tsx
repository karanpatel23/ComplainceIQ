import { Button, PageHero, Section } from "@/components/ui";
import { industries } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Industries Served", path: "/industries", description: "Royal Engitech serves textile machinery, power transmission, water pumps, valves, automobile, pharmaceutical and other industrial sectors." });

export default function IndustriesPage(){
  return (
    <>
      <PageHero eyebrow="Industries Served" title="Components for machinery, motion, fluid handling and industrial production." intro="Royal Engitech supports sectors where accurate dimensions, repeatable production and supplier communication are essential." />
      <Section title="Industry application rows" intro="Each sector has a different application need, but the buying expectation is consistent: a dependable component supplier that can work from drawings and support repeat production.">
        <div className="divide-y divide-line overflow-hidden rounded-[2rem] border border-line bg-white shadow-metal">
          {industries.map((item, index)=>(
            <div key={item.title} className="grid gap-6 p-6 lg:grid-cols-[80px_260px_1fr_1.1fr] lg:items-center">
              <span className="font-display text-4xl font-semibold text-brass">{String(index+1).padStart(2,"0")}</span>
              <div className="flex items-center gap-3"><item.icon className="text-copper" /><h2 className="text-2xl font-semibold text-graphite">{item.title}</h2></div>
              <p className="leading-7 text-smoke">{item.text}</p>
              <div className="flex flex-wrap gap-2">{item.examples.map((example)=><span key={example} className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-smoke ring-1 ring-line">{example}</span>)}</div>
            </div>
          ))}
        </div>
        <Button href="/contact" className="mt-10">Discuss your application</Button>
      </Section>
    </>
  );
}
