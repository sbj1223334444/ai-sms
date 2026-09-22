# How to Start AI Models - Step by Step

## Current Status
✅ AI SMS app is running on http://localhost:3000 (dev mode)  
❌ AI models (Phi-4, Gemma, Nomic) are NOT running

## Why AI Models Aren't Working
The AI models need Docker/Ollama to be running. Currently only the Next.js dev server is running.

## Step-by-Step Guide to Start AI Models

### Step 1: Open Docker Desktop

1. **Open Docker Desktop** application from your Applications folder
2. **Wait** until you see the whale icon in your menu bar (top right)
3. The icon should be **steady/not animated** when ready

### Step 2: Open Terminal

Open your Terminal app and navigate to the project:

```bash
cd /Users/sabuj.mondal/ai-sms
```

### Step 3: Check Current Status

```bash
./check-status.sh
```

This will show you what's running and what needs to be started.

### Step 4: Start Docker Services

```bash
docker compose up -d
```

**Expected output:**
```
[+] Running 6/6
 ✔ Network ai-sms_ai-sms-network    Created
 ✔ Container ai-sms-redis           Started
 ✔ Container ai-sms-redis-gui       Started
 ✔ Container ai-sms-ollama          Started
 ✔ Container ai-sms-webui           Started
 ✔ Container ai-sms-app             Started
```

**Wait 30 seconds** for all services to start.

### Step 5: Verify Services Are Running

```bash
docker compose ps
```

**You should see:**
```
NAME                 STATUS
ai-sms-app          running
ai-sms-redis        running
ai-sms-redis-gui    running
ai-sms-ollama       running
ai-sms-webui        running
```

### Step 6: Download AI Models

This is the **most important step** - downloads ~12GB:

```bash
./setup-ai-models.sh
```

This will download:
- **Phi-4** (~7GB) - Takes 5-10 minutes
- **Gemma 2 9B** (~5GB) - Takes 5-10 minutes
- **Nomic Embed** (~274MB) - Takes 1-2 minutes

**Total time: 15-20 minutes**

You'll see progress bars as each model downloads.

### Step 7: Test the Models

#### Option A: Web Interface (Easiest)

```bash
open http://localhost:8080
```

1. Create an account (stored locally, no internet needed)
2. Select model from dropdown (phi4, gemma2:9b, or nomic-embed-text)
3. Start chatting!

#### Option B: Terminal

```bash
# Chat with Phi-4
docker exec -it ai-sms-ollama ollama run phi4

# Type your questions
# Type /bye to exit
```

#### Option C: API Test

```bash
curl http://localhost:11434/api/generate -d '{
  "model": "phi4",
  "prompt": "Explain aviation safety in one sentence",
  "stream": false
}'
```

## Troubleshooting

### "docker: command not found"

Docker isn't in your PATH. Try the full path:

```bash
/Applications/Docker.app/Contents/Resources/bin/docker compose up -d
```

Or add Docker to your PATH:

```bash
export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
echo 'export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"' >> ~/.zshrc
```

### "Cannot connect to Docker daemon"

Docker Desktop isn't running:
1. Open Docker Desktop application
2. Wait for the whale icon in menu bar
3. Try again

### "Port 3000 already in use"

Your dev server is running. Stop it first:

```bash
# Find the process
lsof -ti:3000

# Kill it (replace PID with the number from above)
kill -9 <PID>

# Or kill all node processes
pkill -f "next-server"

# Then start Docker
docker compose up -d
```

### Models Download Too Slowly

Models are large (12GB total). If download is very slow:
- Check your internet connection
- Try downloading one at a time:
  ```bash
  docker exec ai-sms-ollama ollama pull phi4
  docker exec ai-sms-ollama ollama pull gemma2:9b
  docker exec ai-sms-ollama ollama pull nomic-embed-text
  ```

### "Out of disk space"

You need ~15GB free space:
- Models: ~12GB
- Docker images: ~2GB
- Working space: ~1GB

Free up space and try again.

### Check What's Using Resources

```bash
# Check Docker container stats
docker stats

# Check disk usage
docker system df

# Check what's running
docker compose ps
```

## Quick Commands Reference

```bash
# Check status
./check-status.sh

# Start everything
docker compose up -d

# Download models
./setup-ai-models.sh

# View logs
docker compose logs -f ollama
docker compose logs -f open-webui

# Stop everything
docker compose down

# Restart a service
docker compose restart ollama

# Remove everything (including data!)
docker compose down -v

# List installed models
docker exec ai-sms-ollama ollama list

# Chat with Phi-4
docker exec -it ai-sms-ollama ollama run phi4

# Open web UI
open http://localhost:8080
```

## What Should Be Running

After completing all steps:

| Service | Port | URL | Status |
|---------|------|-----|--------|
| AI SMS App | 3000 | http://localhost:3000 | ✅ |
| Open WebUI | 8080 | http://localhost:8080 | ✅ |
| Ollama API | 11434 | http://localhost:11434 | ✅ |
| Redis GUI | 8081 | http://localhost:8081 | ✅ |
| Redis DB | 6379 | - | ✅ |

**Models installed:**
- ✅ Phi-4 (7GB)
- ✅ Gemma 2 9B (5GB)
- ✅ Nomic Embed (274MB)

## Still Not Working?

Run the status check and share the output:

```bash
./check-status.sh
```

This will show exactly what's running and what's missing.
