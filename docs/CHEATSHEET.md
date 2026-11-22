# Cheatsheet

## Daily

| Command             | Does                                                  |
| ------------------- | ----------------------------------------------------- |
| `npm run dev`       | Dev server on :4321                                   |
| `npm run check`     | Lint + format + types + data integrity (what CI runs) |
| `npm run build`     | Static build to `dist/`                               |
| `npm run preview`   | Serve `dist/` locally                                 |
| `npm run format`    | Prettier, write                                       |
| `npm run lint:fix`  | ESLint, autofix                                       |
| `npm run typecheck` | `astro check`                                         |

## Data

| Command                | Does                                                  |
| ---------------------- | ----------------------------------------------------- |
| `npm run verify:data`  | Fail if any listing lacks a source or `last_verified` |
| `npm run verify:stale` | Also list listings verified more than ~6 months ago   |

## Git

```bash
git checkout develop && git pull
git checkout -b feature/farms-directory
# work, commit (hook runs lint/format/verify/audit)
git push -u origin feature/farms-directory
gh pr create --base develop --fill
```

Squash-merge into `develop` → staging deploy + Lighthouse. Promote `develop` → `main` for
production.

## Security spot checks

```bash
# Headers actually served
curl -sI https://longislandoysterfarm.com/ | grep -iE 'content-security|strict-transport|x-content-type|referrer|permissions'

# www redirects to apex
curl -sI https://www.longislandoysterfarm.com/ | head -3

# No inline style/script in the build (CSP has no unsafe-inline)
npm run build && grep -rn '<style>' dist || echo clean
```

## Deploys

Cloudflare Pages builds from git on its own (`main` → production, `develop` → staging
preview). There is no deploy command and no deploy token. To roll back: Cloudflare dashboard →
the project → **Deployments** → last good one → **Rollback**, then fix forward in git.
