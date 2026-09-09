import { prisma } from "@/lib/db/client";

/**
 * The newest active campaign whose DM link points at a guide hosted on this
 * domain (/files/<slug>). Drives the "Latest guide" button on the landing
 * page, so publishing a campaign updates the site with no edit or deploy.
 *
 * The campaign name is shown publicly as the button label, e.g.
 * "Latest guide: Founder Agents Pack".
 *
 * Orbiqon-specific, not part of upstream OpenReply.
 */

export type LatestGuide = {
  label: string;
  href: string;
};

const FILES_PATH_PREFIX = "/files/";

export async function getLatestGuide(): Promise<LatestGuide | null> {
  try {
    const link = await prisma.trackedLink.findFirst({
      where: {
        destinationUrl: { contains: FILES_PATH_PREFIX },
        automation: { isActive: true },
      },
      orderBy: { createdAt: "desc" },
      select: {
        destinationUrl: true,
        automation: { select: { name: true } },
      },
    });
    if (!link) return null;

    const url = new URL(link.destinationUrl);
    if (!url.pathname.startsWith(FILES_PATH_PREFIX)) return null;

    return {
      label: `Latest guide: ${link.automation.name}`,
      href: url.pathname,
    };
  } catch (error) {
    console.error("[landing] Failed to load latest guide:", error);
    return null;
  }
}
