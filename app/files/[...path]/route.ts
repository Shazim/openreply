import { NextRequest, NextResponse } from "next/server";

/**
 * Serves lead-magnet files (HTML guides and PDFs) from a Vercel Blob store on
 * this app's own domain, so DM links look like https://reply.orbiqon.com/files/<name>.
 *
 * - `/files/agents-pack`      -> `<blob>/agents-pack.html` (extensionless = HTML page)
 * - `/files/agents-pack.pdf`  -> `<blob>/agents-pack.pdf`  (served inline)
 *
 * Files are uploaded with `vercel blob put` and need no deploy. The store's
 * public base URL comes from FILES_BLOB_BASE_URL. Responses carry
 * `X-Robots-Tag: noindex` because these pages are meant to be earned by
 * commenting, not found on Google.
 *
 * This route is Orbiqon-specific and is not part of upstream OpenReply.
 */

type FilesRouteProps = {
  params: Promise<{ path: string[] }>;
};

const SAFE_SEGMENT = /^[a-zA-Z0-9._-]+$/;

export async function GET(_request: NextRequest, { params }: FilesRouteProps) {
  const baseUrl = process.env.FILES_BLOB_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    return new NextResponse("File hosting is not configured", { status: 503 });
  }

  const { path } = await params;
  if (
    !path?.length ||
    path.some((segment) => !SAFE_SEGMENT.test(segment) || segment.startsWith("."))
  ) {
    return new NextResponse("Not found", { status: 404 });
  }

  let pathname = path.join("/");
  const hasExtension = /\.[a-zA-Z0-9]+$/.test(pathname);
  if (!hasExtension) pathname += ".html";

  const upstream = await fetch(`${baseUrl}/${pathname}`, {
    next: { revalidate: 300 },
  });

  if (!upstream.ok || !upstream.body) {
    return new NextResponse("Not found", { status: 404 });
  }

  const headers = new Headers();
  headers.set(
    "Content-Type",
    upstream.headers.get("content-type") ?? "application/octet-stream"
  );
  const length = upstream.headers.get("content-length");
  if (length) headers.set("Content-Length", length);
  headers.set("Cache-Control", "public, max-age=300, s-maxage=3600");
  headers.set("X-Robots-Tag", "noindex, nofollow");
  if (pathname.endsWith(".pdf")) {
    const filename = pathname.split("/").pop() ?? "file.pdf";
    headers.set("Content-Disposition", `inline; filename="${filename}"`);
  }

  return new NextResponse(upstream.body, { status: 200, headers });
}
