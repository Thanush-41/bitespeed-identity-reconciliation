# Bitespeed Identity Reconciliation Service

A backend service for FluxKart.com that identifies and links customer contacts across multiple purchases. Built with Node.js, TypeScript, Express, and PostgreSQL.

## 🚀 Live Endpoint

**Base URL:** `https://your-app-name.onrender.com`

**Identify Endpoint:** `POST /identify`

> After deploying to Render.com, update this URL with your actual endpoint.

## 📋 Features

- **Identity Reconciliation**: Links customer contacts based on shared email or phone number
- **Cluster Management**: Maintains primary/secondary contact relationships
- **Automatic Merging**: Combines separate contact clusters when new information links them
- **RESTful API**: Simple POST endpoint for contact identification

## 🛠 Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Validation**: Zod
- **Testing**: Jest + Supertest

## 📁 Project Structure

```
src/
├── index.ts              # Entry point
├── app.ts                # Express app configuration
├── config/
│   └── database.ts       # Prisma client singleton
├── controllers/
│   └── identifyController.ts
├── services/
│   └── contactService.ts # Core linking logic
├── repositories/
│   └── contactRepository.ts
├── routes/
│   └── identify.ts
├── types/
│   └── contact.ts
├── utils/
│   └── errors.ts
└── __tests__/
    ├── unit/
    └── integration/
prisma/
└── schema.prisma
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd bitespeed-identity-reconciliation
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your database URL:
   ```
   DATABASE_URL="postgresql://username:password@localhost:5432/bitespeed?schema=public"
   PORT=3000
   ```

4. **Generate Prisma client**
   ```bash
   npm run prisma:generate
   ```

5. **Run database migrations**
   ```bash
   npm run prisma:migrate
   ```

6. **Start the development server**
   ```bash
   npm run dev
   ```

The server will start at `http://localhost:3000`

## 📡 API Documentation

### POST /identify

Identifies and links contacts based on email and/or phone number.

**Request Body:**
```json
{
  "email": "string | null",
  "phoneNumber": "string | number | null"
}
```

At least one of `email` or `phoneNumber` must be provided.

**Response:**
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["primary@example.com", "secondary@example.com"],
    "phoneNumbers": ["123456", "789012"],
    "secondaryContactIds": [2, 3]
  }
}
```

### Example Requests

**New Customer:**
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "doc@hillvalley.edu", "phoneNumber": "121212"}'
```

**Link by Phone:**
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "marty@hillvalley.edu", "phoneNumber": "121212"}'
```

**Query Existing:**
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email": null, "phoneNumber": "121212"}'
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2023-04-01T00:00:00.000Z"
}
```

## 🧪 Testing

**Run all tests:**
```bash
npm test
```

**Run tests with coverage:**
```bash
npm run test:coverage
```

**Run tests in watch mode:**
```bash
npm run test:watch
```

## 🚀 Deployment to Render.com

### 1. Create PostgreSQL Database

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New** → **PostgreSQL**
3. Configure:
   - Name: `bitespeed-db`
   - Database: `bitespeed`
   - User: `bitespeed`
   - Region: Choose closest to your users
4. Click **Create Database**
5. Copy the **Internal Database URL**

### 2. Create Web Service

1. Click **New** → **Web Service**
2. Connect your GitHub repository
3. Configure:
   - Name: `bitespeed-identity`
   - Environment: `Node`
   - Build Command: `npm install && npm run prisma:generate && npm run prisma:migrate:prod && npm run build`
   - Start Command: `npm start`
4. Add Environment Variables:
   - `DATABASE_URL`: Paste the Internal Database URL from step 1
   - `NODE_ENV`: `production`
5. Click **Create Web Service**

### 3. Verify Deployment

Once deployed, test the endpoint:
```bash
curl -X POST https://your-app-name.onrender.com/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "phoneNumber": "123456"}'
```

## 📊 Database Schema

```prisma
model Contact {
  id             Int            @id @default(autoincrement())
  phoneNumber    String?
  email          String?
  linkedId       Int?
  linkPrecedence LinkPrecedence @default(primary)
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
  deletedAt      DateTime?
}

enum LinkPrecedence {
  primary
  secondary
}
```

## 🔄 Identity Linking Logic

1. **No Match**: Creates new primary contact
2. **Single Match**: Creates secondary linked to existing primary
3. **Multiple Matches (Different Clusters)**: Merges clusters - oldest primary stays, newer becomes secondary
4. **Exact Match**: Returns existing cluster without changes

## 📝 License

ISC
