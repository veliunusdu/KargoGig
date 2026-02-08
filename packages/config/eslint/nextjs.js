module.exports = {
  extends: [
    './base.js',
    'next/core-web-vitals',
  ],
  env: {
    browser: true,
  },
  rules: {
    'react/no-unescaped-entities': 'off',
    '@next/next/no-html-link-for-pages': 'off',
  },
};
