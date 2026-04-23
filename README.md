# AlumniConnect Mentorship Platform

## Project Overview
AlumniConnect is a comprehensive web-based mentorship platform built to connect students with alumni from their institution. The application facilitates mentorship through connection requests, real-time messaging, and session scheduling. 
The system features diverse roles (`student`, `alumni`, `admin`), profile moderation, smart sorting algorithms for the directory, real-time notifications via Redis pub/sub, automated session proposal flows, and digest emails.

## Technical Stack
- **Frontend**: React (Vite), TypeScript, Context API 
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Cache/Messaging**: Redis (Pub/Sub & Task Queue)
- **Authentication**: JWT (Access + Refresh tokens with UUID tracking)
- **Testing**: Pytest & Selenium (E2E Integration Testing)

## Setup Instructions

### Prerequisites
- Node.js (v18+)
- PostgreSQL (or use Docker)
- Redis (or use Docker)
- Python 3.12+ (for running the Pytest E2E suite)

### 1. Environment Configuration
Create a `.env` file in the `backend/` directory:
```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/alumniconnect_dev?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# Authentication
JWT_SECRET="your_secure_jwt_secret"
JWT_REFRESH_SECRET="your_refresh_secret"

# Email Handling (Optional but recommended for notifications)
RESEND_API_KEY="re_12345"

# Frontend Integration
CLIENT_URL="http://localhost:5173"
```

Create a `.env` file in the `frontend/` directory:
```env
VITE_API_URL="http://localhost:3001/api"
VITE_WS_URL="ws://localhost:3001"
```

### 2. Dependency Installation
Initialize both the frontend and backend dependencies:
```bash
# Install backend dependencies
cd backend
npm install
npx prisma generate

# Install frontend dependencies
cd ../frontend
npm install
```

### 3. Start Infrastructure & Database Migration
If you do not have PostgreSQL and Redis installed locally, you can easily start them using Docker:
```bash
# Start PostgreSQL
docker run --name alumniconnect_pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:15

# Start Redis
docker run --name alumniconnect_redis -p 6379:6379 -d redis:7
```

Once your database is running, sync the Prisma schema and push it to the database:
```bash
cd backend
npx prisma db push
```

*(Optional) Seed the testing data including an admin account using the backend seeder script:*
```bash
npx ts-node seed_admin.ts
```

**Default Admin Credentials** (seeded by `startAll.sh` or `seed_admin.ts`):
- **Email**: `admin_test@test.com`
- **Password**: `Password123!`

### 4. Running the Application
Start the backend server (runs on Port 3001):
```bash
cd backend
npm run dev
```

Start the frontend application (runs on Port 5173):
```bash
cd frontend
npm run dev
```

### 5. Running E2E Integration Tests (Pytest + Selenium)
The comprehensive test suite is handled by `pytest` and Headless Chrome. 
To guarantee test isolation and prevent polluting your development database, **the test suite is engineered to spin up its own ephemeral Docker containers** for PostgreSQL (`port: 5433`) and Redis (`port: 6380`) dynamically using `tests/conftest.py`. It securely manages schema pushes (`npx prisma db push`) to the testing containers inside the pytest lifecycle, runs all tests against these sandbox containers, and automatically kills the containers upon test completion.

```bash
cd tests

# Initial Python Setup
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run the unit tests securely
pytest unit/ -v -m unit

# Run the full integration test suite
pytest integration/ -v -m integration
```
