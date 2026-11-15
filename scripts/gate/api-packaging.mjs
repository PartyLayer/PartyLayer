/** Consumer-visible package metadata watched by the API regression gate. */
const PACKAGING_FIELDS = [
  'name', 'main', 'module', 'types', 'exports', 'imports', 'bin',
  'peerDependencies', 'peerDependenciesMeta',
];

function stableSort(value) {
  if (Array.isArray(value)) return value.map(stableSort);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableSort(value[key])]));
  }
  return value;
}

export function packagingSnapshot(pkgJson) {
  const picked = {};
  for (const field of [...PACKAGING_FIELDS].sort()) {
    if (pkgJson[field] === undefined) continue;
    // Node tests conditional exports/imports in source key order. For example,
    // moving `default` before `import` changes which target consumers receive.
    // Preserve these trees recursively; ordinary metadata maps remain sorted.
    picked[field] = field === 'exports' || field === 'imports' ? pkgJson[field] : stableSort(pkgJson[field]);
  }
  return JSON.stringify(picked, null, 2) + '\n';
}
