const EXT_TO_PRISM: Record<string, string> = {
  c: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  java: 'java',
  kt: 'kotlin',
  scala: 'scala',
  py: 'python',
  rb: 'ruby',
  php: 'php',
  pl: 'perl',
  r: 'r',
  js: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  tsx: 'tsx',
  mjs: 'javascript',
  cjs: 'javascript',
  html: 'markup',
  htm: 'markup',
  xml: 'markup',
  svg: 'markup',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  ini: 'ini',
  cfg: 'ini',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  bat: 'batch',
  ps1: 'powershell',
  cmd: 'batch',
  sql: 'sql',
  graphql: 'graphql',
  gql: 'graphql',
  go: 'go',
  rs: 'rust',
  swift: 'swift',
  dart: 'dart',
  lua: 'lua',
  zig: 'zig',
  vue: 'markup',
  svelte: 'markup',
  astro: 'markup',
  md: 'markdown',
  markdown: 'markdown',
  tex: 'latex',
};

const LANG_DEPS: Record<string, string[]> = {
  c: ['clike'],
  cpp: ['c'],
  csharp: ['clike'],
  java: ['clike'],
  kotlin: ['java'],
  scala: ['java'],
  php: ['markup-templating'],
  jsx: ['markup', 'javascript'],
  typescript: ['javascript'],
  tsx: ['jsx', 'typescript'],
  scss: ['css'],
  sass: ['css'],
  less: ['css'],
  markdown: ['markup'],
};

const PRISM_LANGUAGE_LOADERS: Record<string, () => Promise<unknown>> = {
  c: () => import('prismjs/components/prism-c.js'),
  cpp: () => import('prismjs/components/prism-cpp.js'),
  csharp: () => import('prismjs/components/prism-csharp.js'),
  java: () => import('prismjs/components/prism-java.js'),
  kotlin: () => import('prismjs/components/prism-kotlin.js'),
  scala: () => import('prismjs/components/prism-scala.js'),
  python: () => import('prismjs/components/prism-python.js'),
  ruby: () => import('prismjs/components/prism-ruby.js'),
  perl: () => import('prismjs/components/prism-perl.js'),
  php: () => import('prismjs/components/prism-php.js'),
  r: () => import('prismjs/components/prism-r.js'),
  jsx: () => import('prismjs/components/prism-jsx.js'),
  typescript: () => import('prismjs/components/prism-typescript.js'),
  tsx: () => import('prismjs/components/prism-tsx.js'),
  scss: () => import('prismjs/components/prism-scss.js'),
  sass: () => import('prismjs/components/prism-sass.js'),
  less: () => import('prismjs/components/prism-less.js'),
  json: () => import('prismjs/components/prism-json.js'),
  yaml: () => import('prismjs/components/prism-yaml.js'),
  toml: () => import('prismjs/components/prism-toml.js'),
  ini: () => import('prismjs/components/prism-ini.js'),
  bash: () => import('prismjs/components/prism-bash.js'),
  batch: () => import('prismjs/components/prism-batch.js'),
  powershell: () => import('prismjs/components/prism-powershell.js'),
  sql: () => import('prismjs/components/prism-sql.js'),
  graphql: () => import('prismjs/components/prism-graphql.js'),
  go: () => import('prismjs/components/prism-go.js'),
  rust: () => import('prismjs/components/prism-rust.js'),
  swift: () => import('prismjs/components/prism-swift.js'),
  dart: () => import('prismjs/components/prism-dart.js'),
  lua: () => import('prismjs/components/prism-lua.js'),
  zig: () => import('prismjs/components/prism-zig.js'),
  markdown: () => import('prismjs/components/prism-markdown.js'),
  latex: () => import('prismjs/components/prism-latex.js'),
  'markup-templating': () => import('prismjs/components/prism-markup-templating.js'),
};

const loadedLanguages = new Set(['plain', 'markup', 'css', 'clike', 'javascript']);

export function getPrismLanguage(ext: string): string {
  return EXT_TO_PRISM[ext.toLowerCase()] || 'plain';
}

export async function loadPrismLanguage(lang: string, visited = new Set<string>()) {
  if (loadedLanguages.has(lang) || visited.has(lang)) return;

  visited.add(lang);

  const deps = LANG_DEPS[lang] ?? [];
  for (const dep of deps) {
    await loadPrismLanguage(dep, visited);
  }

  const loader = PRISM_LANGUAGE_LOADERS[lang];
  if (!loader) {
    loadedLanguages.add(lang);
    return;
  }

  try {
    await loader();
    loadedLanguages.add(lang);
  } catch {
    // noop
  }
}