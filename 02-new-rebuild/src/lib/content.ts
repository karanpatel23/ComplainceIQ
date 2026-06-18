import {
  BadgeCheck,
  Boxes,
  Car,
  ClipboardCheck,
  Cog,
  Factory,
  FileCheck2,
  Gauge,
  Globe2,
  MapPin,
  PackageCheck,
  Pill,
  Settings,
  ShieldCheck,
  Shirt,
  Truck,
  Wrench,
  Droplets,
} from "lucide-react";

export const company = {
  name: "Royal Engitech Pvt. Ltd.",
  tagline: "Manufacturer & Exporter of Precision Engineered Components and Assemblies",
  founded: "1965",
  certification: "ISO 9001:2015",
  address: "15, 16 & 17, Nimesh Estate, Nr. Amar Estate, Memco, Naroda Road, Ahmedabad – 380025, Gujarat, India",
  contactPerson: "Mr. Sanket Panchal (Sales Department)",
  phone: "+91-79-2220 0993 / 994",
  fax: "+91-79-2220 4284",
  emails: ["sales@royalengitech.com", "info@royalengitech.com"],
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=15%2C%2016%20%26%2017%2C%20Nimesh%20Estate%2C%20Nr.%20Amar%20Estate%2C%20Memco%2C%20Naroda%20Road%2C%20Ahmedabad%20380025%2C%20Gujarat%2C%20India",
};

export const navItems = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/products", label: "Products" },
  { href: "/industries", label: "Industries" },
  { href: "/quality-infrastructure", label: "Quality" },
  { href: "/export-global-presence", label: "Export" },
  { href: "/contact", label: "Contact" },
];

export const productCategories = [
  {
    id: "cnc-turned-parts",
    title: "CNC Turned Parts",
    summary: "Drawing-based CNC turned components from cast iron, mild steel, alloy steel, non-ferrous metals and forged materials.",
    details: "Turning capacity up to 300 mm diameter, 900 mm length, and components up to 500 mm wide by 400 mm thick.",
    applications: ["Machine housings", "Precision flanges", "Bushes and sleeves", "Special turned parts"],
    materials: "Cast iron, mild steel, alloy steel, non-ferrous metals and forgings",
    icon: Settings,
    visual: "cnc",
  },
  {
    id: "aluminum-parts",
    title: "Aluminum Parts",
    summary: "Gravity die casting, pressure die casting, machined aluminum components and replacement ATC parts.",
    details: "Pressure die casting capacity up to 3.000 kgs with die-making, casting and post-casting machining support.",
    applications: ["Aluminum machine parts", "Equipment brackets", "ATC replacement parts", "Lightweight housings"],
    materials: "Aluminum castings and machined aluminum alloys",
    icon: Factory,
    visual: "aluminum",
  },
  {
    id: "non-ferrous-castings",
    title: "Non-Ferrous Castings & Machined Parts",
    summary: "Pattern development, casting, machining and accuracy-driven finishing for non-ferrous components.",
    details: "In-house pattern support and CNC machining help reduce machining tolerance, time and cost while matching customer drawings.",
    applications: ["Bronze components", "Non-ferrous bushings", "Precision rings", "Custom machined castings"],
    materials: "Non-ferrous casting grades per drawing and buyer requirement",
    icon: Gauge,
    visual: "nonFerrous",
  },
  {
    id: "cast-iron-castings",
    title: "Cast Iron Castings & Machined Parts",
    summary: "Ferrous castings with foundry, pattern capability and CNC machining for customer-specific drawings.",
    details: "Foundry and machine-shop coordination supports accurate cast iron components and finished assemblies.",
    applications: ["Pump and valve castings", "Machine bases", "Housings", "Industrial brackets"],
    materials: "Cast iron and ferrous casting grades per application",
    icon: Cog,
    visual: "castIron",
  },
  {
    id: "sheet-metal-parts",
    title: "Sheet Metal Parts",
    summary: "Cutting, pressing, blanking, curling, bending, slitting, deep drawing and welded structures.",
    details: "CNC laser cutting capacity of 1500 x 3000 x 12 mm and bending capacity of 3000 x 8 mm thickness.",
    applications: ["Fabricated structures", "Enclosures", "Pressed components", "Welded industrial assemblies"],
    materials: "Sheet metal grades selected by drawing, finish and duty cycle",
    icon: PackageCheck,
    visual: "sheetMetal",
  },
  {
    id: "gears-pulleys",
    title: "Rack, Pinion, Gears & Timing Pulleys",
    summary: "Hardened gears, racks, pinions and pulleys for gear boxes, textile machinery and pharmaceutical equipment.",
    details: "Gear manufacturing up to 6 module or as per customer requirement.",
    applications: ["Gear boxes", "Textile drives", "Timing assemblies", "Power transmission systems"],
    materials: "Steel, alloy steel and buyer-specified transmission materials",
    icon: Wrench,
    visual: "gears",
  },
  {
    id: "ground-shafts",
    title: "Ground Shafts",
    summary: "Ground shafts manufactured for precision motion, transmission and industrial machinery assemblies.",
    details: "Diameter up to 100 mm and length up to 6000 mm.",
    applications: ["Linear motion", "Transmission shafts", "Machine spindles", "Long precision rods"],
    materials: "Steel and alloy grades selected by drawing and application",
    icon: Gauge,
    visual: "shafts",
  },
  {
    id: "brass-nrv",
    title: "Brass Spring Non Return Valve",
    summary: "Spring-loaded brass check valve for liquid systems requiring one-direction flow with no return flow.",
    details: "Manufactured with high-grade materials to support reliable resistance in demanding operating conditions.",
    applications: ["Liquid systems", "Pump lines", "Valve assemblies", "Industrial flow control"],
    materials: "Brass and valve-grade components",
    icon: Droplets,
    visual: "brassValve",
  },
];

export const industries = [
  {
    title: "Textile Machinery",
    icon: Shirt,
    text: "Precision drive, motion and machine components for textile production equipment.",
    examples: ["Gears and pulleys", "CNC turned parts", "Machine brackets", "Custom assemblies"],
  },
  {
    title: "Power Transmission",
    icon: Cog,
    text: "Components for rotational motion, gearboxes and high-repeatability transmission systems.",
    examples: ["Racks and pinions", "Timing pulleys", "Ground shafts", "Hardened gears"],
  },
  {
    title: "Water Pumps",
    icon: Droplets,
    text: "Machined and cast components supporting fluid movement, pump bodies and related assemblies.",
    examples: ["Cast iron parts", "Valve components", "Brass NRV", "Machined housings"],
  },
  {
    title: "Valves",
    icon: Settings,
    text: "Industrial valve parts and flow-control components manufactured to buyer drawings.",
    examples: ["Non-return valves", "Flanges", "Bodies", "Precision rings"],
  },
  {
    title: "Automobile",
    icon: Car,
    text: "Repeat-production components for automotive and industrial mobility supply chains.",
    examples: ["CNC parts", "Sheet metal parts", "Aluminum castings", "Shafts"],
  },
  {
    title: "Pharmaceutical",
    icon: Pill,
    text: "Precision parts for equipment where reliability, finish and documentation readiness matter.",
    examples: ["Gears", "Pulleys", "Fabricated components", "Custom machined parts"],
  },
  {
    title: "Other Industrial Sectors",
    icon: Boxes,
    text: "Custom engineering support for OEMs, exporters and industrial sourcing teams.",
    examples: ["Drawing-based manufacturing", "Tooling", "Fixtures", "Assemblies"],
  },
];

export const capabilities = [
  { label: "CNC / VMC machining", detail: "VMC, CNC turning, 4th-axis machining and custom drawing-based components." },
  { label: "Foundry coordination", detail: "Ferrous and non-ferrous casting development supported by pattern capability." },
  { label: "Fabrication", detail: "Laser cutting, press brake, shearing, deep drawing and welded structures." },
  { label: "Tooling & fixtures", detail: "Special gauges, fixtures, patterns and production support for repeatability." },
  { label: "CAD/CAM", detail: "Siemens Solid Edge/NX CAD/CAM support for development and machining planning." },
  { label: "Dispatch readiness", detail: "Identification, packaging, documentation and service support through shipment." },
];

export const workshopMachines = [
  ["VMC machining", "HAAS VF-3, HAAS TM-1P, FANUC Robodrill, BFW XTRON / AGNI / VAYU / CHAKRA", "4th-axis support on selected machines"],
  ["CNC turning", "ACE Super Jobber, ACE Jobber-XL, Jyoti DX-200, Hazoe CK-640", "Up to 500 x 320 mm turning range references"],
  ["Gear production", "CNC hobbing, hobbing and shaping machines", "Up to Ø320 mm and 6 module references"],
  ["Fabrication shop", "CNC laser cutting, CNC press brake, shearing, power press, pneumatic press and welding", "Laser 1500 x 3000 x 12 mm; bending 3000 x 8 mm"],
  ["Foundry shop", "Induction furnace, cupola furnace, moulding machines and shot blast support", "Ferrous and non-ferrous casting readiness"],
];

export const qualityProcess = [
  { title: "RFQ & drawing review", text: "Requirement, quantity, material, tolerance and application are reviewed before production planning.", icon: ClipboardCheck },
  { title: "Material & process planning", text: "Raw material, casting/forging route, tooling, fixtures and machining sequence are defined.", icon: Factory },
  { title: "Precision manufacturing", text: "CNC, VMC, fabrication, foundry and assembly capabilities are coordinated for the part family.", icon: Gauge },
  { title: "Inspection & documentation", text: "Computerized measuring instruments, process checks and required certificates support dispatch readiness.", icon: FileCheck2 },
  { title: "Packaging & dispatch", text: "Identification, export-aware packaging and after-sales communication support the supply relationship.", icon: Truck },
];

export const qualityPoints = [
  "Inquiry-to-dispatch process discipline",
  "Raw material procurement and traceability focus",
  "Inspection with computerized measuring instruments",
  "Packaging, certification and after-sales service",
  "International quality norms and export documentation readiness",
];

export const trustSignals = [
  { label: "Established", value: "1965" },
  { label: "Quality system", value: "ISO 9001:2015" },
  { label: "Engineering experience", value: "50+ years" },
  { label: "Location", value: "Ahmedabad, India" },
];

export const exportReadiness = [
  { title: "Drawing-led manufacturing", text: "Built around buyer drawings, samples, material requirements and application needs.", icon: BadgeCheck },
  { title: "Documentation mindset", text: "Supports identification, packaging, certificates and international buyer communication.", icon: FileCheck2 },
  { title: "Repeat-production focus", text: "Process discipline, tooling and fixtures support repeat orders and supplier reliability.", icon: ShieldCheck },
  { title: "Export communication", text: "Clear inquiry flow for country, interest, phone, email and detailed technical message.", icon: Globe2 },
];

export const rfqSteps = ["Share drawing / sample / requirement", "Review material, tolerance, quantity and application", "Plan production route and documentation", "Manufacture, inspect, package and dispatch"];

export const redirects = [
  ["/index.html", "/"],
  ["/about-us.html", "/about"],
  ["/products.html", "/products"],
  ["/contact-us.html", "/contact"],
  ["/inquiry.php.html", "/contact"],
  ["/inquiry.php", "/contact"],
  ["/infrastructure.html", "/quality-infrastructure"],
  ["/work-shop.html", "/quality-infrastructure"],
  ["/fabrication-shop.html", "/quality-infrastructure"],
  ["/foundry-shop.html", "/quality-infrastructure"],
  ["/cnc-turned-parts.html", "/products#cnc-turned-parts"],
  ["/aluminum-parts.html", "/products#aluminum-parts"],
  ["/non-ferrous-castings-and-machined-parts.html", "/products#non-ferrous-castings"],
  ["/cast-iron-castings-and-machined-parts.html", "/products#cast-iron-castings"],
  ["/sheet-metal-parts.html", "/products#sheet-metal-parts"],
  ["/gears-and-timing-pulleys.html", "/products#gears-pulleys"],
  ["/ground-shafts.html", "/products#ground-shafts"],
];

export const contactHighlights = [
  { label: "Factory location", value: "Naroda Road, Ahmedabad" , icon: MapPin },
  { label: "Primary contact", value: company.contactPerson, icon: BadgeCheck },
  { label: "Inquiry focus", value: "Product, RFQ and export requirements", icon: FileCheck2 },
];
