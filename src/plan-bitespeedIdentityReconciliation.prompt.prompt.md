## Plan: Bitespeed Identity Reconciliation Service

Build a Node.js + TypeScript REST API with a `/identify` endpoint that consolidates customer contacts by linking records sharing email or phone. Uses Express.js, Prisma ORM, and PostgreSQL. Includes full test coverage and deployment to Render.com.

**Steps**

1. **Initialize project structure**
   - Create `package.json` with dependencies: `express`, `prisma`, `@prisma/client`, `zod` (validation), `dotenv`
   - Dev dependencies: `typescript`, `ts-node-dev`, `@types/express`, `jest`, `ts-jest`, `supertest`, `@types/jest`, `@types/supertest`
   - Configure `tsconfig.json` for ES2020, strict mode
   - Create folder structure:
     ```
     src/
     ├── index.ts
     ├── app.ts
     ├── config/
     ├── routes/
     ├── controllers/
     ├── services/
     ├── repositories/
     ├── types/
     └── utils/
     prisma/
     └── schema.prisma
     ```

2. **Define Prisma schema** (`prisma/schema.prisma`)
   - Create `Contact` model with: `id`, `phoneNumber?`, `email?`, `linkedId?`, `linkPrecedence` (enum: primary/secondary), `createdAt`, `updatedAt`, `deletedAt?`
   - Add self-referential relation for `linkedId`
   - Add indexes on `email`, `phoneNumber`, `linkedId`
   - Configure PostgreSQL datasource with `DATABASE_URL` env var

3. **Create database config** (`src/config/database.ts`)
   - Instantiate and export Prisma client singleton
   - Handle connection gracefully on shutdown

4. **Define types** (`src/types/contact.ts`)
   - `IdentifyRequest`: `{ email?: string | null, phoneNumber?: string | null }`
   - `IdentifyResponse`: `{ contact: { primaryContactId, emails[], phoneNumbers[], secondaryContactIds[] } }`

5. **Build Contact Repository** (`src/repositories/contactRepository.ts`)
   - `findByEmailOrPhone(email, phone)`: Find all contacts matching either value (excluding soft-deleted)
   - `findAllInCluster(primaryId)`: Get all contacts where `id = primaryId OR linkedId = primaryId`
   - `createContact(data)`: Insert new contact
   - `updateContactToSecondary(id, linkedId)`: Demote contact + update its existing secondaries
   - All queries filter `deletedAt IS NULL`

6. **Implement core linking logic** (`src/services/contactService.ts`)
   - **Algorithm for `identify(email, phone)`**:
     1. Validate at least one field is provided (reject both null with 400)
     2. Query all contacts matching email OR phone
     3. If no matches → create new primary contact, return response
     4. Find all unique primary IDs from matches (direct or via `linkedId`)
     5. If single primary → check if request adds new info:
        - Exact match exists → return cluster as-is
        - New info → create secondary linked to primary
     6. If multiple primaries → **cluster merge**:
        - Determine oldest primary by `createdAt`
        - Demote other primaries to secondary (update `linkedId`, `linkPrecedence`, `updatedAt`)
        - Update all their secondaries' `linkedId` to point to new primary
        - Check if request adds new info not already in merged cluster → create secondary if needed
     7. Fetch complete cluster, format response (primary values first in arrays)
   - **Wrap all mutations in Prisma transaction** for atomicity

7. **Create controller** (`src/controllers/identifyController.ts`)
   - Validate request body using Zod schema
   - Normalize inputs: trim whitespace, lowercase email, remove non-digits from phone
   - Call `contactService.identify()`
   - Return 200 with formatted response or appropriate error codes

8. **Set up routes** (`src/routes/identify.ts`)
   - `POST /identify` → `identifyController.handleIdentify`

9. **Configure Express app** (`src/app.ts`)
   - JSON body parser middleware
   - Mount routes
   - Error handling middleware (catch validation errors, return proper status codes)
   - Export app for testing

10. **Create entry point** (`src/index.ts`)
    - Import app, listen on `PORT` env var (default 3000)
    - Log startup message

11. **Write unit tests** (`src/__tests__/unit/contactService.test.ts`)
    - Mock repository, test each scenario:
      - New customer (no matches) → creates primary
      - Email matches existing → creates secondary
      - Phone matches existing → creates secondary
      - Exact match → no new contact
      - Two clusters merge → older stays primary
      - Cascade update of secondaries during merge
      - Null email handled
      - Null phone handled
      - Both null rejected

12. **Write integration tests** (`src/__tests__/integration/identify.test.ts`)
    - Use Supertest against real app
    - Test full request/response cycle with test database
    - Verify response format
    - Test edge cases from requirements doc

13. **Add npm scripts** (`package.json`)
    - `dev`: `ts-node-dev src/index.ts`
    - `build`: `tsc`
    - `start`: `node dist/index.js`
    - `test`: `jest`
    - `prisma:generate`: `prisma generate`
    - `prisma:migrate`: `prisma migrate dev`

14. **Create deployment config**
    - `Dockerfile` or use Render's native Node.js buildpack
    - `render.yaml` (optional) for infrastructure-as-code
    - Add `DATABASE_URL` and `PORT` to environment variables

15. **Write README.md**
    - Project description
    - Local setup instructions
    - API documentation for `/identify` endpoint
    - **Live endpoint URL** (after deployment)
    - Example requests/responses

**Verification**
- Run `npm test` locally — all unit and integration tests pass
- Test manually with curl/Postman:
  - New customer: `POST /identify` with fresh email/phone → returns new primary
  - Link by phone: send same phone + different email → returns cluster with secondary
  - Link by email: send same email + different phone → returns cluster with secondary
  - Merge clusters: send email from cluster A + phone from cluster B → older primary survives
- Deploy to Render.com, verify live endpoint works
- Test all scenarios from requirements doc against live endpoint

**Decisions**
- **Email normalization**: Convert to lowercase before storing/querying (avoids `A@x.com` vs `a@x.com` duplicates)
- **Phone normalization**: Keep as string (spec shows `"123456"`), strip whitespace but preserve digits (user inputs may vary)
- **Exact duplicate handling**: If email AND phone both match same existing contact, no new contact created — return existing cluster
- **Transaction isolation**: Use Prisma transactions for all cluster mutations to prevent race conditions
- **Soft deletes**: All queries exclude contacts where `deletedAt IS NOT NULL`
- **Response ordering**: Primary contact's email/phone listed first, then secondaries ordered by `createdAt`
