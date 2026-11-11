import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getInstagramStats } from "@/lib/instagram";
import { OG_FALLBACK_TEXT, ogStatsView, type OgStatsView } from "@/lib/instagram/og";

export const alt = "Masa Chien (@masamcodes): CS at UC Irvine, building apps in public";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const dir = join(process.cwd(), "src/assets/fonts");
const spaceGroteskBold = readFile(join(dir, "SpaceGrotesk-Bold.ttf"));
const spaceGroteskRegular = readFile(join(dir, "SpaceGrotesk-Regular.ttf"));
const spaceGroteskSemiBold = readFile(join(dir, "SpaceGrotesk-SemiBold.ttf"));
const plexMedium = readFile(join(dir, "IBMPlexMono-Medium.ttf"));
const plexSemiBold = readFile(join(dir, "IBMPlexMono-SemiBold.ttf"));

// Always light: share cards don't know the viewer's theme. Tokens from design/system/tokens.css.
const SURFACE = "#ece6dd";
const SUNKEN = "#e4ddd2";
const INK = "#2a241e";
const MUTED = "#5a5147";
const LINE = "#d6cdbf";
const SHADOW_DARK = "#c9bfb0";
const SHADOW_LIGHT = "#f7f3ed";

async function loadView(): Promise<OgStatsView> {
  try {
    return ogStatsView(await getInstagramStats());
  } catch {
    return { kind: "fallback", text: OG_FALLBACK_TEXT };
  }
}

export default async function OpengraphImage() {
  const view = await loadView();

  const cell = {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    padding: "22px 28px",
    borderRadius: 22,
    background: SUNKEN,
    border: `1px solid ${LINE}`,
  };
  const cellLabel = {
    fontFamily: "Space Grotesk",
    fontWeight: 600,
    fontSize: 18,
    lineHeight: "22px",
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: MUTED,
  };
  const cellValue = {
    fontFamily: "IBM Plex Mono",
    fontWeight: 600,
    fontSize: 52,
    lineHeight: 1,
    color: INK,
  };

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: SURFACE,
          color: INK,
          fontFamily: "Space Grotesk",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              fontSize: 20,
              lineHeight: "24px",
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: MUTED,
            }}
          >
            @masamcodes · UC Irvine CS
          </div>
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: 42,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: SURFACE,
              boxShadow: `8px 8px 16px ${SHADOW_DARK}, -8px -8px 16px ${SHADOW_LIGHT}`,
              fontSize: 30,
              fontWeight: 700,
              color: INK,
            }}
          >
            MC
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 104, lineHeight: 1, fontWeight: 700, letterSpacing: "-0.02em" }}>
            Masa Chien
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 22,
              maxWidth: 1040,
              fontSize: 34,
              lineHeight: "46px",
              fontWeight: 400,
              color: MUTED,
            }}
          >
            CS at UC Irvine. I build apps in public and post the real numbers.
          </div>
        </div>

        {view.kind === "stats" ? (
          <div style={{ display: "flex", gap: 24, alignItems: "stretch" }}>
            <div style={cell}>
              <div style={cellLabel}>Followers</div>
              <div style={cellValue}>{view.followers}</div>
            </div>
            <div style={cell}>
              <div style={cellLabel}>Views · 90 days</div>
              <div style={cellValue}>{view.views}</div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "flex-end" }}>
              <div
                style={{
                  display: "flex",
                  fontFamily: "IBM Plex Mono",
                  fontWeight: 500,
                  fontSize: 20,
                  letterSpacing: "0.02em",
                  whiteSpace: "nowrap",
                  color: MUTED,
                }}
              >
                masa-site-nine.vercel.app
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: INK }}>{view.text}</div>
            <div
              style={{
                display: "flex",
                fontFamily: "IBM Plex Mono",
                fontWeight: 500,
                fontSize: 20,
                letterSpacing: "0.02em",
                whiteSpace: "nowrap",
                color: MUTED,
              }}
            >
              masa-site-nine.vercel.app
            </div>
          </div>
        )}
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Space Grotesk", data: await spaceGroteskRegular, weight: 400, style: "normal" },
        { name: "Space Grotesk", data: await spaceGroteskSemiBold, weight: 600, style: "normal" },
        { name: "Space Grotesk", data: await spaceGroteskBold, weight: 700, style: "normal" },
        { name: "IBM Plex Mono", data: await plexMedium, weight: 500, style: "normal" },
        { name: "IBM Plex Mono", data: await plexSemiBold, weight: 600, style: "normal" },
      ],
    },
  );
}
