// shared seating utilities

/**
 * Split a list of names into a given number of groups in round-robin fashion.
 * The resulting groups will be roughly equal in size and preserve input order.
 */
export function splitIntoGroups(names: string[], count: number): string[][] {
  const groups: string[][] = Array.from({ length: count }, () => []);
  names.forEach((n, i) => groups[i % count].push(n));
  return groups;
}
