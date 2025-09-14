# Tech Stack
project: {ProjectName}  
version: 1.0  
last-updated: {YYYY-MM-DD}

## 1. Overview
- Domain: {AI chatbot | portal | back-office}
- Environments: dev (Docker Desktop), staging/prod (remote Docker host via Portainer)

## 2. Frontend
- Framework: Next.js 14 (App Router)
- UI: Tailwind, shadcn/ui
- State/Data: React Query or Zustand
- Validation: Zod + React Hook Form

## 3. Backend / API
- Runtime: FastAPI (Python) or NestJS (Node)
- Auth: Keycloak or Auth.js
- Background jobs: Celery or BullMQ
- Observability: OpenTelemetry, Prometheus, Grafana

## 4. Data Layer
- DB: PostgreSQL 16
- Cache: Redis
- Vectors: Qdrant
- Object storage: MinIO or S3

## 5. AI
- Framework: **PydanticAI (mandatory)**
- Inference: vLLM, Ollama, or OpenAI API
- RAG: LiteLLM + Qdrant + embeddings
- Orchestration: n8n or MCP services

## 6. Infrastructure & Deployment
- Containers: Docker / Compose
- Directory: `infra/docker/` for Dockerfiles, compose.dev/prod.yml, Portainer stacks
- Networking: Traefik reverse proxy (TLS via ACME or internal CA)
- CI/CD: GitHub Actions or GitLab CI, deploy to Portainer
- Secrets: Vault / Doppler

## 7. Security & Compliance
- MFA on Portainer
- Signed images (cosign optional)
- Backups: pg_dump + offsite; restores tested monthly

## 8. ADRs
- ADR-0001: PydanticAI as mandatory AI framework
- ADR-0002: Example: Choose FastAPI over Django

## 9. References
- Next.js docs: https://nextjs.org/docs
- FastAPI docs: https://fastapi.tiangolo.com/
- PydanticAI: https://docs.pydantic.dev/latest/concepts/pydantic_ai/
- Portainer: https://docs.portainer.io/
