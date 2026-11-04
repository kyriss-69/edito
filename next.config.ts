import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Anciennes adresses de la Bibliothèque et des Comptes (regroupés sous « Marque »).
  async redirects() {
    return [
      { source: "/library", destination: "/brand", permanent: false },
      { source: "/library/brand", destination: "/brand", permanent: false },
      { source: "/library/:section(media|templates|hashtags)", destination: "/brand/:section", permanent: false },
      { source: "/accounts", destination: "/brand/accounts", permanent: false },
    ];
  },
};

export default nextConfig;
