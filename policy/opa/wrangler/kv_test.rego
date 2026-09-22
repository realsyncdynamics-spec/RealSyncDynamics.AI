package realsync.wrangler

import future.keywords.if

test_existing_frozen_bindings_allowed if {
	count({msg |
		deny[msg] with input as {
			"vars": {"WORKER_POLICY_ROUTES_DEPLOY_FROZEN": "true"},
			"kv_namespaces": [
				{"binding": "POLICY_CACHE", "id": "placeholder-1"},
				{"binding": "SESSION_CACHE", "id": "placeholder-2"},
			],
		}
	}) == 0
}

test_missing_freeze_var_denied if {
	deny[msg] with input as {
		"kv_namespaces": [
			{"binding": "POLICY_CACHE", "id": "placeholder-1"},
			{"binding": "SESSION_CACHE", "id": "placeholder-2"},
		],
	}
	msg == "wrangler kv_namespaces require vars.WORKER_POLICY_ROUTES_DEPLOY_FROZEN=\"true\""
}

test_extra_binding_denied if {
	deny[msg] with input as {
		"vars": {"WORKER_POLICY_ROUTES_DEPLOY_FROZEN": "true"},
		"kv_namespaces": [
			{"binding": "POLICY_CACHE", "id": "placeholder-1"},
			{"binding": "OTHER_CACHE", "id": "placeholder-3"},
		],
	}
	msg == "wrangler kv_namespaces binding \"OTHER_CACHE\" is not frozen; new KV namespaces are blocked"
}

test_service_role_secret_denied if {
	deny[msg] with input as {
		"secrets_store_secrets": [
			{"binding": "SERVICE_ROLE_SECRET", "secret_name": "LIVE_SERVICE_ROLE"},
		],
	}
	msg == "wrangler secrets_store_secrets secret_name \"LIVE_SERVICE_ROLE\" is forbidden"
}

test_jwt_secret_binding_denied if {
	deny[msg] with input as {
		"secrets_store_secrets": [
			{"binding": "EDGE_JWT_SECRET", "secret_name": "EDGE_RUNTIME"},
		],
	}
	msg == "wrangler secrets_store_secrets binding \"EDGE_JWT_SECRET\" is forbidden"
}
