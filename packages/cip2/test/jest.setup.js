/* eslint-disable unicorn/prefer-module */
/* eslint-disable @typescript-eslint/no-var-requires */
const { testTimeout } = require('../jest.config');
require('fast-check').configureGlobal({
  interruptAfterTimeLimit: testTimeout * 0.7,
  numRuns: testTimeout / 50,
  markInterruptAsFailure: true
});
