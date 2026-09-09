import type { Metadata } from "next";
import { OrbiqonLanding } from "@/components/orbiqon-landing";

// Orbiqon: the root page is a one-section branded landing, not upstream's
// product marketing page. Keep this file tiny so upstream merges stay trivial.

export const metadata: Metadata = {
  title: "shazimbuilds",
  description:
    "Guides and build logs for founders who ship. Comment the keyword on an Instagram post and the guide arrives here.",
};

export default function HomePage() {
  return <OrbiqonLanding />;
}
