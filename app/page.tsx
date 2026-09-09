import type { Metadata } from "next";
import { OrbiqonLanding } from "@/components/orbiqon-landing";
import { getLatestGuide } from "@/lib/orbiqon/latest-guide";

// Orbiqon: the root page is a one-section branded landing, not upstream's
// product marketing page. Keep this file tiny so upstream merges stay trivial.

export const metadata: Metadata = {
  title: "shazimbuilds",
  description:
    "Guides and build logs for founders who ship. Comment the keyword on an Instagram post and the guide arrives here.",
};

// Re-read the latest guide from the database at most every 5 minutes.
export const revalidate = 300;

export default async function HomePage() {
  const latestGuide = await getLatestGuide();
  return <OrbiqonLanding latestGuide={latestGuide} />;
}
