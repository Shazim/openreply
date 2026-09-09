import Link from "next/link";

/**
 * Orbiqon-specific landing page for reply.orbiqon.com. One section, one action.
 * Replaces upstream's product marketing page; palette and fonts match the
 * hosted guides under /files so the domain reads as one brand.
 */

const INSTAGRAM_URL = "https://www.instagram.com/shazimbuilds/";

type OrbiqonLandingProps = {
  /** Newest active campaign's hosted guide, from lib/orbiqon/latest-guide. Null hides the button. */
  latestGuide: { label: string; href: string } | null;
};

export function OrbiqonLanding({ latestGuide }: OrbiqonLandingProps) {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cal+Sans&family=Manrope:wght@400..800&display=swap"
      />
      <main
        className="orbiqon-landing"
        style={{
          minHeight: "100dvh",
          background: "#F3EFE6",
          color: "#1E1A15",
          fontFamily: "'Manrope', system-ui, sans-serif",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <section
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            maxWidth: 760,
            width: "100%",
            margin: "0 auto",
            padding: "64px 28px 48px",
          }}
        >
          <p
            style={{
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: 3.5,
              textTransform: "uppercase",
              color: "#C96442",
              marginBottom: 18,
            }}
          >
            @shazimbuilds
          </p>
          <h1
            style={{
              fontFamily: "'Cal Sans', 'Manrope', system-ui, sans-serif",
              fontWeight: 400,
              fontSize: "clamp(38px, 7vw, 56px)",
              lineHeight: 1.08,
              margin: 0,
            }}
          >
            Guides and build logs for founders who ship.
          </h1>
          <p
            style={{
              marginTop: 22,
              fontSize: 18,
              lineHeight: 1.65,
              color: "#5C554A",
              maxWidth: 560,
            }}
          >
            This is where my Instagram DMs land. Comment the keyword on a post
            and the guide arrives here.
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              marginTop: 34,
            }}
          >
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                padding: "14px 24px",
                background: "#C96442",
                color: "#fff",
                borderRadius: 999,
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 15,
              }}
            >
              Follow on Instagram
            </a>
            {latestGuide ? (
              <Link
                href={latestGuide.href}
                style={{
                  display: "inline-block",
                  padding: "14px 24px",
                  background: "#FBF8F1",
                  color: "#1E1A15",
                  border: "1px solid #E3DCCD",
                  borderRadius: 999,
                  textDecoration: "none",
                  fontWeight: 700,
                  fontSize: 15,
                }}
              >
                {latestGuide.label}
              </Link>
            ) : null}
          </div>
        </section>
        <footer
          style={{
            maxWidth: 760,
            width: "100%",
            margin: "0 auto",
            padding: "0 28px 36px",
            display: "flex",
            flexWrap: "wrap",
            gap: 18,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 1,
            color: "#A79E8F",
          }}
        >
          <Link href="/privacy" style={{ color: "inherit", textDecoration: "none" }}>
            Privacy
          </Link>
          <Link href="/terms" style={{ color: "inherit", textDecoration: "none" }}>
            Terms
          </Link>
          <Link href="/login" style={{ color: "inherit", textDecoration: "none", marginLeft: "auto" }}>
            Sign in
          </Link>
        </footer>
      </main>
    </>
  );
}
