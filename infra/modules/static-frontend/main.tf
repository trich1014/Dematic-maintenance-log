# modules/static-frontend
#
# Reusable Static Web App + linked Function App backend.
# Swap this module out for a different one (e.g. blob+cdn static hosting,
# like the beat store) when a project needs a different frontend pattern.

variable "name_prefix" {
  type = string
}

variable "resource_group_name" {
  type = string
}

variable "location" {
  type        = string
  default     = "eastus2"
  description = "SWA only deploys to a limited region list — check current list before changing"
}

variable "function_app_id" {
  type        = string
  description = "ID of the Function App to link as this SWA's managed backend"
}

variable "sku_tier" {
  type    = string
  default = "Free" # "Standard" needed for custom auth roles, staging environments
}

variable "tags" {
  type    = map(string)
  default = {}
}

resource "azurerm_static_web_app" "this" {
  name                = "${var.name_prefix}-swa"
  resource_group_name = var.resource_group_name
  location             = var.location
  sku_tier            = var.sku_tier
  sku_size            = var.sku_tier
  tags                = var.tags
}

resource "azurerm_static_web_app_function_app_registration" "link" {
  static_web_app_id = azurerm_static_web_app.this.id
  function_app_id   = var.function_app_id
}

output "url" {
  value = "https://${azurerm_static_web_app.this.default_host_name}"
}

output "deployment_token" {
  value     = azurerm_static_web_app.this.api_key
  sensitive = true
}

output "id" {
  value = azurerm_static_web_app.this.id
}
