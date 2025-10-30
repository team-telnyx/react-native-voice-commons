# Local Static Analysis Guide

This project includes static code analysis that runs automatically on GitHub, but you can also run key checks locally.

## 🚀 Quick Commands

### Run Main Quality Checks

```bash
npm run quality:check
```

This runs: formatting check only (simplified and fast)

### Individual Checks

#### 1. Code Formatting (Prettier)

```bash
# Check formatting
npm run lint

# Auto-fix formatting issues
npm run lint:fix
```

#### 2. Security Audit

```bash
npm run security:check
```

### 🔧 Full CI-like Check

```bash
npm run ci:checks
```

This runs all checks that would run in GitHub Actions.

## 📋 What Each Check Does

- **Prettier**: Ensures consistent code formatting across all files
- **Security Audit**: Scans for known vulnerabilities in dependencies
- **GitHub Actions**: Additional ESLint and CodeQL analysis runs automatically on push/PR

## 🛠️ Fixing Issues

1. **Formatting issues**: Run `npm run lint:fix`
2. **Security issues**: Update vulnerable packages with `npm update`

## 💡 Pro Tips

- Run `npm run quality:check` before committing
- Use `npm run lint:fix` to auto-format your code
- GitHub Actions provides additional analysis (ESLint, CodeQL) automatically

## ✅ Current Status

**Working locally:**

- ✅ Prettier formatting check/fix
- ✅ Security audit

**GitHub Actions:**

- ✅ **Prettier**: All files (_.js, _.jsx, _.ts, _.tsx, _.json, _.md) - **BLOCKS merges if fails**
- ✅ **ESLint**: react-voice-commons-sdk/ directory (non-blocking)
- ✅ **Security audit**: Root + react-voice-commons-sdk projects
- ✅ **CodeQL**: All JavaScript/TypeScript files across entire repository

## 🚦 GitHub Actions Behavior

### Code Quality Workflow (`code-quality.yml`)

- 🎨 **Prettier**: Will block merges if formatting issues found
- 🔍 **ESLint**: Non-blocking, shows issues for awareness
- 🔒 **Security**: Non-blocking audit
- 🛡️ **CodeQL**: Security scanning
- 🔄 **Runs on**: Every push/PR to main/develop branches

### Key Benefits

- ✅ **Clean formatting enforced** - ensures consistent code style
- ✅ **Security monitoring** - catches vulnerabilities automatically
- ✅ **Simple and reliable** - focuses on what works well
- ✅ **Fast feedback** - quick checks, no long TypeScript compilation

## 🔧 Troubleshooting

### GitHub Actions: "Dependencies lock file is not found"

This error occurs because `package-lock.json` is in `.gitignore`. The workflow has been configured to use `npm install` instead of `npm ci` to handle this.

**If you see this error:**

1. The workflow should now use `npm install` (fixed)
2. Alternatively, you can remove `package-lock.json` from `.gitignore` and commit the lock file

### Local vs CI Differences

Since GitHub Actions uses `npm install` (not `npm ci`), there might be slight version differences between local and CI environments. This is generally not an issue for static analysis, but keep it in mind for reproducible builds.
