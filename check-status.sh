#!/bin/bash

echo "=========================================="
echo "AI SMS - System Status Check"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check Docker
echo -n "Checking Docker... "
if command -v docker &> /dev/null; then
    if docker ps &> /dev/null; then
        echo -e "${GREEN}✓ Running${NC}"
        DOCKER_OK=true
    else
        echo -e "${RED}✗ Not running${NC}"
        echo -e "${YELLOW}  → Open Docker Desktop application${NC}"
        DOCKER_OK=false
    fi
else
    echo -e "${RED}✗ Not installed or not in PATH${NC}"
    echo -e "${YELLOW}  → Add Docker to PATH or use full path: /Applications/Docker.app/Contents/Resources/bin/docker${NC}"
    DOCKER_OK=false
fi

if [ "$DOCKER_OK" = true ]; then
    echo ""
    echo "Docker Containers:"
    echo "------------------"

    # Check each service
    containers=("ai-sms-app" "ai-sms-redis" "ai-sms-ollama" "ai-sms-webui" "ai-sms-redis-gui")

    for container in "${containers[@]}"; do
        echo -n "  $container: "
        if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
            echo -e "${GREEN}✓ Running${NC}"
        else
            echo -e "${RED}✗ Not running${NC}"
        fi
    done

    echo ""
    echo "AI Models:"
    echo "----------"

    if docker ps --format '{{.Names}}' | grep -q "^ai-sms-ollama$"; then
        echo -n "  Checking installed models... "
        MODEL_COUNT=$(docker exec ai-sms-ollama ollama list 2>/dev/null | grep -v "NAME" | wc -l | tr -d ' ')

        if [ "$MODEL_COUNT" -gt 0 ]; then
            echo -e "${GREEN}✓ $MODEL_COUNT models installed${NC}"
            docker exec ai-sms-ollama ollama list 2>/dev/null | grep -E "phi4|gemma|nomic" | while read line; do
                echo "    $line"
            done
        else
            echo -e "${YELLOW}⚠ No models found${NC}"
            echo -e "${YELLOW}  → Run: ./setup-ai-models.sh${NC}"
        fi
    else
        echo -e "${RED}  ✗ Ollama container not running${NC}"
        echo -e "${YELLOW}  → Run: docker compose up -d${NC}"
    fi
fi

echo ""
echo "Access Points:"
echo "--------------"

# Check ports
check_port() {
    local port=$1
    local service=$2
    local url=$3

    echo -n "  $service (port $port): "
    if lsof -i :$port &> /dev/null; then
        echo -e "${GREEN}✓ Available${NC} - $url"
    else
        echo -e "${RED}✗ Not running${NC}"
    fi
}

check_port 3000 "AI SMS App    " "http://localhost:3000"
check_port 8080 "Open WebUI    " "http://localhost:8080"
check_port 11434 "Ollama API    " "http://localhost:11434"
check_port 8081 "Redis GUI     " "http://localhost:8081"
check_port 6379 "Redis Database" "localhost:6379"

echo ""
echo "=========================================="
echo "Quick Actions:"
echo "=========================================="

if [ "$DOCKER_OK" = false ]; then
    echo -e "${YELLOW}1. Open Docker Desktop application${NC}"
    echo -e "${YELLOW}2. Wait for it to start (whale icon in menu bar)${NC}"
    echo -e "${YELLOW}3. Run: docker compose up -d${NC}"
elif ! docker ps --format '{{.Names}}' | grep -q "ai-sms-ollama"; then
    echo -e "${YELLOW}Start Docker services:${NC}"
    echo "   docker compose up -d"
    echo ""
    echo -e "${YELLOW}Download AI models:${NC}"
    echo "   ./setup-ai-models.sh"
else
    MODEL_COUNT=$(docker exec ai-sms-ollama ollama list 2>/dev/null | grep -v "NAME" | wc -l | tr -d ' ')
    if [ "$MODEL_COUNT" -eq 0 ]; then
        echo -e "${YELLOW}Download AI models:${NC}"
        echo "   ./setup-ai-models.sh"
    else
        echo -e "${GREEN}✓ Everything looks good!${NC}"
        echo ""
        echo "Test AI chat:"
        echo "   docker exec -it ai-sms-ollama ollama run phi4"
        echo ""
        echo "Or open web interface:"
        echo "   open http://localhost:8080"
    fi
fi

echo ""
