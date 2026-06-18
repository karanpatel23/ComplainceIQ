import { Suspense } from "react";
import { ExternalLink, Mail, MapPin, Phone } from "lucide-react";
import { ContactForm } from "@/components/contact-form";
import { Button, PageHero, Panel, Section } from "@/components/ui";
import { company, contactHighlights } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Contact & Inquiry", path: "/contact", description: "Send a precision component, product or export inquiry to Royal Engitech in Ahmedabad, Gujarat, India." });

export default function ContactPage(){
  return (
    <>
      <PageHero eyebrow="Contact / Inquiry" title="Send a product, component or export RFQ." intro="Share your requirement with the Royal Engitech team for review. Include drawings, material, quantity, tolerance, country and expected delivery timeline where available." />

      <Section>
        <div className="grid gap-8 lg:grid-cols-[.82fr_1.18fr] lg:items-start">
          <div className="grid gap-6">
            <Panel>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-copper">Contact details</p>
              <h2 className="mt-3 text-3xl font-semibold text-graphite">Royal Engitech Pvt. Ltd.</h2>
              <div className="mt-6 grid gap-4 text-smoke">
                <p className="flex gap-3 leading-7"><MapPin className="mt-1 shrink-0 text-copper" size={19}/>{company.address}</p>
                <p className="flex gap-3"><Phone className="shrink-0 text-copper" size={19}/>{company.phone}</p>
                <p className="flex gap-3"><Mail className="shrink-0 text-copper" size={19}/>{company.emails.join(" / ")}</p>
              </div>
              <p className="mt-5 text-sm text-smoke">Contact Person: {company.contactPerson}</p>
            </Panel>

            <section className="overflow-hidden rounded-[2rem] border border-line bg-graphite text-white shadow-editorial">
              <div className="engineering-grid p-6">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-brass">Visit / Directions</p>
                <h2 className="mt-3 text-3xl font-semibold">Ahmedabad manufacturing location</h2>
                <p className="mt-4 leading-7 text-steel">Use Google Maps to locate Royal Engitech at Nimesh Estate, near Amar Estate, Memco, Naroda Road, Ahmedabad.</p>
                <a href={company.mapsUrl} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-graphite transition hover:bg-brass">
                  View on Google Maps <ExternalLink className="ml-2" size={16}/>
                </a>
              </div>
              <div className="grid grid-cols-3 border-t border-white/10">
                {contactHighlights.map((item)=><div key={item.label} className="border-r border-white/10 p-4 last:border-r-0"><item.icon className="mb-2 text-brass" size={18}/><p className="text-xs uppercase tracking-[0.18em] text-steel/70">{item.label}</p><p className="mt-2 text-sm font-semibold text-white">{item.value}</p></div>)}
              </div>
            </section>
          </div>
          <Suspense fallback={<div className="rounded-[2rem] border border-line bg-porcelain p-8">Loading inquiry form…</div>}><ContactForm /></Suspense>
        </div>
      </Section>

      <Section className="bg-porcelain" title="What to include in your inquiry" intro="The more technical context you provide, the faster the team can evaluate manufacturing route, inspection needs and commercial next steps.">
        <div className="grid gap-5 md:grid-cols-4">
          {['Drawing or sample reference','Material and finish requirement','Quantity and repeat schedule','Destination country and timeline'].map((item)=><div key={item} className="border-t-2 border-brass bg-white p-5 text-lg font-semibold text-graphite shadow-sm">{item}</div>)}
        </div>
      </Section>
    </>
  );
}
