// Re-exports the site share card: /now sets its own openGraph/twitter text, which would otherwise drop the root image.
export { default, alt, size, contentType } from "../../opengraph-image";
