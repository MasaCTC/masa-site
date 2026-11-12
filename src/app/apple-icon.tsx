import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Read once at module scope; next/font can't be reused inside ImageResponse.
const spaceGroteskBold = readFile(
  join(process.cwd(), "src/assets/fonts/SpaceGrotesk-Bold.ttf"),
);

// iOS ignores dark mode for home-screen icons, so this is light only.
export default async function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ece6dd",
          color: "#2a241e",
          borderRadius: 40,
          fontFamily: "Space Grotesk",
          fontSize: 72,
          fontWeight: 700,
          letterSpacing: "0.01em",
        }}
      >
        MC
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Space Grotesk",
          data: await spaceGroteskBold,
          weight: 700,
          style: "normal",
        },
      ],
    },
  );
}
