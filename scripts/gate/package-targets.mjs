/** Every path a consumer can be routed to by the manifest. */
export function declaredTargets(pkg) {
  const targets = new Set();
  const add = (value) => {
    if (typeof value === 'string' && value.startsWith('.')) targets.add(value.replace(/^\.\//, ''));
  };
  const walk = (node) => {
    if (typeof node === 'string') return add(node);
    if (node && typeof node === 'object') for (const value of Object.values(node)) walk(value);
  };
  walk(pkg.exports);
  walk(pkg.imports);
  for (const field of ['main', 'module', 'types', 'typings']) add(pkg[field]);
  if (typeof pkg.bin === 'string') add(pkg.bin);
  else if (pkg.bin) for (const value of Object.values(pkg.bin)) add(value);
  return [...targets];
}

export function missingDeclaredTargets(pkg, files) {
  return declaredTargets(pkg).filter(target => !files.has(target));
}
