const RESERVED = new Set([
  "admin",
  "api",
  "app",
  "dashboard",
  "login",
  "setup",
  "s",
  "settings",
  "offclock",
  "www",
]);

export function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function validateSlug(slug: string): string | null {
  if (slug.length < 3) return "Slug must be at least 3 characters.";
  if (slug.length > 30) return "Slug must be 30 characters or less.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return "Use lowercase letters, numbers, and hyphens only.";
  }
  if (RESERVED.has(slug)) return "That slug is reserved.";
  return null;
}
