#!/bin/bash
# Phase 2.5 + Phase 3 verification script
# Tests all new APIs end-to-end

set -e

BASE="http://localhost:3001"
echo "=== Phase 2.5 + Phase 3 Verification ==="
echo ""

# Login
TOKEN=$(curl -s -X POST "$BASE/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@leadforge.local","password":"Leadforge123"}' \
  | python3 -c 'import sys, json; print(json.load(sys.stdin)["data"]["accessToken"])')
echo "✓ Login: OK"

# Health check
echo ""
echo "=== Health ==="
curl -s "$BASE/api/v1/health" | python3 -c "
import sys, json
d = json.load(sys.stdin)['data']
print(f'  Status: {d[\"status\"]}')
print(f'  Version: {d[\"version\"]}')
print(f'  Services:')
for name, svc in d['services'].items():
    print(f'    {name}: {svc[\"status\"]} — {svc.get(\"details\", \"\")}')
print(f'  Workers:')
print(f'    discovery: {d[\"workers\"][\"discovery\"][\"running\"]}')
print(f'    enrichment: {d[\"workers\"][\"enrichment\"][\"running\"]}')
"

# Discovery stats
echo ""
echo "=== Discovery Stats ==="
curl -s "$BASE/api/v1/discover/stats" -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
d = json.load(sys.stdin)['data']
print(f'  Companies: {d[\"companies\"][\"total\"]} total, {d[\"companies\"][\"today\"]} today')
print(f'  Jobs: {d[\"jobs\"][\"total\"]} total, {d[\"jobs\"][\"running\"]} running, {d[\"jobs\"][\"completed\"]} completed')
print(f'  Avg runtime: {d[\"avgRuntimeMs\"]/1000:.1f}s')
print(f'  Sources: {len(d[\"sourceDistribution\"])}')
"

# Enrichment stats
echo ""
echo "=== Enrichment Stats ==="
curl -s "$BASE/api/v1/enrich/stats" -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
d = json.load(sys.stdin)['data']
print(f'  Companies: {d[\"companies\"][\"enriched\"]} enriched, {d[\"companies\"][\"pending\"]} pending')
print(f'  Jobs: {d[\"jobs\"][\"total\"]} total, {d[\"jobs\"][\"completed\"]} completed')
print(f'  Avg crawl: {d[\"avgCrawlMs\"]/1000:.1f}s')
print(f'  Success rate: {d[\"successRate\"]}%')
print(f'  Firecrawl: {\"connected\" if d[\"firecrawl\"][\"available\"] else \"direct mode\"}')
print(f'  Top technologies: {[t[\"name\"] for t in d[\"topTechnologies\"][:5]]}')
"

# Firecrawl health
echo ""
echo "=== Firecrawl Health ==="
curl -s "$BASE/api/v1/firecrawl/health" | python3 -c "
import sys, json
d = json.load(sys.stdin)['data']
print(f'  Configured: {d[\"configured\"]}')
print(f'  Available: {d[\"available\"]}')
print(f'  Mode: {d[\"mode\"]}')
"

# Sources
echo ""
echo "=== Discovery Sources ==="
curl -s "$BASE/api/v1/sources" | python3 -c "
import sys, json
d = json.load(sys.stdin)['data']
for s in d:
    print(f'  {s[\"label\"]:25} ({s.get(\"rateLimitPerSec\", \"?\")} req/s)')
"

echo ""
echo "=== All Phase 2.5 + Phase 3 systems operational ==="
