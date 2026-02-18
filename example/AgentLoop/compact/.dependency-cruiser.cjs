/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'core-must-not-depend-on-infrastructure',
      comment: 'Core layer must not import from infrastructure layer',
      severity: 'error',
      from: { path: '^src/core/' },
      to: { path: '^src/infrastructure/' },
    },
    {
      name: 'core-must-not-depend-on-anthropic-sdk',
      comment: 'Core layer must not import framework-specific packages',
      severity: 'error',
      from: { path: '^src/core/' },
      to: { path: 'node_modules/@anthropic-ai' },
    },
    {
      name: 'core-must-not-use-node-fs',
      comment: 'Core layer must not perform file IO directly',
      severity: 'error',
      from: { path: '^src/core/' },
      to: { path: '^node:fs' },
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
