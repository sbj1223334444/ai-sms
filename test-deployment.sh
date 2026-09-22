#!/bin/bash

echo "=================================="
echo "AI SMS - Deployment Test"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check if server is running
echo -n "✓ Testing server on port 3000... "
if curl -s http://localhost:3000 > /dev/null; then
    echo -e "${GREEN}PASSED${NC}"
else
    echo -e "${RED}FAILED${NC}"
    exit 1
fi

# Test 2: Check title branding
echo -n "✓ Testing Air India branding... "
TITLE=$(curl -s http://localhost:3000 | grep -o "<title>.*</title>")
if echo "$TITLE" | grep -q "AI SMS"; then
    echo -e "${GREEN}PASSED${NC} - $TITLE"
else
    echo -e "${RED}FAILED${NC}"
    exit 1
fi

# Test 3: Check signin page
echo -n "✓ Testing signin page... "
if curl -s http://localhost:3000/signin | grep -q "AI SMS"; then
    echo -e "${GREEN}PASSED${NC}"
else
    echo -e "${RED}FAILED${NC}"
    exit 1
fi

# Test 4: Check API endpoints
echo -n "✓ Testing API authentication... "
API_RESPONSE=$(curl -s http://localhost:3000/api/forms)
if echo "$API_RESPONSE" | grep -q "Sign in required"; then
    echo -e "${GREEN}PASSED${NC} - Auth working"
else
    echo -e "${RED}FAILED${NC}"
    exit 1
fi

# Test 5: Check static assets
echo -n "✓ Testing logo assets... "
if [ -f "public/logo.svg" ] && [ -f "public/favicon.svg" ]; then
    echo -e "${GREEN}PASSED${NC}"
else
    echo -e "${RED}FAILED${NC}"
    exit 1
fi

# Test 6: Check configuration files
echo -n "✓ Testing configuration files... "
if [ -f "config/forms/occurrence-report.json" ]; then
    if grep -q "Air India" config/forms/occurrence-report.json; then
        echo -e "${GREEN}PASSED${NC} - Operator defaults set"
    else
        echo -e "${YELLOW}WARNING${NC} - Operator defaults missing"
    fi
else
    echo -e "${RED}FAILED${NC}"
    exit 1
fi

# Test 7: Check demo users
echo -n "✓ Testing demo credentials... "
if grep -q "airindia2026" src/lib/demo-users.ts; then
    if grep -q "@airindia.com" src/lib/demo-users.ts; then
        echo -e "${GREEN}PASSED${NC} - Demo users configured"
    else
        echo -e "${RED}FAILED${NC} - Email domains wrong"
        exit 1
    fi
else
    echo -e "${RED}FAILED${NC} - Password not set"
    exit 1
fi

echo ""
echo "=================================="
echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
echo "=================================="
echo ""
echo "Application is running at: http://localhost:3000"
echo ""
echo "Demo Credentials:"
echo "  Email: admin@airindia.com"
echo "  Password: airindia2026"
echo ""
echo "Other demo users:"
echo "  - s.rangan@airindia.com"
echo "  - p.shah@airindia.com"
echo "  - n.kulkarni@airindia.com"
echo "  - r.patel@airindia.com"
echo "  - a.singh@airindia.com"
echo ""
