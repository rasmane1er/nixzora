terraform {
  required_version = ">= 1.10.0"
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "~> 6.14"
      configuration_aliases = [aws.us_east_1, aws.backup_copy]
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
  }
}
