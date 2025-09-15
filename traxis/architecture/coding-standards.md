# Coding Standards
project: {ProjectName}  
version: 1.0  
last-updated: {YYYY-MM-DD}

## 1. Goals
- Maintain a **readable**, **predictable**, and **maintainable** codebase.
- Enforce **automation** (format, lint, tests, security).

## 2. Languages & Versions
- Backend: {Python 3.12}
- Frontend: {Next.js 14, React 18}
- Infra: {Docker 26, Compose v2, Traefik}

## 3. Environments & Tooling
- **Python venvs**: `uv` only.
- **Dev**: Docker Desktop.
- **Prod**: Remote Docker host via Portainer.
- **Containers**: all code ships in containers, see `infra/docker/`.

## 4. Formatting & Linting
- Python: `ruff format` + `ruff`.
- TypeScript: `prettier` + `eslint` with `typescript-eslint`.
- Rule: CI must pass format + lint.

## 5. Coding Conventions
- Python: type hints required, functions ≤ 50 lines, docstrings (Google/NumPy).
- TypeScript: `strict: true`, no `any`.
- React: functional components with hooks.
- Naming: snake_case (py), camelCase (TS), PascalCase (classes/types).

## 6. Tests
- Coverage target: 80% (min 70%).
- Pyramid: unit > integration > e2e.
- Tools: pytest / vitest / playwright.

## 7. Documentation
- Each module has a short README + examples.
- Major decisions recorded in ADRs under `docs/architecture/adrs/`.

## 8. Security
- Secrets via Vault/Doppler/1Password (never in repo).
- Dependencies scanned in CI.
- Protected branches with required checks.

## 9. Git & PRs
- Branches: `feature/<scope>-<slug>`, `fix/<slug>`, `chore/<slug>`.
- Commits: **Conventional Commits**.
- PRs: small (<400 LOC), clear description, checklist.

## 10. AI Policy
- **Mandatory**: PydanticAI for AI agents and AI-related code.
- Other AI libs must be justified in ADR + reviewed.