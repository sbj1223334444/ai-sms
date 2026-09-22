#!/bin/bash

# AI SMS - Local AI Models Setup Script
# This script downloads and configures Phi-4, Gemma, and Nomic Embed models

echo "=========================================="
echo "AI SMS - Local AI Models Setup"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Ollama container is running
echo -e "${BLUE}Checking Ollama status...${NC}"
if ! docker ps | grep -q "ai-sms-ollama"; then
    echo -e "${YELLOW}Ollama container not running. Starting Docker services...${NC}"
    docker compose up -d ollama
    echo "Waiting for Ollama to start..."
    sleep 10
fi

echo -e "${GREEN}✓ Ollama is running${NC}"
echo ""

# Function to pull model
pull_model() {
    local model=$1
    local description=$2

    echo "=========================================="
    echo -e "${BLUE}Downloading: $model${NC}"
    echo "Purpose: $description"
    echo "=========================================="

    docker exec ai-sms-ollama ollama pull $model

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Successfully downloaded $model${NC}"
    else
        echo -e "${YELLOW}⚠ Failed to download $model${NC}"
    fi
    echo ""
}

# Pull Phi-4 (Small tasks - ~7GB)
pull_model "phi4" "Microsoft Phi-4 - Efficient model for small tasks, quick responses"

# Pull Gemma (Complex reasoning - ~5GB)
pull_model "gemma2:9b" "Google Gemma 2 9B - Advanced reasoning and complex tasks"

# Pull Nomic Embed (Embeddings - ~274MB)
pull_model "nomic-embed-text" "Nomic Embed - Text embeddings for semantic search"

# List installed models
echo "=========================================="
echo -e "${BLUE}Installed Models:${NC}"
echo "=========================================="
docker exec ai-sms-ollama ollama list
echo ""

# Test the models
echo "=========================================="
echo -e "${BLUE}Testing Models...${NC}"
echo "=========================================="

echo -e "${YELLOW}Testing Phi-4...${NC}"
docker exec ai-sms-ollama ollama run phi4 "Say hello in one sentence" --verbose=false
echo ""

echo -e "${YELLOW}Testing Gemma...${NC}"
docker exec ai-sms-ollama ollama run gemma2:9b "What is 2+2? Answer briefly." --verbose=false
echo ""

echo -e "${YELLOW}Testing Nomic Embed...${NC}"
docker exec ai-sms-ollama ollama run nomic-embed-text "Test embedding" --verbose=false
echo ""

echo "=========================================="
echo -e "${GREEN}✓ Setup Complete!${NC}"
echo "=========================================="
echo ""
echo "Access points:"
echo "  • Open WebUI (Chat Interface): http://localhost:8080"
echo "  • Ollama API: http://localhost:11434"
echo "  • AI SMS Application: http://localhost:3000"
echo ""
echo "Models installed:"
echo "  • phi4 - For small/quick tasks"
echo "  • gemma2:9b - For complex reasoning"
echo "  • nomic-embed-text - For embeddings"
echo ""
echo "To use models via API:"
echo "  curl http://localhost:11434/api/generate -d '{\"model\":\"phi4\",\"prompt\":\"Hello\"}'"
echo ""
echo "To list models:"
echo "  docker exec ai-sms-ollama ollama list"
echo ""
echo "To chat with a model:"
echo "  docker exec -it ai-sms-ollama ollama run phi4"
echo ""
