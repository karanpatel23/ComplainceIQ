import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.royalengitech.com"),
  title: { default: "Royal Engitech | Precision Engineered Components Manufacturer & Exporter", template: "%s | Royal Engitech" },
  description: "Royal Engitech manufactures and exports high-tech precision engineered components and assemblies for textile machinery, power transmission, pumps, valves, automobile and pharmaceutical industries.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
