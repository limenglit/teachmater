// File type detection and constants for board uploads

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv'];
const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'webm'];
const CODE_EXTS = [
  'c', 'cpp', 'cc', 'h', 'hpp', 'cs', 'java', 'kt', 'scala',
  'py', 'rb', 'php', 'pl', 'pm', 'r',
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
  'html', 'htm', 'css', 'scss', 'sass', 'less',
  'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg',
  'sh', 'bash', 'zsh', 'bat', 'ps1', 'cmd',
  'sql', 'graphql', 'gql',
  'go', 'rs', 'swift', 'dart', 'lua', 'zig',
  'vue', 'svelte', 'astro',
  'md', 'markdown', 'tex', 'log',
];
const DOC_EXTS = ['doc', 'docx', 'pdf', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'txt', 'rtf', 'odt', 'ods', 'odp'];

export type BoardMediaCategory = 'image' | 'video' | 'audio' | 'code' | 'document';

export const ACCEPT_ALL_MEDIA = [
  'image/*',
  'video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska',
  'audio/*',
  '.mp3,.wav,.ogg,.aac,.m4a',
  '.doc,.docx,.pdf,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.rtf,.odt,.ods,.odp',
  '.c,.cpp,.cc,.h,.hpp,.cs,.java,.kt,.scala',
  '.py,.rb,.php,.pl,.r',
  '.js,.jsx,.ts,.tsx,.mjs,.cjs',
  '.html,.htm,.css,.scss,.sass,.less',
  '.json,.xml,.yaml,.yml,.toml,.ini,.cfg',
  '.sh,.bash,.bat,.ps1,.cmd',
  '.sql,.graphql,.gql',
  '.go,.rs,.swift,.dart,.lua,.zig',
  '.vue,.svelte,.astro',
  '.md,.markdown,.tex,.log',
].join(',');

export function getFileCategory(ext: string): BoardMediaCategory {
  const lower = ext.toLowerCase();
  if (IMAGE_EXTS.includes(lower)) return 'image';
  if (VIDEO_EXTS.includes(lower)) return 'video';
  if (AUDIO_EXTS.includes(lower)) return 'audio';
  if (CODE_EXTS.includes(lower)) return 'code';
  if (DOC_EXTS.includes(lower)) return 'document';
  return 'document';
}

export function getCardType(category: BoardMediaCategory): string {
  return category;
}

export function getFileExtFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split('.').pop()?.toLowerCase() || '';
    return ext;
  } catch {
    return '';
  }
}

export function getFileCategoryFromUrl(url: string): BoardMediaCategory {
  return getFileCategory(getFileExtFromUrl(url));
}

export function getFileNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return decodeURIComponent(pathname.split('/').pop() || 'file');
  } catch {
    return 'file';
  }
}

/** Human-readable label for document type icons */
export function getDocIcon(ext: string): string {
  const lower = ext.toLowerCase();
  if (lower === 'pdf') return '📄';
  if (['doc', 'docx', 'rtf', 'odt'].includes(lower)) return '📝';
  if (['xls', 'xlsx', 'csv', 'ods'].includes(lower)) return '📊';
  if (['ppt', 'pptx', 'odp'].includes(lower)) return '📽️';
  if (lower === 'txt') return '📃';
  return '📎';
}

/** Icon for code file types */
export function getCodeIcon(ext: string): string {
  const lower = ext.toLowerCase();
  if (['py'].includes(lower)) return '🐍';
  if (['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'].includes(lower)) return '⚡';
  if (['html', 'htm'].includes(lower)) return '🌐';
  if (['css', 'scss', 'sass', 'less'].includes(lower)) return '🎨';
  if (['c', 'cpp', 'cc', 'h', 'hpp'].includes(lower)) return '⚙️';
  if (['java', 'kt', 'scala'].includes(lower)) return '☕';
  if (['go'].includes(lower)) return '🔷';
  if (['rs'].includes(lower)) return '🦀';
  if (['rb'].includes(lower)) return '💎';
  if (['swift'].includes(lower)) return '🍎';
  if (['sh', 'bash', 'zsh', 'bat', 'ps1', 'cmd'].includes(lower)) return '🖥️';
  if (['sql'].includes(lower)) return '🗃️';
  if (['json', 'xml', 'yaml', 'yml', 'toml'].includes(lower)) return '📋';
  if (['md', 'markdown'].includes(lower)) return '📖';
  return '💻';
}

/** Get a display language label for code files */
export function getCodeLanguage(ext: string): string {
  const map: Record<string, string> = {
    c: 'C', cpp: 'C++', cc: 'C++', h: 'C/C++ Header', hpp: 'C++ Header',
    cs: 'C#', java: 'Java', kt: 'Kotlin', scala: 'Scala',
    py: 'Python', rb: 'Ruby', php: 'PHP', pl: 'Perl', r: 'R',
    js: 'JavaScript', jsx: 'JSX', ts: 'TypeScript', tsx: 'TSX', mjs: 'JavaScript', cjs: 'JavaScript',
    html: 'HTML', htm: 'HTML', css: 'CSS', scss: 'SCSS', sass: 'Sass', less: 'Less',
    json: 'JSON', xml: 'XML', yaml: 'YAML', yml: 'YAML', toml: 'TOML', ini: 'INI', cfg: 'Config',
    sh: 'Shell', bash: 'Bash', zsh: 'Zsh', bat: 'Batch', ps1: 'PowerShell', cmd: 'CMD',
    sql: 'SQL', graphql: 'GraphQL', gql: 'GraphQL',
    go: 'Go', rs: 'Rust', swift: 'Swift', dart: 'Dart', lua: 'Lua', zig: 'Zig',
    vue: 'Vue', svelte: 'Svelte', astro: 'Astro',
    md: 'Markdown', markdown: 'Markdown', tex: 'LaTeX', log: 'Log',
  };
  return map[ext.toLowerCase()] || ext.toUpperCase();
}
