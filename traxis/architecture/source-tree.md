# Source Tree
project: {ProjectName}  
version: 1.0  
last-updated: {YYYY-MM-DD}

## 1. Layout
repo/
├─ apps/
│ ├─ web/ # Frontend (Next.js)
│ └─ api/ # Backend (FastAPI/NestJS)
├─ packages/
│ ├─ ui/ # Design system (shadcn/ui wrappers)
│ ├─ config/ # Shared configs (eslint, tsconfig, ruff, prettier)
│ └─ utils/ # Shared helpers
├─ infra/
│ ├─ docker/ # Dockerfiles, compose.dev.yml, compose.prod.yml, Portainer stacks
│ ├─ traefik/ # Traefik configs (optional)
│ └─ k8s/ # Kubernetes manifests (optional)
├─ docs/
│ ├─ architecture/
│ │ ├─ coding-standards.md
│ │ ├─ tech-stack.md
│ │ ├─ source-tree.md
│ │ └─ adrs/
│ │ └─ ADR-0001-…md
│ └─ runbooks/
├─ tests/
│ ├─ e2e/
│ └─ integration/
├─ .github/workflows/ # CI pipelines
└─ tools/ # DevOps scripts


## 2. Placement Rules
- Runtime code in `apps/*`, shared libs in `packages/*`.
- All containerization assets in `infra/docker/`.
- Documentation + ADRs in `docs/architecture/`.

## 3. Dev vs Prod
- Dev: Docker Desktop (`compose.dev.yml`)
- Prod: Remote Docker host via Portainer (`compose.prod.yml` / Portainer stack)

## 4. Backend Structure
apps/api/src/
├─ auth/
├─ users/
├─ tickets/
├─ ai/ # PydanticAI agents
├─ common/ # middlewares, DTOs, exceptions
└─ infra/ # adapters (db, cache, queue)


## 5. AI
- AI code must live in `apps/api/src/ai/` and use **PydanticAI**.
- Other AI libs require ADR + approval.

## 6. Tests
- Mirror source tree; shared utils in `tests/_shared`.

## 7. Automation
- `tools/new-<resource>.py` scaffolds new features (service, tests, ADR, Dockerfile).
