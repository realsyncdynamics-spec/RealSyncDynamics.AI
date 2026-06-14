# DS-Record-Daten für den Registrar (siehe README.md, Abschnitt "DNSSEC").
output "dnssec_ds_record" {
  description = "Vollständiger DS-Record-String, wie er beim Registrar hinterlegt werden muss."
  value       = cloudflare_zone_dnssec.dnssec.ds_record
}

output "dnssec_status" {
  description = "DNSSEC-Status der Zone (z. B. 'pending' oder 'active')."
  value       = cloudflare_zone_dnssec.dnssec.status
}

output "dnssec_key_tag" {
  value = cloudflare_zone_dnssec.dnssec.key_tag
}

output "dnssec_algorithm" {
  value = cloudflare_zone_dnssec.dnssec.algorithm
}

output "dnssec_digest_type" {
  value = cloudflare_zone_dnssec.dnssec.digest_type
}

output "dnssec_digest" {
  value = cloudflare_zone_dnssec.dnssec.digest
}
