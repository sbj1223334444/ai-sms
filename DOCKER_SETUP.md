# AI SMS Docker Setup Guide

Complete guide to run AI SMS locally with Docker Desktop and Redis database.

## Prerequisites

- Docker Desktop installed and running
- At least 2GB of free RAM
- Ports 3000, 6379, and 8081 available

## Quick Start

### 1. Start All Services

```bash
cd /Users/sabuj.mondal/ai-sms

# Build and start all containers
docker-compose up -d

# View logs
docker-compose logs -f app
```

The application will be available at:
- **AI SMS App**: http://localhost:3000
- **Redis Commander** (Database GUI): http://localhost:8081

### 2. Login

Use any of these demo accounts with password: `airindia2026`

- admin@airindia.com (Safety Manager)
- s.rangan@airindia.com (Gatekeeper)
- p.shah@airindia.com (Investigator)
- n.kulkarni@airindia.com (Gatekeeper)
- r.patel@airindia.com (Flight Ops)
- a.singh@airindia.com (Cabin Crew)

### 3. Stop Services

```bash
# Stop containers (keeps data)
docker-compose stop

# Stop and remove containers (keeps data)
docker-compose down

# Stop and remove everything including data
docker-compose down -v
```

## What's Running?

### Service Overview

| Service | Port | Description |
|---------|------|-------------|
| ai-sms-app | 3000 | Next.js application |
| ai-sms-redis | 6379 | Redis database (persistent storage) |
| ai-sms-redis-gui | 8081 | Redis Commander (database viewer) |

### Container Details

**AI SMS App Container:**
- Built from Dockerfile
- Uses Node.js 18 Alpine Linux
- Connects to Redis for data storage
- Auto-restarts on failure

**Redis Container:**
- Official Redis 7 Alpine image
- Data persisted to Docker volume
- Append-only file (AOF) enabled for durability
- Health checks enabled

**Redis Commander:**
- Web-based Redis GUI
- View/edit data in Redis
- Useful for debugging and monitoring

## Docker Commands

### View Running Containers

```bash
docker-compose ps
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f redis
```

### Restart Services

```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart app
```

### Rebuild After Code Changes

```bash
# Rebuild and restart
docker-compose up -d --build

# Force rebuild without cache
docker-compose build --no-cache
docker-compose up -d
```

### Execute Commands Inside Container

```bash
# Open shell in app container
docker exec -it ai-sms-app sh

# Check Node.js version
docker exec -it ai-sms-app node --version

# Access Redis CLI
docker exec -it ai-sms-redis redis-cli
```

### Clean Up

```bash
# Remove stopped containers
docker-compose down

# Remove containers and volumes (deletes all data!)
docker-compose down -v

# Remove images
docker-compose down --rmi all

# Full cleanup (containers, volumes, images)
docker-compose down -v --rmi all
```

## Data Persistence

### Where is Data Stored?

Data is stored in a Docker volume named `ai-sms_redis-data`.

```bash
# List volumes
docker volume ls | grep ai-sms

# Inspect volume
docker volume inspect ai-sms_redis-data

# Backup volume
docker run --rm -v ai-sms_redis-data:/data -v $(pwd):/backup alpine tar czf /backup/redis-backup.tar.gz -C /data .

# Restore volume
docker run --rm -v ai-sms_redis-data:/data -v $(pwd):/backup alpine tar xzf /backup/redis-backup.tar.gz -C /data
```

### Redis Data Management

**View Data in Redis Commander:**
1. Open http://localhost:8081
2. Browse keys under "local"
3. View reports, forms, tasks, etc.

**Use Redis CLI:**
```bash
docker exec -it ai-sms-redis redis-cli

# Inside Redis CLI:
KEYS *                    # List all keys
GET ai-sms:reports        # Get reports data
DEL ai-sms:reports        # Delete reports (careful!)
FLUSHALL                  # Delete everything (very careful!)
```

## Environment Variables

Edit `docker-compose.yml` to change configuration:

```yaml
environment:
  # Use Redis (default for Docker setup)
  - STORAGE_DRIVER=redis
  - REDIS_URL=redis://redis:6379
  
  # Or use memory (not persistent, for testing only)
  # - STORAGE_DRIVER=memory
  
  # Or use GitHub storage
  # - STORAGE_DRIVER=github
  # - GITHUB_TOKEN=your_token
  # - GITHUB_OWNER=sbj1223334444
  # - GITHUB_REPO=ai-sms-data
  # - GITHUB_BRANCH=main
```

## Development Workflow

### Local Development with Hot Reload

For development with hot reload, run the app locally instead of in Docker:

```bash
# Start only Redis with Docker
docker-compose up -d redis redis-commander

# Run app locally with hot reload
npm run dev
```

This gives you:
- Fast hot reload (no container rebuild)
- Redis database in Docker
- Redis Commander GUI

Stop Redis when done:
```bash
docker-compose stop
```

### Production Build Testing

Test the production build locally:

```bash
# Build and run in Docker
docker-compose up -d --build

# Check logs for errors
docker-compose logs -f app

# Test the application
open http://localhost:3000
```

## Troubleshooting

### Port Already in Use

If you get "port already allocated" errors:

```bash
# Check what's using the port
lsof -i :3000
lsof -i :6379
lsof -i :8081

# Kill the process or change port in docker-compose.yml
```

### Container Won't Start

```bash
# Check container status
docker-compose ps

# View detailed logs
docker-compose logs app

# Check Redis health
docker-compose exec redis redis-cli ping
# Should return: PONG
```

### Application Errors

```bash
# View real-time logs
docker-compose logs -f app

# Restart the app container
docker-compose restart app

# Rebuild if code changed
docker-compose up -d --build
```

### Redis Connection Errors

```bash
# Test Redis connectivity
docker exec -it ai-sms-app sh
# Inside container:
ping redis
# Should resolve to internal IP

# Check Redis is running
docker-compose ps redis

# Restart Redis
docker-compose restart redis
```

### Clear All Data and Start Fresh

```bash
# Stop everything
docker-compose down

# Remove volumes (deletes all data)
docker volume rm ai-sms_redis-data

# Start fresh
docker-compose up -d
```

### Out of Memory

```bash
# Check Docker resource limits
# Docker Desktop → Settings → Resources

# Recommended minimums:
# - CPUs: 2
# - Memory: 4 GB
# - Swap: 1 GB
```

## Performance Optimization

### Redis Configuration

Edit `docker-compose.yml` to tune Redis:

```yaml
redis:
  command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
```

### Application Scaling

Run multiple app instances behind a load balancer:

```bash
# Scale app to 3 instances
docker-compose up -d --scale app=3

# Note: You'll need to add a load balancer (nginx/traefik)
```

## Monitoring

### Health Checks

```bash
# Check all services are healthy
docker-compose ps

# Manual health check
curl http://localhost:3000
curl http://localhost:3000/api/auth/signin
```

### Resource Usage

```bash
# Container stats (CPU, memory, network)
docker stats

# Specific container
docker stats ai-sms-app
```

### Redis Stats

```bash
# Redis info
docker exec -it ai-sms-redis redis-cli INFO

# Memory usage
docker exec -it ai-sms-redis redis-cli INFO memory

# Keyspace info (number of keys)
docker exec -it ai-sms-redis redis-cli INFO keyspace
```

## Security Notes

### Change Default Secrets

Before deploying to any non-local environment, change:

1. **NEXTAUTH_SECRET** in `docker-compose.yml`
   ```bash
   openssl rand -base64 32
   ```

2. **Redis password** (add to docker-compose.yml):
   ```yaml
   redis:
     command: redis-server --appendonly yes --requirepass your-password
   app:
     environment:
       - REDIS_URL=redis://:your-password@redis:6379
   ```

### Network Isolation

The services run in an isolated Docker network. Only exposed ports are accessible from host.

### Non-Root User

The application container runs as a non-root user (`nextjs:nodejs`) for security.

## Next Steps

1. ✅ Application running at http://localhost:3000
2. ✅ Redis database connected and persistent
3. ✅ Redis Commander GUI available
4. Configure SSO integration (see README.md)
5. Set up email notifications
6. Deploy to production (Vercel, AWS, etc.)

## Support

- Check logs: `docker-compose logs -f`
- Redis GUI: http://localhost:8081
- Documentation: README.md and DEPLOYMENT.md
