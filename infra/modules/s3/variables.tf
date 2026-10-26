variable "project_name" {
  type    = string
  default = "smartcity-pulse"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "tags" {
  type    = map(string)
  default = {}
}

