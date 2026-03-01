import { Contact, LinkPrecedence } from '@prisma/client';

/**
 * Create a mock Contact object for testing
 */
export function createMockContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: 1,
    phoneNumber: '123456',
    email: 'test@example.com',
    linkedId: null,
    linkPrecedence: LinkPrecedence.primary,
    createdAt: new Date('2023-04-01T00:00:00.000Z'),
    updatedAt: new Date('2023-04-01T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

/**
 * Create a mock primary contact
 */
export function createMockPrimary(id: number, email: string, phone: string, createdAt?: Date): Contact {
  return createMockContact({
    id,
    email,
    phoneNumber: phone,
    linkedId: null,
    linkPrecedence: LinkPrecedence.primary,
    createdAt: createdAt || new Date('2023-04-01T00:00:00.000Z'),
    updatedAt: createdAt || new Date('2023-04-01T00:00:00.000Z'),
  });
}

/**
 * Create a mock secondary contact
 */
export function createMockSecondary(
  id: number,
  email: string,
  phone: string,
  linkedId: number,
  createdAt?: Date
): Contact {
  return createMockContact({
    id,
    email,
    phoneNumber: phone,
    linkedId,
    linkPrecedence: LinkPrecedence.secondary,
    createdAt: createdAt || new Date('2023-04-20T00:00:00.000Z'),
    updatedAt: createdAt || new Date('2023-04-20T00:00:00.000Z'),
  });
}
