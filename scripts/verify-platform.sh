#!/bin/bash

echo "🔍 Verifying Voice Platform Setup"
echo "=================================="

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

# Function to check service
check_service() {
    if curl -f -s $2 > /dev/null; then
        echo -e "${GREEN}✓${NC} $1 is running"
    else
        echo -e "${RED}✗${NC} $1 is not responding"
        ERRORS=$((ERRORS + 1))
    fi
}

# Function to check port
check_port() {
    if nc -z localhost $2 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $1 is listening on port $2"
    else
        echo -e "${RED}✗${NC} $1 is not listening on port $2"
        ERRORS=$((ERRORS + 1))
    fi
}

echo -e "\n1️⃣ Checking Services"
echo "--------------------"
check_service "Voice Server" "http://localhost:8080/health"
check_port "PostgreSQL" 5432
check_port "Redis" 6379
check_port "TURN Server" 3478

echo -e "\n2️⃣ Checking Database"
echo "--------------------"
# Try API endpoint that uses database
if curl -s http://localhost:8080/api/v1/rooms > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Database connection successful (via API)"
    
    # Count rooms
    ROOM_COUNT=$(curl -s http://localhost:8080/api/v1/rooms | grep -o '"id"' | wc -l)
    echo -e "${GREEN}✓${NC} Database has $ROOM_COUNT test rooms"
else
    echo -e "${RED}✗${NC} Cannot connect to database"
    ERRORS=$((ERRORS + 1))
fi

echo -e "\n3️⃣ Checking API Endpoints"
echo "-------------------------"
# Test API endpoints
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/v1/rooms)
if [ "$RESPONSE" = "200" ] || [ "$RESPONSE" = "401" ]; then
    echo -e "${GREEN}✓${NC} API endpoints responding"
else
    echo -e "${RED}✗${NC} API endpoints not responding (HTTP $RESPONSE)"
    ERRORS=$((ERRORS + 1))
fi

echo -e "\n4️⃣ Checking Dependencies"
echo "------------------------"
# Check Node modules
if [ -d "node_modules" ]; then
    MODULE_COUNT=$(ls node_modules | wc -l)
    echo -e "${GREEN}✓${NC} Node modules installed ($MODULE_COUNT packages)"
else
    echo -e "${RED}✗${NC} Node modules not installed"
    ERRORS=$((ERRORS + 1))
fi

# Check build output
if [ -d "dist" ]; then
    echo -e "${GREEN}✓${NC} Project built successfully"
else
    echo -e "${YELLOW}⚠${NC} Project not built (run 'npm run build')"
    WARNINGS=$((WARNINGS + 1))
fi

echo -e "\n5️⃣ Testing Voice Connection"
echo "---------------------------"
# Quick WebSocket test
node -e "
const io = require('socket.io-client');
const socket = io('http://localhost:8080');
socket.on('connect', () => {
    console.log('✓ WebSocket connection successful');
    process.exit(0);
});
socket.on('connect_error', () => {
    console.log('✗ WebSocket connection failed');
    process.exit(1);
});
setTimeout(() => {
    console.log('✗ WebSocket connection timeout');
    process.exit(1);
}, 5000);
" 2>/dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} WebSocket connection successful"
else
    echo -e "${RED}✗${NC} WebSocket connection failed"
    ERRORS=$((ERRORS + 1))
fi

# Final Report
echo -e "\n📊 Verification Report"
echo "====================="
echo -e "Errors: ${ERRORS}"
echo -e "Warnings: ${WARNINGS}"

if [ $ERRORS -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "\n${GREEN}✅ Platform is fully operational!${NC}"
        echo ""
        echo "Access points:"
        echo "  Dashboard: http://localhost:8080"
        echo "  API: http://localhost:8080/api/v1"
        echo "  WebSocket: ws://localhost:8080"
        echo ""
        echo "Quick start:"
        echo "  1. Open dashboard: open http://localhost:8080"
        echo "  2. Create a room"
        echo "  3. Join with multiple browsers to test"
    else
        echo -e "\n${YELLOW}⚠️ Platform is running with warnings${NC}"
        echo "Some features might not work optimally."
    fi
else
    echo -e "\n${RED}❌ Platform has errors${NC}"
    echo "Please fix the errors above before using the platform."
    echo ""
    echo "Common fixes:"
    echo "  - Start services: npm run services:start"
    echo "  - Run migrations: npx prisma migrate dev"
    echo "  - Rebuild project: npm run build"
    exit 1
fi