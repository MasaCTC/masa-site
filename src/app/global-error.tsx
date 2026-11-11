"use client";

// Last-resort fallback when the root layout itself fails. It replaces the root
// layout, so it brings its own document, the design tokens and the theme script
// (same behavior as the one in layout.tsx). Plain <a> and <button> on purpose: the
// router may be what broke. It never shows or logs what went wrong.
import "../../design/system/tokens.css";
import "../../design/system/bundle.css";
import { useEffect } from "react";

// Follows the OS color scheme like the layout's theme script. An effect rather than
// an inline <script>: React warns about scripts rendered on the client.
function useSystemTheme() {
  useEffect(() => {
    const m = window.matchMedia("(prefers-color-scheme: dark)");
    const root = document.documentElement;
    const apply = () => root.setAttribute("data-theme", m.matches ? "dark" : "light");
    apply();
    m.addEventListener("change", apply);
    return () => m.removeEventListener("change", apply);
  }, []);
}

export default function GlobalError({ retry }: { retry: () => void }) {
  useSystemTheme();
  return (
    <html lang="en" data-theme="light" data-type="a" suppressHydrationWarning>
      <head>
        <title>Something broke · Masa Chien</title>
      </head>
      <body className="mn-root">
        <div className="mn-page">
          <main style={{ display: "flex", justifyContent: "center" }}>
            <section
              className="mn-card mn-card--lg"
              style={{
                width: "100%",
                maxWidth: 640,
                display: "flex",
                flexDirection: "column",
                gap: 20,
                alignItems: "flex-start",
              }}
            >
              <span className="mn-label" style={{ color: "var(--danger)" }}>
                Error
              </span>
              <h1 className="mn-display-lg" style={{ fontSize: 48, lineHeight: "52px" }}>Something broke on my end.</h1>
              <p className="mn-body-lg">
                Not your fault. Try again, and if it keeps happening, the home page still works.
              </p>
              <div className="mn-row" style={{ gap: 16 }}>
                <button type="button" className="mn-btn mn-btn--primary" onClick={() => retry()}>
                  Try again
                </button>
                {/* Full page load on purpose: the router may be what broke. */}
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a className="mn-btn" href="/">
                  Go home
                </a>
              </div>
            </section>
          </main>
        </div>
      </body>
    </html>
  );
}
