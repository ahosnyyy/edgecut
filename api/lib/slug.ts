/**
 * Convert a name into a URL-safe slug.
 * "Tower B" → "tower-b", "Riverside #3!" → "riverside-3"
 */
export function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Generate a unique slug within a scope.
 * If the base slug is taken, append -2, -3, etc.
 *
 * @param baseName - The name to slugify
 * @param existingSlugs - Set of slugs already in use within the scope
 * @returns A unique slug
 */
export function generateUniqueSlug(
  baseName: string,
  existingSlugs: Set<string>,
): string {
  const base = nameToSlug(baseName) || "untitled";
  if (!existingSlugs.has(base)) return base;

  let n = 2;
  while (existingSlugs.has(`${base}-${n}`)) {
    n++;
  }
  return `${base}-${n}`;
}
