// Test stub for "next/cache" (see src/test/hooks.mjs): records every cache
// invalidation instead of performing it.
export const cacheCalls: { fn: string; arg: string }[] = [];

export function updateTag(tag: string) {
  cacheCalls.push({ fn: "updateTag", arg: tag });
}
export function revalidateTag(tag: string) {
  cacheCalls.push({ fn: "revalidateTag", arg: tag });
}
export function revalidatePath(path: string) {
  cacheCalls.push({ fn: "revalidatePath", arg: path });
}
