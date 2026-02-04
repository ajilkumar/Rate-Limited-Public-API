<div align="center">
  <h1>Developer Metrics API</h1>
  <p>A production-grade, rate-limited REST API for analyzing Git repository metrics. Built to demonstrate enterprise-level API design, performance optimization, and scalability patterns.</p>

  [![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
  [![Node.js](https://img.shields.io/badge/Node.js-20-green)](https://nodejs.org/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)](https://www.postgresql.org/)
  [![Redis](https://img.shields.io/badge/Redis-7-red)](https://redis.io/)
  [![Docker](https://img.shields.io/badge/Docker-24.0-blue)](https://www.docker.com/)
  [![Zod](https://img.shields.io/badge/Zod-3.22-blue)](https://zod.dev/)
  [![Winston](https://img.shields.io/badge/Winston-3.11-orange)](https://github.com/winstonjs/winston)
  [![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
  [![CI/CD Pipeline](https://github.com/ajilkumar/Rate-Limited-Public-API/actions/workflows/ci.yml/badge.svg)](https://github.com/ajilkumar/Rate-Limited-Public-API/actions/workflows/ci.yml)
</div>

---

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Key Design Decisions](#key-design-decisions)
- [Performance](#performance)
- [Testing](#testing)
- [CI/CD Pipeline](#cicd-pipeline)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## ✨ Features

### Core Functionality
- 🔐 **API Key Authentication** - Secure SHA-256 hashed API keys
- ⚡ **Rate Limiting** - Sliding window algorithm with Redis
- 📊 **Repository Analytics** - Commit frequency, contributor stats, activity metrics
- 🎯 **Multi-tier Support** - Free (100/hr), Pro (1000/hr), Enterprise (10000/hr)
- 📈 **Usage Tracking** - Comprehensive analytics and quota monitoring
- 💾 **Smart Caching** - Multi-layer caching with Redis (15min TTL)

### Technical Highlights
- ✅ Production-ready error handling (RFC 7807 format)
- ✅ TypeScript with strict mode for type safety
- ✅ Database query optimization with strategic indexes
- ✅ Batch operations for high-volume data processing
- ✅ Comprehensive request/response logging
- ✅ Graceful shutdown handling
- ✅ Health check endpoints

---

## 🛠️ Tech Stack

| Technology | Purpose | Why? |
|------------|---------|------|
| **TypeScript** | Language | Type safety, better DX |
| **Node.js 20** | Runtime | Non-blocking I/O, ecosystem |
| **Express.js** | Web Framework | Battle-tested, minimal |
| **PostgreSQL 16** | Database | ACID, complex queries, JSONB |
| **Redis 7** | Cache/Rate Limiting | Speed, atomic ops, Sorted Sets |
| **Docker** | Containerization | Consistent dev/prod environments |
| **Winston** | Logging | Structured logs, transports |
| **Zod** | Validation | Type-safe schema validation |


## 🚀 Getting Started
### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- GitHub Personal Access Token ([Get one here](https://github.com/settings/tokens))

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/ajilkumar/Developer-Metrics-API.git
cd Developer-Metrics-API
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
```

Edit `.env` and add:
- Your GitHub token (`GITHUB_TOKEN`)
- Generate `API_KEY_SECRET`: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

4. **Start Docker services**
```bash
docker-compose up -d
```

5. **Run database migrations**
```bash
npm run migrate
```

6. **Start development server**
```bash
npm run dev
```

API will be available at `http://localhost:3000`

### Quick Test
```bash
# Register API key
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# Use the returned API key
export API_KEY="sk_free_..."

# Test authentication
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer $API_KEY"
```

---

## 📁 Project Structure
```
developer-metrics-api/
├── src/
│   ├── config/           # Configuration (DB, Redis, Logger, Env)
│   │   ├── database.ts
│   │   ├── redis.ts
│   │   ├── logger.ts
│   │   └── env.ts
│   ├── middleware/       # Express middleware
│   │   ├── auth.ts                    # API key authentication
│   │   ├── rateLimiter.ts             # Sliding window rate limiting
│   │   ├── errorHandler.ts            # Global error handling
│   │   ├── requestLogger.ts           # Request/response logging
│   │   └── usageTracker.ts            # Usage tracking
│   ├── routes/           # API route definitions
│   │   ├── index.ts
│   │   ├── auth.routes.ts
│   │   ├── repository.routes.ts
│   │   ├── metrics.routes.ts
│   │   └── usage.routes.ts
│   ├── controllers/      # Request handlers
│   │   ├── auth.controller.ts
│   │   ├── repository.controller.ts
│   │   ├── metrics.controller.ts
│   │   └── usage.controller.ts
│   ├── services/         # Business logic
│   │   ├── auth.service.ts
│   │   ├── rateLimiter.service.ts
│   │   ├── repository.service.ts
│   │   ├── github.service.ts          # GitHub API integration
│   │   ├── commitAnalysis.service.ts  # Commit fetching & analysis
│   │   ├── metrics.service.ts         # Metrics calculation
│   │   ├── cache.service.ts
│   │   └── usageAnalytics.service.ts
│   ├── models/           # Data models
│   │   ├── apiKey.model.ts
│   │   └── repository.model.ts
│   ├── utils/            # Utility functions
│   │   ├── apiKeyGenerator.ts         # Key generation & hashing
│   │   ├── errors.ts                  # Custom error classes
│   │   ├── validators.ts              # Zod schemas
│   │   └── constants.ts
│   ├── types/            # TypeScript type definitions
│   │   ├── index.ts
│   │   └── express.d.ts
│   ├── app.ts            # Express app setup
│   └── server.ts         # Server entry point
├── migrations/           # Database migrations
│   ├── migrate.ts
│   ├── 001_create_api_keys.sql
│   ├── 002_create_repositories.sql
│   ├── 003_create_commit_metrics.sql
│   ├── 004_create_file_complexity.sql
│   └── 005_create_api_usage.sql
├── tests/                # Test files
│   ├── unit/
│   └── integration/
├── scripts/              # Utility scripts
│   └── test-rate-limit.sh
├── docs/                 # Documentation
├── .env.example          # Environment variables template
├── docker-compose.yml    # Docker services
├── tsconfig.json         # TypeScript configuration
└── package.json
```

---

## ⚡ Performance

### Benchmarks

**Rate Limiting:**
- Throughput: 10,000+ req/sec
- Latency: < 5ms (Redis lookup)

**Metrics Queries:**
- Uncached: 200-500ms (complex aggregations)
- Cached: 10-20ms (Redis)
- Speedup: 20-50x

**Database Indexes:**
- All foreign keys indexed
- Composite indexes on query patterns
- EXPLAIN ANALYZE verified

### Optimizations Applied

1. **Batch Inserts** - 100 commits at a time
2. **Database Indexes** - Strategic composite indexes
3. **Redis Caching** - 15-minute TTL
4. **Connection Pooling** - PostgreSQL pool (2-10 connections)
5. **Async Logging** - Don't block responses
6. **Lua Scripts** - Atomic Redis operations

---

## 🧪 Testing

### Run Tests
```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Manual Testing
```bash
# Test rate limiting
./scripts/test-rate-limit.sh YOUR_API_KEY

# Test health endpoint
curl http://localhost:3000/health

# Test metrics caching
time curl http://localhost:3000/api/v1/repositories/ID/metrics/summary \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

## ⚙️ CI/CD Pipeline

The project uses GitHub Actions for continuous integration and automated quality checks.

### Workflows
- **Code Quality**: Runs TypeScript type checking and ESLint (if configured) on every push to `main` and `develop`.
- **Automated Tests**: Executes the full test suite (Unit & Integration) in a containerized environment with PostgreSQL and Redis services.
- **Security Audit**: Performs `npm audit` and dependency vulnerability scans.
- **Build Check**: Verifies the production build process completes successfully.

### Status
Current Build Status: [![CI/CD Pipeline](https://github.com/ajilkumar/Rate-Limited-Public-API/actions/workflows/ci.yml/badge.svg)](https://github.com/ajilkumar/Rate-Limited-Public-API/actions/workflows/ci.yml)

---

## 🚢 Deployment

### Production Checklist

- [ ] Set strong `API_KEY_SECRET`
- [ ] Use production GitHub token
- [ ] Configure `CORS_ORIGIN`
- [ ] Set `NODE_ENV=production`
- [ ] Enable SSL/TLS
- [ ] Set up monitoring (Sentry, DataDog)
- [ ] Configure log aggregation
- [ ] Set up database backups
- [ ] Configure Redis persistence
- [ ] Set up health check monitoring
- [ ] Configure auto-scaling
- [ ] Set resource limits (memory, CPU)

### Docker Build
```bash
# Build production image
npm run build
docker build -t devmetrics-api .

# Run production container
docker run -p 3000:3000 --env-file .env devmetrics-api
```

### Deployment Options

- **AWS:** ECS/Fargate + RDS + ElastiCache
- **Heroku:** Heroku Postgres + Heroku Redis
- **DigitalOcean:** App Platform + Managed Databases
- **Railway:** One-click deploy

---

## 🤝 Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file.

---


## 🙏 Acknowledgments

- Inspired by production APIs at Stripe, GitHub, and Twilio
- Built as a senior developer portfolio project
- Designed to demonstrate enterprise-level API development skills

---

## 📊 Project Stats

- **Lines of Code:** ~3,500
- **API Endpoints:** 15+
- **Database Tables:** 5
- **Test Coverage:** 80%+

---

**⭐ If this project helped you, please star it on GitHub!**