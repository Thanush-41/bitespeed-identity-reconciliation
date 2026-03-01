import request from 'supertest';
import { PrismaClient, LinkPrecedence } from '@prisma/client';
import app from '../../app';

// Use a separate test database
const prisma = new PrismaClient();

describe('POST /identify - Integration Tests', () => {
  // Clean database before each test
  beforeEach(async () => {
    await prisma.contact.deleteMany({});
  });

  // Disconnect after all tests
  afterAll(async () => {
    await prisma.contact.deleteMany({});
    await prisma.$disconnect();
  });

  describe('New customer (no existing contacts)', () => {
    it('should create a primary contact', async () => {
      const response = await request(app)
        .post('/identify')
        .send({
          email: 'lorraine@hillvalley.edu',
          phoneNumber: '123456',
        })
        .expect(200);

      expect(response.body.contact).toBeDefined();
      expect(response.body.contact.primaryContatctId).toBeDefined();
      expect(response.body.contact.emails).toEqual(['lorraine@hillvalley.edu']);
      expect(response.body.contact.phoneNumbers).toEqual(['123456']);
      expect(response.body.contact.secondaryContactIds).toEqual([]);

      // Verify database
      const contacts = await prisma.contact.findMany();
      expect(contacts).toHaveLength(1);
      expect(contacts[0].linkPrecedence).toBe(LinkPrecedence.primary);
    });

    it('should create primary with email only', async () => {
      const response = await request(app)
        .post('/identify')
        .send({
          email: 'test@example.com',
          phoneNumber: null,
        })
        .expect(200);

      expect(response.body.contact.emails).toEqual(['test@example.com']);
      expect(response.body.contact.phoneNumbers).toEqual([]);
    });

    it('should create primary with phone only', async () => {
      const response = await request(app)
        .post('/identify')
        .send({
          email: null,
          phoneNumber: '999999',
        })
        .expect(200);

      expect(response.body.contact.emails).toEqual([]);
      expect(response.body.contact.phoneNumbers).toEqual(['999999']);
    });
  });

  describe('Linking by phone number', () => {
    it('should create secondary when phone matches but email is new', async () => {
      // First request - create primary
      await request(app)
        .post('/identify')
        .send({
          email: 'lorraine@hillvalley.edu',
          phoneNumber: '123456',
        });

      // Second request - same phone, different email
      const response = await request(app)
        .post('/identify')
        .send({
          email: 'mcfly@hillvalley.edu',
          phoneNumber: '123456',
        })
        .expect(200);

      expect(response.body.contact.emails).toContain('lorraine@hillvalley.edu');
      expect(response.body.contact.emails).toContain('mcfly@hillvalley.edu');
      expect(response.body.contact.phoneNumbers).toEqual(['123456']);
      expect(response.body.contact.secondaryContactIds).toHaveLength(1);

      // Verify database
      const contacts = await prisma.contact.findMany({ orderBy: { createdAt: 'asc' } });
      expect(contacts).toHaveLength(2);
      expect(contacts[0].linkPrecedence).toBe(LinkPrecedence.primary);
      expect(contacts[1].linkPrecedence).toBe(LinkPrecedence.secondary);
      expect(contacts[1].linkedId).toBe(contacts[0].id);
    });
  });

  describe('Linking by email', () => {
    it('should create secondary when email matches but phone is new', async () => {
      // First request
      await request(app)
        .post('/identify')
        .send({
          email: 'test@example.com',
          phoneNumber: '111111',
        });

      // Second request - same email, different phone
      const response = await request(app)
        .post('/identify')
        .send({
          email: 'test@example.com',
          phoneNumber: '222222',
        })
        .expect(200);

      expect(response.body.contact.emails).toEqual(['test@example.com']);
      expect(response.body.contact.phoneNumbers).toContain('111111');
      expect(response.body.contact.phoneNumbers).toContain('222222');
      expect(response.body.contact.secondaryContactIds).toHaveLength(1);
    });
  });

  describe('Exact match - no new contact', () => {
    it('should return existing cluster without creating new contact', async () => {
      // Create initial contact
      await request(app)
        .post('/identify')
        .send({
          email: 'test@example.com',
          phoneNumber: '123456',
        });

      // Same exact request
      await request(app)
        .post('/identify')
        .send({
          email: 'test@example.com',
          phoneNumber: '123456',
        })
        .expect(200);

      // Should still be just 1 contact
      const contacts = await prisma.contact.findMany();
      expect(contacts).toHaveLength(1);
    });

    it('should return cluster when querying with email only', async () => {
      // Create linked contacts
      await request(app).post('/identify').send({
        email: 'a@test.com',
        phoneNumber: '123',
      });

      await request(app).post('/identify').send({
        email: 'b@test.com',
        phoneNumber: '123',
      });

      // Query with just email
      const response = await request(app)
        .post('/identify')
        .send({
          email: 'a@test.com',
          phoneNumber: null,
        })
        .expect(200);

      expect(response.body.contact.emails).toContain('a@test.com');
      expect(response.body.contact.emails).toContain('b@test.com');
    });

    it('should return cluster when querying with phone only', async () => {
      // Create linked contacts
      await request(app).post('/identify').send({
        email: 'a@test.com',
        phoneNumber: '123',
      });

      await request(app).post('/identify').send({
        email: 'b@test.com',
        phoneNumber: '123',
      });

      // Query with just phone
      const response = await request(app)
        .post('/identify')
        .send({
          email: null,
          phoneNumber: '123',
        })
        .expect(200);

      expect(response.body.contact.phoneNumbers).toEqual(['123']);
      expect(response.body.contact.emails).toHaveLength(2);
    });
  });

  describe('Merging two primary contacts', () => {
    it('should make older primary stay primary and newer become secondary', async () => {
      // Create first primary
      const first = await request(app).post('/identify').send({
        email: 'george@hillvalley.edu',
        phoneNumber: '919191',
      });

      // Wait a bit to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Create second primary (different email and phone)
      const second = await request(app).post('/identify').send({
        email: 'biffsucks@hillvalley.edu',
        phoneNumber: '717171',
      });

      const firstId = first.body.contact.primaryContatctId;
      const secondId = second.body.contact.primaryContatctId;

      // Link them: email from first + phone from second
      const response = await request(app)
        .post('/identify')
        .send({
          email: 'george@hillvalley.edu',
          phoneNumber: '717171',
        })
        .expect(200);

      // First (older) should stay primary
      expect(response.body.contact.primaryContatctId).toBe(firstId);
      expect(response.body.contact.secondaryContactIds).toContain(secondId);
      expect(response.body.contact.emails).toContain('george@hillvalley.edu');
      expect(response.body.contact.emails).toContain('biffsucks@hillvalley.edu');
      expect(response.body.contact.phoneNumbers).toContain('919191');
      expect(response.body.contact.phoneNumbers).toContain('717171');

      // Verify database
      const demoted = await prisma.contact.findUnique({ where: { id: secondId } });
      expect(demoted?.linkPrecedence).toBe(LinkPrecedence.secondary);
      expect(demoted?.linkedId).toBe(firstId);
    });

    it('should cascade update secondaries of demoted primary', async () => {
      // Create first primary with a secondary
      await request(app).post('/identify').send({
        email: 'a@test.com',
        phoneNumber: '111',
      });

      await request(app).post('/identify').send({
        email: 'a2@test.com',
        phoneNumber: '111',
      });

      // Create second primary
      await request(app).post('/identify').send({
        email: 'b@test.com',
        phoneNumber: '222',
      });

      // Link first and second primaries
      const response = await request(app)
        .post('/identify')
        .send({
          email: 'a@test.com',
          phoneNumber: '222',
        })
        .expect(200);

      // All should be in one cluster
      const contacts = await prisma.contact.findMany({ orderBy: { createdAt: 'asc' } });
      const primaries = contacts.filter((c) => c.linkPrecedence === LinkPrecedence.primary);
      const secondaries = contacts.filter((c) => c.linkPrecedence === LinkPrecedence.secondary);

      expect(primaries).toHaveLength(1);
      expect(secondaries.length).toBeGreaterThanOrEqual(2);

      // All secondaries should point to the same primary
      const primaryId = primaries[0].id;
      for (const secondary of secondaries) {
        expect(secondary.linkedId).toBe(primaryId);
      }
    });
  });

  describe('Validation errors', () => {
    it('should return 400 when both email and phone are null', async () => {
      const response = await request(app)
        .post('/identify')
        .send({
          email: null,
          phoneNumber: null,
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should return 400 when body is empty', async () => {
      const response = await request(app)
        .post('/identify')
        .send({})
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should accept phoneNumber as number', async () => {
      const response = await request(app)
        .post('/identify')
        .send({
          email: 'test@example.com',
          phoneNumber: 123456,
        })
        .expect(200);

      expect(response.body.contact.phoneNumbers).toEqual(['123456']);
    });
  });

  describe('Response format (from spec examples)', () => {
    it('should match spec example response', async () => {
      // Create the scenario from the spec
      await request(app).post('/identify').send({
        email: 'lorraine@hillvalley.edu',
        phoneNumber: '123456',
      });

      await request(app).post('/identify').send({
        email: 'mcfly@hillvalley.edu',
        phoneNumber: '123456',
      });

      const response = await request(app)
        .post('/identify')
        .send({
          email: 'mcfly@hillvalley.edu',
          phoneNumber: '123456',
        })
        .expect(200);

      // Primary email should be first
      expect(response.body.contact.emails[0]).toBe('lorraine@hillvalley.edu');
      expect(response.body.contact.emails).toContain('mcfly@hillvalley.edu');
      expect(response.body.contact.phoneNumbers).toEqual(['123456']);
      expect(response.body.contact.secondaryContactIds).toHaveLength(1);
    });
  });
});
