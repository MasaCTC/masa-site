import { defineConfig } from "drizzle-kit";

// drizzle-kit does not load Next's env files; load .env.local ourselves.
try {
  process.loadEnvFile(".env.local");
} catch {
  // File missing: fall back to the real environment (e.g. CI).
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // Migrations use the direct (unpooled) connection.
    url: process.env.DATABASE_URL_UNPOOLED ?? "",
  },
});
