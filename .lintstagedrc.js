// functions/ has its own tsconfig and is excluded from the root ESLint config
// (see .eslintrc.js ignorePatterns), so it must be filtered out here too —
// otherwise ESLint emits an unavoidable "file ignored" warning that trips
// --max-warnings 0.
module.exports = {
  '*.{ts,tsx}': (filenames) => {
    const lintable = filenames.filter((f) => !f.includes('/functions/'));
    if (lintable.length === 0) return [];
    return [
      `eslint --fix --max-warnings 0 ${lintable.join(' ')}`,
      `prettier --write ${lintable.join(' ')}`,
    ];
  },
  '*.{js,json,md}': ['prettier --write'],
};
