import type { Student } from '@/hooks/useStudentStore';
import { buildTitleScorer, loadTitleRankRuleText } from '@/lib/title-rank';

export type TeamingDimension = 'organization' | 'gender' | 'titleLevel';

export type TeamingStrategy =
  | 'random'
  | 'sameOrganization'
  | 'sameTitleLevel'
  | 'sameGender'
  | 'balancedGender'
  | 'balancedOrganizationAndTitle'
  | 'custom';

export interface TeamingConfig {
  strategy: TeamingStrategy;
  bucketCount: number;
  customPrimaryDimension?: TeamingDimension | 'none';
  customBalanceDimensions?: TeamingDimension[];
}

const getTitleScore = (title?: string) => {
  try {
    const scorer = buildTitleScorer(loadTitleRankRuleText());
    return scorer(title);
  } catch {
    return 0;
  }
};

const normalizeOrganization = (value?: string) => {
  const v = value?.trim();
  return v ? v : '未分配单位';
};

const normalizeGender = (value?: Student['gender']) => {
  if (value === 'male') return '男';
  if (value === 'female') return '女';
  return '未知性别';
};

const normalizeTitleLevel = (title?: string) => {
  const score = getTitleScore(title);
  if (!title?.trim()) return '未填写职务';
  if (score <= 0) return '未匹配级别';
  return `L${score}`;
};

const getDimensionValue = (student: Student, dimension: TeamingDimension) => {
  if (dimension === 'organization') return normalizeOrganization(student.organization);
  if (dimension === 'gender') return normalizeGender(student.gender);
  return normalizeTitleLevel(student.title);
};

const buildEmptyBuckets = (bucketCount: number) => Array.from({ length: bucketCount }, () => [] as Student[]);

const pickSmallestBucketIndex = (buckets: Student[][]) => {
  let bestIndex = 0;
  let bestSize = Number.POSITIVE_INFINITY;
  buckets.forEach((bucket, index) => {
    if (bucket.length < bestSize) {
      bestSize = bucket.length;
      bestIndex = index;
    }
  });
  return bestIndex;
};

const shuffleStudents = (items: Student[]) => {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const groupByDimension = (students: Student[], dimension: TeamingDimension) => {
  const map = new Map<string, Student[]>();
  students.forEach(student => {
    const key = getDimensionValue(student, dimension);
    const bucket = map.get(key);
    if (bucket) bucket.push(student);
    else map.set(key, [student]);
  });
  return map;
};

const assignRandom = (students: Student[], bucketCount: number) => {
  const buckets = buildEmptyBuckets(bucketCount);
  const shuffled = shuffleStudents(students);
  shuffled.forEach((student, idx) => {
    buckets[idx % bucketCount].push(student);
  });
  return buckets;
};

const assignBySameDimension = (students: Student[], bucketCount: number, dimension: TeamingDimension) => {
  const buckets = buildEmptyBuckets(bucketCount);
  const groups = Array.from(groupByDimension(shuffleStudents(students), dimension).values())
    .sort((a, b) => b.length - a.length);

  groups.forEach(group => {
    const targetIdx = pickSmallestBucketIndex(buckets);
    buckets[targetIdx].push(...group);
  });

  return buckets;
};

const assignByBalancedDimension = (students: Student[], bucketCount: number, dimension: TeamingDimension) => {
  const buckets = buildEmptyBuckets(bucketCount);
  const grouped = Array.from(groupByDimension(shuffleStudents(students), dimension).values())
    .sort((a, b) => b.length - a.length);

  grouped.forEach(group => {
    group.forEach(student => {
      const targetIdx = pickSmallestBucketIndex(buckets);
      buckets[targetIdx].push(student);
    });
  });

  return buckets;
};

const countDimensionInBucket = (bucket: Student[], dimension: TeamingDimension, value: string) => {
  let count = 0;
  bucket.forEach(student => {
    if (getDimensionValue(student, dimension) === value) count += 1;
  });
  return count;
};

const pickBalancedTarget = (
  buckets: Student[][],
  student: Student,
  dimensions: TeamingDimension[],
) => {
  let bestIndex = 0;
  let bestScore = Number.POSITIVE_INFINITY;

  buckets.forEach((bucket, idx) => {
    let score = bucket.length * 2;
    dimensions.forEach(dimension => {
      const value = getDimensionValue(student, dimension);
      score += countDimensionInBucket(bucket, dimension, value);
    });
    if (score < bestScore) {
      bestScore = score;
      bestIndex = idx;
    }
  });

  return bestIndex;
};

const assignByBalancedDimensions = (
  students: Student[],
  bucketCount: number,
  dimensions: TeamingDimension[],
) => {
  const buckets = buildEmptyBuckets(bucketCount);
  const shuffled = shuffleStudents(students);
  shuffled.forEach(student => {
    const targetIdx = pickBalancedTarget(buckets, student, dimensions);
    buckets[targetIdx].push(student);
  });
  return buckets;
};

const assignByCustom = (students: Student[], config: TeamingConfig) => {
  const buckets = buildEmptyBuckets(config.bucketCount);
  const primary = config.customPrimaryDimension;
  const balance: TeamingDimension[] = config.customBalanceDimensions?.length
    ? config.customBalanceDimensions
    : ['organization', 'gender', 'titleLevel'];

  if (!primary || primary === 'none') {
    return assignByBalancedDimensions(students, config.bucketCount, balance);
  }

  const primaryGroups = Array.from(groupByDimension(shuffleStudents(students), primary).values())
    .sort((a, b) => b.length - a.length);

  primaryGroups.forEach(group => {
    const targetIdx = pickBalancedTarget(buckets, group[0], balance);
    buckets[targetIdx].push(...group);
  });

  return buckets;
};

export const buildTeamBuckets = (students: Student[], config: TeamingConfig) => {
  const bucketCount = Math.max(1, config.bucketCount);
  if (students.length === 0) return buildEmptyBuckets(bucketCount);

  if (config.strategy === 'sameOrganization') {
    return assignBySameDimension(students, bucketCount, 'organization');
  }
  if (config.strategy === 'sameTitleLevel') {
    return assignBySameDimension(students, bucketCount, 'titleLevel');
  }
  if (config.strategy === 'sameGender') {
    return assignBySameDimension(students, bucketCount, 'gender');
  }
  if (config.strategy === 'balancedGender') {
    return assignByBalancedDimension(students, bucketCount, 'gender');
  }
  if (config.strategy === 'balancedOrganizationAndTitle') {
    return assignByBalancedDimensions(students, bucketCount, ['organization', 'titleLevel']);
  }
  if (config.strategy === 'custom') {
    return assignByCustom(students, config);
  }

  return assignRandom(students, bucketCount);
};
