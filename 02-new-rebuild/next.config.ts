import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/about-us.html", destination: "/about", permanent: true },
      { source: "/products.html", destination: "/products", permanent: true },
      { source: "/contact-us.html", destination: "/contact", permanent: true },
      { source: "/inquiry.php.html", destination: "/contact", permanent: true },
      { source: "/inquiry.php", destination: "/contact", permanent: true },
      { source: "/infrastructure.html", destination: "/quality-infrastructure", permanent: true },
      { source: "/work-shop.html", destination: "/quality-infrastructure", permanent: true },
      { source: "/fabrication-shop.html", destination: "/quality-infrastructure", permanent: true },
      { source: "/foundry-shop.html", destination: "/quality-infrastructure", permanent: true },
      { source: "/cnc-turned-parts.html", destination: "/products#cnc-turned-parts", permanent: true },
      { source: "/aluminum-parts.html", destination: "/products#aluminum-parts", permanent: true },
      { source: "/non-ferrous-castings-and-machined-parts.html", destination: "/products#non-ferrous-castings", permanent: true },
      { source: "/cast-iron-castings-and-machined-parts.html", destination: "/products#cast-iron-castings", permanent: true },
      { source: "/sheet-metal-parts.html", destination: "/products#sheet-metal-parts", permanent: true },
      { source: "/gears-and-timing-pulleys.html", destination: "/products#gears-pulleys", permanent: true },
      { source: "/ground-shafts.html", destination: "/products#ground-shafts", permanent: true }
    ];
  },
};

export default nextConfig;
