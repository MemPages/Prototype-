# API
All responses include `x-request-id`. Errors: `{"error":{"code","message","requestId"}}` (400 invalid_request/invalid_json/invalid_id/invalid_query, 404 not_found, 413 payload_too_large, 429 rate_limited, 500 internal_error).
- `POST /api/chat` `{sessionId?, message (1-1000), language: "en"|"ar"}` → `{sessionId, message, decision{type,urgency,recommended_action,specialty,reason,questions,sources,confidence,disclaimer}, emergency, demoData, recommendations{doctors,hospitals}, toolCalls[{name,ok,resultCount,ms}], suggestedReplies, requestId}`
- `GET /api/doctors?specialty&city&language`, `GET /api/doctors/:id` (`DOC-###`)
- `GET /api/hospitals?specialty&city`, `GET /api/hospitals/:id` (`HOSP-###`)
- `GET /api/specialties`, `GET /api/health`
Auth: none in the prototype. Production: OIDC/JWT, per-user rate limits, session ownership checks, audit logging.
