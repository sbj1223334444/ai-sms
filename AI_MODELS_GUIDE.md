# AI SMS - Local AI Models Guide

Complete guide to using Phi-4, Gemma, and Nomic Embed models locally with Docker.

## Overview

This setup provides three AI models running locally:

| Model | Purpose | Size | Use Case |
|-------|---------|------|----------|
| **Phi-4** | Small tasks | ~7GB | Quick responses, simple queries, data extraction |
| **Gemma 2 9B** | Complex reasoning | ~5GB | Analysis, decision making, complex problem solving |
| **Nomic Embed** | Embeddings | ~274MB | Semantic search, similarity matching, RAG |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Network                            │
│                                                              │
│  ┌──────────────┐      ┌──────────────┐                    │
│  │  Open WebUI  │────▶ │   Ollama     │                    │
│  │  Port 8080   │      │  Port 11434  │                    │
│  │  (Frontend)  │      │  (AI Server) │                    │
│  └──────────────┘      └──────────────┘                    │
│         │                      │                            │
│         │                      ├─▶ Phi-4 (7GB)            │
│         │                      ├─▶ Gemma 2 9B (5GB)       │
│         │                      └─▶ Nomic Embed (274MB)    │
│         │                                                   │
│  ┌──────────────┐      ┌──────────────┐                   │
│  │   AI SMS     │      │    Redis     │                   │
│  │  Port 3000   │      │  Port 6379   │                   │
│  └──────────────┘      └──────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Step 1: Start All Services Including AI Models

```bash
cd /Users/sabuj.mondal/ai-sms

# Start everything
docker compose up -d

# Wait for containers to be healthy
docker compose ps
```

### Step 2: Download AI Models

```bash
# Run the setup script (downloads ~12GB total)
./setup-ai-models.sh
```

This will:
- Download Phi-4 (~7GB) - Takes 5-10 minutes
- Download Gemma 2 9B (~5GB) - Takes 5-10 minutes  
- Download Nomic Embed (~274MB) - Takes 1-2 minutes
- Test all models
- Display access information

**Total download time**: ~15-20 minutes depending on internet speed

### Step 3: Access the Frontend

Open your browser:
- **Open WebUI**: http://localhost:8080
- **AI SMS App**: http://localhost:3000
- **Redis GUI**: http://localhost:8081

First time on Open WebUI:
1. Create an account (stored locally)
2. Start chatting with your models

## Using the Models

### 1. Open WebUI (Web Interface)

**Access**: http://localhost:8080

**Features**:
- ChatGPT-like interface
- Select model from dropdown
- Chat history
- Model switching
- File uploads
- Code highlighting
- Markdown rendering

**Usage**:
1. Open http://localhost:8080
2. Sign up (first time only)
3. Select model:
   - `phi4` for quick tasks
   - `gemma2:9b` for complex reasoning
   - `nomic-embed-text` for embeddings
4. Start chatting!

### 2. Command Line

**Quick chat**:
```bash
# Chat with Phi-4
docker exec -it ai-sms-ollama ollama run phi4

# Chat with Gemma
docker exec -it ai-sms-ollama ollama run gemma2:9b

# Exit: Type /bye
```

**Single query**:
```bash
# Phi-4 for quick task
docker exec ai-sms-ollama ollama run phi4 "Summarize this: ..."

# Gemma for reasoning
docker exec ai-sms-ollama ollama run gemma2:9b "Analyze the following data: ..."

# Nomic for embeddings
docker exec ai-sms-ollama ollama run nomic-embed-text "Convert this to embeddings: ..."
```

### 3. API (Programmatic)

**Generate text**:
```bash
curl http://localhost:11434/api/generate -d '{
  "model": "phi4",
  "prompt": "Explain quantum computing in simple terms",
  "stream": false
}'
```

**Chat format**:
```bash
curl http://localhost:11434/api/chat -d '{
  "model": "gemma2:9b",
  "messages": [
    {"role": "user", "content": "What is machine learning?"}
  ],
  "stream": false
}'
```

**Generate embeddings**:
```bash
curl http://localhost:11434/api/embeddings -d '{
  "model": "nomic-embed-text",
  "prompt": "The quick brown fox jumps over the lazy dog"
}'
```

### 4. Python Integration

```python
import requests
import json

def chat_with_phi4(prompt):
    """Quick tasks with Phi-4"""
    response = requests.post('http://localhost:11434/api/generate', 
        json={
            'model': 'phi4',
            'prompt': prompt,
            'stream': False
        }
    )
    return response.json()['response']

def reason_with_gemma(prompt):
    """Complex reasoning with Gemma"""
    response = requests.post('http://localhost:11434/api/generate',
        json={
            'model': 'gemma2:9b',
            'prompt': prompt,
            'stream': False
        }
    )
    return response.json()['response']

def get_embeddings(text):
    """Get embeddings with Nomic"""
    response = requests.post('http://localhost:11434/api/embeddings',
        json={
            'model': 'nomic-embed-text',
            'prompt': text
        }
    )
    return response.json()['embedding']

# Example usage
result = chat_with_phi4("What is AI?")
print(result)

embeddings = get_embeddings("safety report analysis")
print(f"Embedding dimension: {len(embeddings)}")
```

### 5. Node.js Integration

```javascript
const axios = require('axios');

async function chatWithPhi4(prompt) {
  const response = await axios.post('http://localhost:11434/api/generate', {
    model: 'phi4',
    prompt: prompt,
    stream: false
  });
  return response.data.response;
}

async function reasonWithGemma(prompt) {
  const response = await axios.post('http://localhost:11434/api/generate', {
    model: 'gemma2:9b',
    prompt: prompt,
    stream: false
  });
  return response.data.response;
}

async function getEmbeddings(text) {
  const response = await axios.post('http://localhost:11434/api/embeddings', {
    model: 'nomic-embed-text',
    prompt: text
  });
  return response.data.embedding;
}

// Example
(async () => {
  const result = await chatWithPhi4('Explain AI safety');
  console.log(result);
})();
```

## Model Selection Guide

### When to Use Phi-4

**Best for**:
- Quick responses (faster inference)
- Data extraction from reports
- Simple summarization
- Form field validation
- Quick Q&A
- Classification tasks

**Example prompts**:
- "Extract the incident date from this report"
- "Summarize this safety report in 2 sentences"
- "Classify this as critical/major/minor"
- "What aircraft type is mentioned?"

### When to Use Gemma 2 9B

**Best for**:
- Complex analysis
- Risk assessment reasoning
- Investigation insights
- Multi-step reasoning
- Decision support
- Detailed explanations

**Example prompts**:
- "Analyze the root cause of this incident based on the investigation data"
- "What are the safety implications and recommended actions?"
- "Compare these two incidents and identify patterns"
- "Provide a detailed risk assessment"

### When to Use Nomic Embed

**Best for**:
- Semantic search
- Similar incident finding
- Report clustering
- RAG (Retrieval Augmented Generation)
- Document similarity
- Text classification

**Example use cases**:
- Find similar safety reports
- Search reports by meaning, not keywords
- Group related incidents
- Enhance search functionality

## Integration with AI SMS

### Example: AI-Powered Report Analysis

Add AI analysis to your AI SMS application:

```typescript
// src/lib/ai-analysis.ts
export async function analyzeIncidentReport(report: Report) {
  const prompt = `
    Analyze this aviation safety incident:
    
    Type: ${report.formType}
    Description: ${report.description}
    Severity: ${report.severity}
    
    Provide:
    1. Risk assessment
    2. Recommended actions
    3. Similar past incidents
  `;
  
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    body: JSON.stringify({
      model: 'gemma2:9b',
      prompt: prompt,
      stream: false
    })
  });
  
  const data = await response.json();
  return data.response;
}
```

### Example: Semantic Search for Reports

```typescript
// src/lib/semantic-search.ts
export async function findSimilarReports(query: string, reports: Report[]) {
  // Get embedding for query
  const queryEmbedding = await getEmbedding(query);
  
  // Get embeddings for all reports
  const reportEmbeddings = await Promise.all(
    reports.map(r => getEmbedding(r.description))
  );
  
  // Calculate similarities
  const similarities = reportEmbeddings.map((embedding, i) => ({
    report: reports[i],
    similarity: cosineSimilarity(queryEmbedding, embedding)
  }));
  
  // Return top matches
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);
}

async function getEmbedding(text: string): Promise<number[]> {
  const response = await fetch('http://localhost:11434/api/embeddings', {
    method: 'POST',
    body: JSON.stringify({
      model: 'nomic-embed-text',
      prompt: text
    })
  });
  const data = await response.json();
  return data.embedding;
}
```

## Management Commands

### Model Management

```bash
# List installed models
docker exec ai-sms-ollama ollama list

# Remove a model
docker exec ai-sms-ollama ollama rm phi4

# Pull a specific version
docker exec ai-sms-ollama ollama pull phi4:latest

# Show model info
docker exec ai-sms-ollama ollama show phi4
```

### Container Management

```bash
# View logs
docker compose logs -f ollama
docker compose logs -f open-webui

# Restart services
docker compose restart ollama
docker compose restart open-webui

# Stop AI services only
docker compose stop ollama open-webui

# Start AI services only
docker compose start ollama open-webui

# Check resource usage
docker stats ai-sms-ollama
```

### Cleanup

```bash
# Remove all models and data
docker compose down -v

# Remove just AI containers
docker compose rm -f ollama open-webui

# Remove AI data volumes
docker volume rm ai-sms_ollama-data
docker volume rm ai-sms_open-webui-data
```

## Performance Tuning

### GPU Acceleration

If you have an NVIDIA GPU:

```bash
# Check if GPU is available
docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi

# Models will automatically use GPU
# Check GPU usage: nvidia-smi
```

### CPU-Only Mode

Remove GPU configuration from docker-compose.yml:

```yaml
ollama:
  image: ollama/ollama:latest
  # Remove the deploy.resources section
```

### Memory Allocation

For better performance, allocate more memory to Docker:

1. Docker Desktop → Settings → Resources
2. Memory: 8GB minimum (16GB recommended)
3. CPUs: 4+ cores recommended

## Troubleshooting

### Models Not Downloading

```bash
# Check Ollama container logs
docker compose logs ollama

# Verify internet connectivity
docker exec ai-sms-ollama curl -I https://ollama.ai

# Manual download
docker exec ai-sms-ollama ollama pull phi4
```

### Slow Response Times

**CPU Only**:
- Phi-4: 5-10 seconds per response
- Gemma: 10-30 seconds per response
- Nomic: <1 second

**With GPU**:
- Phi-4: 1-2 seconds
- Gemma: 2-5 seconds  
- Nomic: <1 second

**Optimization**:
```bash
# Reduce context length
curl http://localhost:11434/api/generate -d '{
  "model": "phi4",
  "prompt": "...",
  "options": {
    "num_ctx": 2048
  }
}'
```

### Open WebUI Not Loading

```bash
# Check if container is running
docker ps | grep open-webui

# Check logs
docker compose logs open-webui

# Restart
docker compose restart open-webui

# Access at http://localhost:8080
```

### Out of Memory

```bash
# Check memory usage
docker stats

# Increase Docker memory limit
# Docker Desktop → Settings → Resources → Memory
```

## Security Considerations

### Local Network Only

By default, services are only accessible from localhost. To expose:

```yaml
# docker-compose.yml
ports:
  - "0.0.0.0:8080:8080"  # ⚠️ Exposes to network
```

### API Authentication

Open WebUI has built-in authentication. For Ollama API:

```bash
# Add nginx proxy with auth
# Or use firewall rules
# Or keep localhost-only (safest)
```

## Advanced Usage

### Custom Models

```bash
# Create a Modelfile
cat > Modelfile << EOF
FROM phi4
SYSTEM You are an aviation safety expert.
PARAMETER temperature 0.7
EOF

# Create custom model
docker exec ai-sms-ollama ollama create safety-phi4 -f Modelfile
```

### Batch Processing

```bash
# Process multiple reports
for report in reports/*.txt; do
  cat "$report" | docker exec -i ai-sms-ollama ollama run phi4 "Summarize:"
done
```

### Streaming Responses

```bash
# Stream output in real-time
curl http://localhost:11434/api/generate -d '{
  "model": "phi4",
  "prompt": "Write a long essay",
  "stream": true
}'
```

## Resource Requirements

### Disk Space
- Phi-4: ~7GB
- Gemma 2 9B: ~5GB
- Nomic Embed: ~274MB
- Docker images: ~2GB
- **Total**: ~15GB

### RAM
- Minimum: 8GB system RAM
- Recommended: 16GB system RAM
- Phi-4 usage: ~4GB
- Gemma usage: ~6GB
- Nomic usage: ~512MB

### CPU
- Minimum: 4 cores
- Recommended: 8+ cores
- Inference speed scales with cores

### GPU (Optional)
- NVIDIA GPU with 8GB+ VRAM
- 10-20x faster inference
- CUDA support required

## API Reference

Full Ollama API documentation: https://github.com/ollama/ollama/blob/main/docs/api.md

**Common endpoints**:
- `POST /api/generate` - Generate text
- `POST /api/chat` - Chat format
- `POST /api/embeddings` - Get embeddings
- `GET /api/tags` - List models
- `POST /api/pull` - Download model
- `DELETE /api/delete` - Remove model

## Next Steps

1. **Explore Open WebUI**: http://localhost:8080
2. **Test each model** with different prompts
3. **Integrate into AI SMS** for automated analysis
4. **Build features**: 
   - AI-powered report summarization
   - Semantic search for similar incidents
   - Automated risk assessment
   - Intelligent report routing

## Support

- **Ollama Docs**: https://ollama.ai
- **Open WebUI**: https://docs.openwebui.com
- **Model Info**: `docker exec ai-sms-ollama ollama show <model>`
