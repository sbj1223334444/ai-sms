# Quick Start - Local AI Models

## 1. Start Docker Services (Including AI)

```bash
cd /Users/sabuj.mondal/ai-sms
docker compose up -d
```

This starts:
- ✅ AI SMS App (port 3000)
- ✅ Redis Database (port 6379)
- ✅ Ollama AI Server (port 11434)
- ✅ Open WebUI Frontend (port 8080)
- ✅ Redis Commander (port 8081)

## 2. Download AI Models (~12GB total)

```bash
./setup-ai-models.sh
```

Downloads:
- **Phi-4** (~7GB) - For quick tasks
- **Gemma 2 9B** (~5GB) - For complex reasoning
- **Nomic Embed** (~274MB) - For embeddings

⏱️ Takes 15-20 minutes depending on internet speed

## 3. Access Everything

Open in your browser:
- 🤖 **Chat with AI**: http://localhost:8080
- 📋 **AI SMS App**: http://localhost:3000
- 🗄️ **Redis GUI**: http://localhost:8081

## Quick Test

### Chat via Web UI
1. Go to http://localhost:8080
2. Create account (stored locally)
3. Select model: `phi4` or `gemma2:9b`
4. Start chatting!

### Chat via Terminal
```bash
# Quick chat with Phi-4
docker exec -it ai-sms-ollama ollama run phi4

# Type your question, then /bye to exit
```

### API Test
```bash
# Quick test
curl http://localhost:11434/api/generate -d '{
  "model": "phi4",
  "prompt": "What is aviation safety?",
  "stream": false
}'
```

## Model Selection

**Use Phi-4 for**:
- Quick responses
- Data extraction
- Simple questions
- Classification

**Use Gemma for**:
- Complex analysis
- Risk assessment
- Multi-step reasoning
- Detailed explanations

**Use Nomic Embed for**:
- Semantic search
- Finding similar reports
- Text embeddings
- RAG applications

## Complete Documentation

See **AI_MODELS_GUIDE.md** for:
- Full API documentation
- Python/Node.js examples
- Integration with AI SMS
- Performance tuning
- Troubleshooting

## Stop/Restart

```bash
# Stop everything
docker compose down

# Stop just AI services
docker compose stop ollama open-webui

# Restart
docker compose up -d
```

That's it! 🚀
