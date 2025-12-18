import markdown from '@eslint/markdown';

export default [
  {
    files: ['**/*.md'],
    plugins: {
      markdown,
    },
    language: 'markdown/commonmark',
    rules: {
      // Allow HTML elements that are commonly used in documentation
      'markdown/no-html': 'off',
      // Only check for empty links, not duplicate headings (common in API docs)
      'markdown/no-empty-links': 'error',
    },
  },
  {
    // Exclude third-party and auto-generated documentation from linting
    ignores: [
      'ios/Pods/**/*.md',
      'node_modules/**/*.md',
      'docs-markdown/**/*.md', // TypeDoc generated docs
      'android/build/**/*.md',
    ],
  },
];
