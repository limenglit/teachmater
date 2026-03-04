// utilities for seating arrangement across different scene components

/**
 * Split a list of names into a given number of groups in round-robin fashion.
 *
 * @param names - array of student names
 * @param count - number of groups to create
 * @returns an array of groups, each group is an array of names
 */
export function splitIntoGroups(names: string[], count: number): string[][] {
  const groups: string[][] = Array.from({ length: count }, () => []);
  names.forEach((n, i) => groups[i % count].push(n));
  return groups;
}

/**
 * Return a new array with elements shuffled randomly.
 */
export function shuffleArray<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}
