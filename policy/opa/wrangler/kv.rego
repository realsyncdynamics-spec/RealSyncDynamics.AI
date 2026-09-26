package realsync.wrangler

import future.keywords.contains
import future.keywords.if
import future.keywords.in

frozen_bindings := {"POLICY_CACHE", "SESSION_CACHE"}

deny contains msg if {
	some scope in manifest_scopes
	scope_name := scope.name
	manifest := scope.manifest
	some namespace in object.get(manifest, "kv_namespaces", [])
	binding := object.get(namespace, "binding", "")
	binding != ""
	not binding in frozen_bindings
	msg := sprintf("wrangler%s kv_namespaces binding %q is not frozen; new KV namespaces are blocked", [scope_suffix(scope_name), binding])
}

deny contains msg if {
	some scope in manifest_scopes
	scope_name := scope.name
	manifest := scope.manifest
	count(object.get(manifest, "kv_namespaces", [])) > 0
	freeze_flag(manifest) != "true"
	msg := sprintf("wrangler%s kv_namespaces require vars.WORKER_POLICY_ROUTES_DEPLOY_FROZEN=\"true\"", [scope_suffix(scope_name)])
}

deny contains msg if {
	some scope in manifest_scopes
	scope_name := scope.name
	manifest := scope.manifest
	some secret in object.get(manifest, "secrets_store_secrets", [])
	secret_name := object.get(secret, "secret_name", "")
	forbidden_secret_binding(secret_name)
	msg := sprintf("wrangler%s secrets_store_secrets secret_name %q is forbidden", [scope_suffix(scope_name), secret_name])
}

deny contains msg if {
	some scope in manifest_scopes
	scope_name := scope.name
	manifest := scope.manifest
	some secret in object.get(manifest, "secrets_store_secrets", [])
	binding := object.get(secret, "binding", "")
	forbidden_secret_binding(binding)
	msg := sprintf("wrangler%s secrets_store_secrets binding %q is forbidden", [scope_suffix(scope_name), binding])
}

forbidden_secret_binding(value) if {
	contains(upper(value), "SERVICE_ROLE")
}

forbidden_secret_binding(value) if {
	contains(upper(value), "JWT_SECRET")
}

manifest_scopes contains {"name": "root", "manifest": input}

manifest_scopes contains {"name": env_name, "manifest": env_manifest} if {
	some env_name, env_manifest in object.get(input, "env", {})
}

freeze_flag(manifest) := object.get(object.get(manifest, "vars", {}), "WORKER_POLICY_ROUTES_DEPLOY_FROZEN", root_freeze_flag)

root_freeze_flag := object.get(object.get(input, "vars", {}), "WORKER_POLICY_ROUTES_DEPLOY_FROZEN", "")

scope_suffix(name) := "" if {
	name == "root"
}

scope_suffix(name) := sprintf(" %s", [name]) if {
	name != "root"
}
