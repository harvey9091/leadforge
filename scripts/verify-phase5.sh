#!/bin/bash
# Phase 5 verification
TOKEN=$(curl -s -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@leadforge.local","password":"Leadforge123"}' \
  | python3 -c 'import sys, json; print(json.load(sys.stdin)["data"]["accessToken"])')
echo "Login: OK"

echo ""
echo "=== Search ==="
curl -s "http://localhost:3000/api/v1/companies/search?q=ai&page=1&pageSize=5" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
data = d.get('data', d)
total = data.get('pagination', {}).get('total', 0)
print(f'  Results: {total}')
for c in data.get('data', [])[:3]:
    print(f'  - {c[\"name\"]} ({c.get(\"domain\", \"-\")})')
"

echo ""
echo "=== Analytics ==="
curl -s "http://localhost:3000/api/v1/workspace/analytics" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
data = d.get('data', d)
print(f'  Total companies: {data.get(\"totalCompanies\", 0)}')
print(f'  Industries: {len(data.get(\"industries\", []))}')
print(f'  Technologies: {len(data.get(\"technologies\", []))}')
print(f'  Avg confidence: {data.get(\"avgConfidence\", 0):.0f}%')
"

echo ""
echo "=== Collections ==="
curl -s "http://localhost:3000/api/v1/workspace/collections" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  Collections: {len(d.get(\"data\", []))}')
"

echo ""
echo "=== Export Preview ==="
curl -s -X POST "http://localhost:3000/api/v1/workspace/exports" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"format":"csv","preview":true}' | python3 -c "
import sys, json
d = json.load(sys.stdin)
data = d.get('data', d)
preview = data.get('preview', {})
print(f'  Preview rows: {preview.get(\"totalRows\", 0)}')
print(f'  Est size: {preview.get(\"estimatedSizeBytes\", 0)} bytes')
print(f'  Warnings: {preview.get(\"warnings\", [])}')
"

echo ""
echo "=== Bulk Actions (pin) ==="
curl -s -X POST "http://localhost:3000/api/v1/workspace/bulk" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"action":"pin","companyIds":["cmrfmvuhh004bswyne2i0yu4j"]}' | python3 -c "
import sys, json
d = json.load(sys.stdin)
data = d.get('data', d)
print(f'  Action: {data.get(\"action\")}')
print(f'  Affected: {data.get(\"affected\", 0)}')
print(f'  Message: {data.get(\"message\", \"\")}')
"

echo ""
echo "=== Health ==="
curl -s "http://localhost:3000/api/v1/health" | python3 -c "
import sys, json
d = json.load(sys.stdin)
data = d.get('data', d)
print(f'  Status: {data.get(\"status\")}')
print(f'  Version: {data.get(\"version\")}')
services = data.get('services', {})
for name, svc in services.items():
    print(f'  {name}: {svc[\"status\"]}')
"
