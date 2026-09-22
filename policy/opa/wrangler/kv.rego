package realsync.wrangler

import future.keywords.contains
import future.keywords.if
import future.keywords.in

frozen_bindings := {"POLICY_CACHE", "SESSION_CACHE"}

deny contains msg if {
	some namespace in object.get(input, "kv_namespaces", [])
	binding := object.get(namespace, "binding", "")
	binding != ""
	not binding in frozen_bindings
	msg := sprintf("wrangler kv_namespaces binding %q is not frozen; new KV namespaces are blocked", [binding])
}

deny contains msg if {
	count(object.get(input, "kv_namespaces", [])) > 0
	object.get(object.get(input, "vars", {}), "WORKER_POLICY_ROUTES_DEPLOY_FROZEN", "") != "true"
	msg := "wrangler kv_namespaces require vars.WORKER_POLICY_ROUTES_DEPLOY_FROZEN=\"true\""
}

deny contains msg if {
	some secret in object.get(input, "secrets_store_secrets", [])
	secret_name := object.get(secret, "secret_name", "")
	forbidden_secret_binding(secret_name)
	msg := sprintf("wrangler secrets_store_secrets secret_name %q is forbidden", [secret_name])
}

deny contains msg if {
	some secret in object.get(input, "secrets_store_secrets", [])
	binding := object.get(secret, "binding", "")
	forbidden_secret_binding(binding)
	msg := sprintf("wrangler secrets_store_secrets binding %q is forbidden", [binding])
}

forbidden_secret_binding(value) if {
	contains(upper(value), "SERVICE_ROLE")
}

forbidden_secret_binding(value) if {
	contains(upper(value), "JWT_SECRET")
}
