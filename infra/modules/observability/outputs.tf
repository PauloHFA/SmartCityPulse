output "dashboard_name" {
  value = aws_cloudwatch_dashboard.operational_dashboard.dashboard_name
}

output "log_groups" {
  value = [for lg in aws_cloudwatch_log_group.services_logs : lg.name]
}
