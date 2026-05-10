// Static-export 404 (Caddy serves out/404.html on @apex 404 errors).
//
// This file lives at app/ root, OUTSIDE the [lang] segment, so it renders
// without the bilingual layout (no nav, no footer, no theme provider). To
// stay readable without the Tailwind build wiring, it uses inline styles
// that match the production dark palette.
//
// Bilingual: shows EN + FR side-by-side because at render time we don't
// know which lang the user requested (the path didn't match any route).

const wrap: React.CSSProperties = {
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  background: "#0a0a0a",
  color: "#fafafa",
  minHeight: "100vh",
  margin: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "2rem",
};

const card: React.CSSProperties = {
  maxWidth: "600px",
  width: "100%",
  textAlign: "center",
};

const tag: React.CSSProperties = {
  fontSize: "0.75rem",
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  color: "#a1a1aa",
};

const h1: React.CSSProperties = {
  marginTop: "1rem",
  marginBottom: 0,
  fontSize: "clamp(1.75rem, 5vw, 2.5rem)",
  fontWeight: 600,
  letterSpacing: "-0.02em",
  lineHeight: 1.1,
};

const lead: React.CSSProperties = {
  marginTop: "1.5rem",
  marginBottom: 0,
  fontSize: "1.05rem",
  color: "#a1a1aa",
  lineHeight: 1.6,
};

const ctaRow: React.CSSProperties = {
  marginTop: "2.5rem",
  display: "flex",
  flexWrap: "wrap",
  gap: "0.75rem",
  justifyContent: "center",
};

const btnPrimary: React.CSSProperties = {
  display: "inline-block",
  padding: "0.625rem 1.25rem",
  borderRadius: "0.5rem",
  background: "#fafafa",
  color: "#0a0a0a",
  textDecoration: "none",
  fontWeight: 500,
  fontSize: "0.95rem",
  border: "1px solid #fafafa",
};

const btnSecondary: React.CSSProperties = {
  ...btnPrimary,
  background: "transparent",
  color: "#fafafa",
  border: "1px solid #3f3f46",
};

const linkRow: React.CSSProperties = {
  marginTop: "2rem",
  display: "flex",
  flexWrap: "wrap",
  gap: "0.5rem 1.25rem",
  justifyContent: "center",
  fontSize: "0.875rem",
  color: "#a1a1aa",
};

const subtleLink: React.CSSProperties = {
  color: "#a1a1aa",
  textDecoration: "none",
};

export default function NotFound() {
  return (
    <main style={wrap}>
      <div style={card}>
        <p style={tag}>404</p>
        <h1 style={h1}>Page not found · Page introuvable</h1>
        <p style={lead}>
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <p style={{ ...lead, marginTop: "0.25rem" }}>
          La page que vous cherchez n&apos;existe pas ou a été déplacée.
        </p>

        <div style={ctaRow}>
          <a href="/en/" style={btnPrimary}>
            Home (EN)
          </a>
          <a href="/fr/" style={btnSecondary}>
            Accueil (FR)
          </a>
        </div>

        <div style={linkRow}>
          <a href="/en/docs/" style={subtleLink}>
            Documentation
          </a>
          <span aria-hidden="true">·</span>
          <a href="/en/pricing/" style={subtleLink}>
            Pricing
          </a>
          <span aria-hidden="true">·</span>
          <a
            href="https://github.com/ericvaillancourt/govforge"
            target="_blank"
            rel="noopener noreferrer"
            style={subtleLink}
          >
            GitHub
          </a>
        </div>
      </div>
    </main>
  );
}
