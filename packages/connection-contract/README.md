# @realsync/connection-contract

OpenAPI Discovery for the Universal Connection Contract.

Discovery only. This package does **not** call customer APIs, store secrets,
or write to Postgres.

Defaults: GET=read/allow, POST/PUT/PATCH=write/approval, DELETE=delete/deny.
