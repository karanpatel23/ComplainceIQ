import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { company, navItems, productCategories } from "@/lib/content";

export function Footer() {
  return (
    <footer className="border-t border-line bg-graphite px-5 py-14 text-steel sm:px-8 lg:px-12">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.25fr_.8fr_1fr]">
        <div>
          <div className="mb-5 flex items-center gap-3 text-white"><span className="grid h-11 w-11 place-items-center rounded-full bg-brass font-black text-graphite">RE</span><strong>Royal Engitech Pvt. Ltd.</strong></div>
          <p className="max-w-xl leading-7 text-steel/85">{company.tagline}. Established in {company.founded}, Ahmedabad, Gujarat, India.</p>
          <p className="mt-4 text-sm leading-6 text-steel/75">{company.address}</p>
          <Link href={company.mapsUrl} target="_blank" className="mt-5 inline-flex items-center text-sm font-semibold text-white hover:text-brass">View on Google Maps <ExternalLink className="ml-2" size={15} /></Link>
        </div>
        <div>
          <h3 className="mb-4 font-semibold text-white">Company</h3>
          <div className="grid gap-2">
            {navItems.map((item) => <Link className="text-steel/80 hover:text-white" href={item.href} key={item.href}>{item.label}</Link>)}
          </div>
        </div>
        <div>
          <h3 className="mb-4 font-semibold text-white">Capabilities</h3>
          <div className="grid gap-2">
            {productCategories.slice(0, 6).map((item) => <Link className="text-steel/80 hover:text-white" href={`/products#${item.id}`} key={item.id}>{item.title}</Link>)}
          </div>
        </div>
      </div>
      <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-3 border-t border-white/10 pt-6 text-sm text-steel/70 sm:flex-row sm:justify-between">
        <p>© {new Date().getFullYear()} Royal Engitech Pvt. Ltd. All rights reserved.</p>
        <p>Email: {company.emails.join(" / ")} · Phone: {company.phone}</p>
      </div>
    </footer>
  );
}
