terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

variable "name_prefix" {
  type        = string
  default     = "dematic-maint"
  description = "Change this per app — everything else is reusable as-is"
}

variable "location" {
  type    = string
  default = "eastus"
}

variable "compute_location" {
  type        = string
  default     = "eastus2"
  description = "Where the Service Plan / Function App get created. Separate from var.location because eastus hit a 0-quota wall on this subscription — eastus2 is tried as an alternative region with (hopefully) available quota."
}

variable "tags" {
  type = map(string)
  default = {
    project    = "dematic-maintenance-app"
    managed_by = "terraform"
  }
}

module "api" {
  source           = "./modules/function-api"
  name_prefix      = var.name_prefix
  location         = var.location
  compute_location = var.compute_location
  tags             = var.tags
  # cors_allowed_origins set after first apply once the SWA hostname exists,
  # or left open initially and tightened in a second apply
}

module "frontend" {
  source              = "./modules/static-frontend"
  name_prefix         = var.name_prefix
  resource_group_name = module.api.resource_group_name
  function_app_id     = module.api.function_app_id
  tags                = var.tags
}

# ---------------------------------------------------------------------------
# App-specific data tables. Single-company version — no tenant partitioning.
# ---------------------------------------------------------------------------
resource "azurerm_storage_table" "fixes" {
  name                 = "fixlog"
  storage_account_name = module.api.storage_account_name
}

resource "azurerm_storage_table" "recurring_problems" {
  name                 = "recurringproblems"
  storage_account_name = module.api.storage_account_name
}

output "app_url" {
  value = module.frontend.url
}

output "function_app_name" {
  value = module.api.function_app_name
}

output "swa_deployment_token" {
  value     = module.frontend.deployment_token
  sensitive = true
}
