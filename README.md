# ASRS Maintenance Log

Problem/fix logging app built for an automated storage & retrieval (ASRS) maintenance department. Technicians log recurring problems, mark them fixed, and resolved entries move to a timestamped fix log. Demoed to plant and department leadership, Aug 2026.

**Live:** https://yellow-beach-0aef1580f.7.azurestaticapps.net

## Architecture
browser → Azure Static Web App → /api/* → Azure Function App → Azure Storage

- **Frontend:** React (Vite) + Tailwind CSS v4 on Azure Static Web Apps (Standard)
- **API:** Azure Functions (Node.js), Linux Consumption (Y1), linked as a bring-your-own backend. GET / POST / DELETE (`api/src/functions/entries.js`)
- **Data:** Azure Storage
- **Infrastructure:** Terraform, modular (`infra/modules/function-api`)

## Deploy infrastructure

    cd infra
    terraform init
    terraform plan
    terraform apply

State is kept local and excluded from the repo.

## Problems solved during the build
- New subscriptions start at 0 App Service quota; Y1 Function App deploys fail until an increase is approved
- The SWA Free tier can't link a BYO Function App, so Standard is required
- A Tailwind v4 styling failure traced to project structure, not config: the component sat outside `src/` and wasn't imported by `main.jsx`
- A resolved-problem → fix-log transfer failed because the frontend ran on in-memory state; fixed by wiring it to the API, adding a DELETE endpoint, and setting the storage connection string

## Roadmap
- Move app settings (storage connection string) into Terraform
- Remote Terraform state backend
- CI/CD pipeline for plan/apply
- Role-restricted write access
