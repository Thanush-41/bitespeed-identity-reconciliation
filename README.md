# Bitespeed Identity Reconciliation

Backend service for the Bitespeed Identity Reconciliation task. Identifies and links customer contacts across multiple purchases using shared email or phone number.

## Live Endpoints

| Resource | URL |
|---|---|
| Identify API | `POST https://bitespeed-identity-a4bc.onrender.com/identify` |
| Swagger UI | `https://bitespeed-identity-a4bc.onrender.com/api-docs` |
| Health Check | `GET https://bitespeed-identity-a4bc.onrender.com/health` |
| Source Code | `https://github.com/Thanush-41/bitespeed-identity-reconciliation` |

## Task

Given an email and/or phone number, `POST /identify` returns a consolidated view of all contacts that belong to the same person. Contacts sharing any piece of identifying information are linked into a cluster with one primary and zero or more secondary contacts.

## POST /identify

**Request**

```json
{
  "email": "string | null",
  "phoneNumber": "string | number | null"
}
```

At least one of `email` or `phoneNumber` must be provided.

**Response 200 OK**

```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["primary@example.com", "secondary@example.com"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [2]
  }
}
```

The primary contact's email and phone appear first in their respective arrays. All secondary contact IDs are listed in `secondaryContactIds`.

**Errors**

| Status | Condition |
|---|---|
| 400 | Both `email` and `phoneNumber` are null or missing |
| 500 | Internal server error |

### Example Requests

```bash
# New contact
curl -X POST https://bitespeed-identity-a4bc.onrender.com/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "lorraine@hillvalley.edu", "phoneNumber": "123456"}'

# Link by shared phone
curl -X POST https://bitespeed-identity-a4bc.onrender.com/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "mcfly@hillvalley.edu", "phoneNumber": "123456"}'

# Query by email only
curl -X POST https://bitespeed-identity-a4bc.onrender.com/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "lorraine@hillvalley.edu", "phoneNumber": null}'
```

## Identity Linking Logic

1. No match - creates a new primary contact.
2. Single cluster match - if the request introduces new info, creates a secondary contact linked to the primary; otherwise returns the existing cluster unchanged.
3. Two distinct clusters match - merges them: the older primary stays primary, the newer primary is demoted to secondary, and all its secondaries are re-linked.

## Tech Stack

- Node.js 18 / TypeScript 5
- Express.js
- PostgreSQL 15 / Prisma ORM
- Zod (request validation)
- Jest + Supertest (28 tests: 14 unit, 14 integration)

## Running Locally

Prerequisites: Node.js 18+, Docker

```bash
git clone https://github.com/Thanush-41/bitespeed-identity-reconciliation
cd bitespeed-identity-reconciliation
npm install
docker compose up
```

The server starts at http://localhost:3000. Swagger UI at http://localhost:3000/api-docs.

Run all tests:

```bash
docker compose --profile test run --rm test
```

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NODE_ENV` | development / production / test |
| `PORT` | Server port (default: 3000) |

## License

ISC
