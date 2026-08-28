# modules/function-api
#
# Reusable baseline for any Node/Python/etc Function App backend:
# resource group + storage account + consumption plan + function app.
# No provider block here on purpose — the caller's root module owns that,
# so this module works against ANY subscription it's pointed at.

variable "name_prefix" {
  type        = string
  description = "Short, unique prefix for this app, e.g. 'dematic-maint'. Used to name every resource."
}

variable "resource_group_name" {
  type    = string
  default = null # if null, this module creates its own RG
}

variable "location" {
  type    = string
  default = "eastus"
}

variable "runtime_stack" {
  type        = string
  default     = "node"
  description = "node, python, dotnet, java, etc — passed to application_stack"
}

variable "runtime_version" {
  type    = string
  default = "20"
}

variable "sku_name" {
  type        = string
  default     = "Y1" # consumption plan; use "EP1"+ for premium/VNet-integrated
  description = "Function App service plan SKU"
}

variable "tags" {
  type    = map(string)
  default = {}
}

variable "compute_location" {
  type        = string
  default     = null
  description = "Region for the Service Plan / Function App specifically. Defaults to var.location. Override this if your subscription has a compute quota block in the main region — resources in one resource group don't have to share a region."
}

variable "cors_allowed_origins" {
  type        = list(string)
  default     = []
  description = "Pass the frontend's URL(s) here once known, or leave empty and set later"
}

locals {
  compute_location = var.compute_location != null ? var.compute_location : local.location
}

resource "azurerm_resource_group" "this" {
  count    = var.resource_group_name == null ? 1 : 0
  name     = "rg-${var.name_prefix}"
  location = var.location
  tags     = var.tags
}

locals {
  resource_group_name = var.resource_group_name != null ? var.resource_group_name : azurerm_resource_group.this[0].name
  location             = var.location
}

resource "azurerm_storage_account" "this" {
  # storage account names: lowercase, no dashes, <=24 chars, globally unique
  name                     = substr(replace("${var.name_prefix}st", "-", ""), 0, 24)
  resource_group_name      = local.resource_group_name
  location                 = local.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  tags                     = var.tags
}

resource "azurerm_service_plan" "this" {
  name                = "${var.name_prefix}-plan"
  resource_group_name = local.resource_group_name
  location             = local.compute_location
  os_type             = "Linux"
  sku_name            = var.sku_name
  tags                = var.tags
}

resource "azurerm_linux_function_app" "this" {
  name                = "${var.name_prefix}-func"
  resource_group_name = local.resource_group_name
  location             = local.compute_location

  storage_account_name       = azurerm_storage_account.this.name
  storage_account_access_key = azurerm_storage_account.this.primary_access_key
  service_plan_id             = azurerm_service_plan.this.id

  site_config {
    application_stack {
      node_version = var.runtime_stack == "node" ? var.runtime_version : null
      # add other language blocks here as needed (python_version, dotnet_version, etc)
    }
    dynamic "cors" {
      for_each = length(var.cors_allowed_origins) > 0 ? [1] : []
      content {
        allowed_origins = var.cors_allowed_origins
      }
    }
  }

  app_settings = {
    "FUNCTIONS_WORKER_RUNTIME" = var.runtime_stack
  }

  tags = var.tags
}

output "function_app_id" {
  value = azurerm_linux_function_app.this.id
}

output "function_app_name" {
  value = azurerm_linux_function_app.this.name
}

output "function_app_default_hostname" {
  value = azurerm_linux_function_app.this.default_hostname
}

output "storage_account_name" {
  value = azurerm_storage_account.this.name
}

output "storage_account_id" {
  value = azurerm_storage_account.this.id
}

output "resource_group_name" {
  value = local.resource_group_name
}
