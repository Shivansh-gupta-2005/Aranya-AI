import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEXT_EXTENSIONS = new Set([
  '.css',
  '.csv',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.py',
  '.toml',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);
const ROOT_DIRECTORIES = ['.github', 'contracts', 'docs', 'ml', 'scripts', 'src'];
const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.venv',
  'coverage',
  'dist',
  'node_modules',
  'work',
]);

export function findNonAscii(content) {
  return content
    .split(/\r?\n/)
    .flatMap((line, index) =>
      [...line].some((character) => character.charCodeAt(0) > 127) ? [index + 1] : []
    );
}

function collectTextFiles(path) {
  if (statSync(path).isFile()) {
    return TEXT_EXTENSIONS.has(extname(path)) ? [path] : [];
  }
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) {
      return [];
    }
    return collectTextFiles(join(path, entry.name));
  });
}

export function checkRepository(root) {
  const rootFiles = ['CONTRIBUTING.md', 'README.md', 'index.html', 'package.json'];
  const paths = [
    ...rootFiles.map((file) => join(root, file)),
    ...ROOT_DIRECTORIES.map((directory) => join(root, directory)),
  ];
  return paths.flatMap((path) =>
    collectTextFiles(path).flatMap((file) =>
      findNonAscii(readFileSync(file, 'utf8')).map((line) => ({ file, line }))
    )
  );
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === currentFile) {
  const violations = checkRepository(process.cwd());
  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(`${violation.file}:${violation.line}: non-ASCII text`);
    }
    process.exitCode = 1;
  } else {
    console.log('Text style check passed.');
  }
}
