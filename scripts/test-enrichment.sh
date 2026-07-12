#!/bin/bash
# Test enrichment job creation
TOKEN=$(curl -s -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@leadforge.local","password":"Leadforge123"}' \
  | python3 -c 'import sys, json; print(json.load(sys.stdin)["data"]["accessToken"])')

echo "Token: ${TOKEN:0:20}..."

echo "Creating enrichment job..."
RESPONSE=$(curl -s -X POST "http://localhost:3000/api/v1/enrich/jobs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"companyId":"cmrfmvuhh004bswyne2i0yu4j"}')

echo "$RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
job = d.get('data', {}).get('job', {})
print(f'Job: {job.get(\"id\", \"?\")} status: {job.get(\"status\", \"?\")}')
"
