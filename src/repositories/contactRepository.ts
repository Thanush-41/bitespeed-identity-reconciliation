import { Contact, LinkPrecedence, PrismaClient } from '@prisma/client';
import { prisma } from '../config/database';
import { CreateContactData } from '../types';

export class ContactRepository {
  private db: PrismaClient;

  constructor(prismaClient: PrismaClient = prisma) {
    this.db = prismaClient;
  }

  /**
   * Find all contacts matching either email or phone (excluding soft-deleted)
   */
  async findByEmailOrPhone(
    email: string | null | undefined,
    phoneNumber: string | null | undefined
  ): Promise<Contact[]> {
    const orConditions: Array<{ email?: string; phoneNumber?: string }> = [];

    if (email) {
      orConditions.push({ email });
    }
    if (phoneNumber) {
      orConditions.push({ phoneNumber });
    }

    if (orConditions.length === 0) {
      return [];
    }

    return this.db.contact.findMany({
      where: {
        OR: orConditions,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /**
   * Find all contacts in a cluster (primary + all secondaries)
   */
  async findAllInCluster(primaryId: number): Promise<Contact[]> {
    return this.db.contact.findMany({
      where: {
        OR: [
          { id: primaryId },
          { linkedId: primaryId },
        ],
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /**
   * Create a new contact
   */
  async createContact(data: CreateContactData): Promise<Contact> {
    return this.db.contact.create({
      data: {
        email: data.email ?? null,
        phoneNumber: data.phoneNumber ?? null,
        linkedId: data.linkedId ?? null,
        linkPrecedence: data.linkPrecedence,
      },
    });
  }

  /**
   * Update a contact to become secondary and cascade to its existing secondaries
   */
  async updateContactToSecondary(
    contactId: number,
    newPrimaryId: number
  ): Promise<void> {
    await this.db.$transaction([
      // Update the contact itself to be secondary
      this.db.contact.update({
        where: { id: contactId },
        data: {
          linkedId: newPrimaryId,
          linkPrecedence: LinkPrecedence.secondary,
          updatedAt: new Date(),
        },
      }),
      // Update all contacts that were linked to this contact to point to new primary
      this.db.contact.updateMany({
        where: {
          linkedId: contactId,
          deletedAt: null,
        },
        data: {
          linkedId: newPrimaryId,
          updatedAt: new Date(),
        },
      }),
    ]);
  }

  /**
   * Find a contact by ID
   */
  async findById(id: number): Promise<Contact | null> {
    return this.db.contact.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
  }

  /**
   * Get Prisma client for transactions
   */
  getPrismaClient(): PrismaClient {
    return this.db;
  }
}

// Default singleton instance
export const contactRepository = new ContactRepository();
