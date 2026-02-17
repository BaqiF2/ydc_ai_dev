/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'core-must-not-depend-on-infrastructure',
      comment: 'Core layer must not import from infrastructure layer (dependency inversion)',
      severity: 'error',
      from: { path: '^src/core/' },
      to: { path: '^src/infrastructure/' },
    },
    {
      name: 'core-must-not-import-node-fs',
      comment: 'Core layer must not import Node.js fs module directly',
      severity: 'error',
      from: { path: '^src/core/' },
      to: { path: '^node:fs' },
    },
    {
      name: 'core-must-not-import-node-path',
      comment: 'Core layer must not import Node.js path module directly',
      severity: 'error',
      from: { path: '^src/core/' },
      to: { path: '^node:path' },
    },
    {
      name: 'no-circular-dependencies',
      comment: 'Circular dependencies are not allowed',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json',
    },
  },
};
