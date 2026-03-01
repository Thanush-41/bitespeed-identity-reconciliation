import { Contact, LinkPrecedence } from '@prisma/client';
import { ContactRepository, contactRepository } from '../repositories';
import { IdentifyResponse, IdentifyResponseContact } from '../types';
import { ValidationError } from '../utils';

export class ContactService {
  private repository: ContactRepository;

  constructor(repo: ContactRepository = contactRepository) {
    this.repository = repo;
  }

  /**
   * Main identify logic - links contacts and returns consolidated response
   */
  async identify(
    email: string | null | undefined,
    phoneNumber: string | null | undefined
  ): Promise<IdentifyResponse> {
    // Normalize inputs
    const normalizedEmail = this.normalizeEmail(email);
    const normalizedPhone = this.normalizePhone(phoneNumber);

    // Validate at least one field is provided
    if (!normalizedEmail && !normalizedPhone) {
      throw new ValidationError('At least one of email or phoneNumber must be provided');
    }

    // Find all matching contacts
    const matchingContacts = await this.repository.findByEmailOrPhone(
      normalizedEmail,
      normalizedPhone
    );

    // Case 1: No matches - create new primary contact
    if (matchingContacts.length === 0) {
      const newContact = await this.repository.createContact({
        email: normalizedEmail,
        phoneNumber: normalizedPhone,
        linkPrecedence: LinkPrecedence.primary,
      });

      return this.formatResponse([newContact]);
    }

    // Find all unique primary IDs
    const primaryIds = this.findUniquePrimaryIds(matchingContacts);

    // Case 2: Single primary - might need to add secondary or return as-is
    if (primaryIds.size === 1) {
      const primaryId = Array.from(primaryIds)[0];
      return this.handleSinglePrimary(
        primaryId,
        normalizedEmail,
        normalizedPhone,
        matchingContacts
      );
    }

    // Case 3: Multiple primaries - need to merge clusters
    return this.handleMultiplePrimaries(
      primaryIds,
      normalizedEmail,
      normalizedPhone
    );
  }

  /**
   * Handle case where all matches belong to single primary
   */
  private async handleSinglePrimary(
    primaryId: number,
    email: string | null,
    phoneNumber: string | null,
    matchingContacts: Contact[]
  ): Promise<IdentifyResponse> {
    // Get full cluster
    let cluster = await this.repository.findAllInCluster(primaryId);

    // Check if request adds new info
    const hasNewInfo = this.checkNewInfo(cluster, email, phoneNumber);

    if (hasNewInfo) {
      // Create secondary contact with new info
      const newSecondary = await this.repository.createContact({
        email,
        phoneNumber,
        linkedId: primaryId,
        linkPrecedence: LinkPrecedence.secondary,
      });

      cluster.push(newSecondary);
    }

    return this.formatResponse(cluster);
  }

  /**
   * Handle case where matches span multiple primary contacts - merge clusters
   */
  private async handleMultiplePrimaries(
    primaryIds: Set<number>,
    email: string | null,
    phoneNumber: string | null
  ): Promise<IdentifyResponse> {
    // Fetch all primaries to determine which is oldest
    const primaries: Contact[] = [];
    for (const id of primaryIds) {
      const contact = await this.repository.findById(id);
      if (contact) {
        primaries.push(contact);
      }
    }

    // Sort by createdAt to find oldest
    primaries.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const oldestPrimary = primaries[0];
    const demotedPrimaries = primaries.slice(1);

    // Demote other primaries to secondary
    for (const primary of demotedPrimaries) {
      await this.repository.updateContactToSecondary(primary.id, oldestPrimary.id);
    }

    // Get merged cluster
    let cluster = await this.repository.findAllInCluster(oldestPrimary.id);

    // Check if request adds new info not already in merged cluster
    const hasNewInfo = this.checkNewInfo(cluster, email, phoneNumber);

    if (hasNewInfo) {
      const newSecondary = await this.repository.createContact({
        email,
        phoneNumber,
        linkedId: oldestPrimary.id,
        linkPrecedence: LinkPrecedence.secondary,
      });

      cluster.push(newSecondary);
    }

    return this.formatResponse(cluster);
  }

  /**
   * Find all unique primary IDs from matching contacts
   */
  private findUniquePrimaryIds(contacts: Contact[]): Set<number> {
    const primaryIds = new Set<number>();

    for (const contact of contacts) {
      if (contact.linkPrecedence === LinkPrecedence.primary) {
        primaryIds.add(contact.id);
      } else if (contact.linkedId !== null) {
        primaryIds.add(contact.linkedId);
      }
    }

    return primaryIds;
  }

  /**
   * Check if request adds new information not already in cluster.
   * Returns true if email or phoneNumber is new (not yet in any contact in the cluster).
   */
  private checkNewInfo(
    cluster: Contact[],
    email: string | null,
    phoneNumber: string | null
  ): boolean {
    const existingEmails = new Set(
      cluster.map((c) => c.email).filter((e): e is string => e !== null)
    );
    const existingPhones = new Set(
      cluster.map((c) => c.phoneNumber).filter((p): p is string => p !== null)
    );

    const hasNewEmail = email !== null && !existingEmails.has(email);
    const hasNewPhone = phoneNumber !== null && !existingPhones.has(phoneNumber);

    return hasNewEmail || hasNewPhone;
  }

  /**
   * Format cluster into API response
   */
  private formatResponse(cluster: Contact[]): IdentifyResponse {
    // Sort cluster: primary first, then by createdAt
    const sorted = [...cluster].sort((a, b) => {
      if (a.linkPrecedence === LinkPrecedence.primary && b.linkPrecedence !== LinkPrecedence.primary) {
        return -1;
      }
      if (a.linkPrecedence !== LinkPrecedence.primary && b.linkPrecedence === LinkPrecedence.primary) {
        return 1;
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const primary = sorted.find((c) => c.linkPrecedence === LinkPrecedence.primary);
    
    if (!primary) {
      throw new Error('No primary contact found in cluster');
    }

    // Collect unique emails (primary first)
    const emails: string[] = [];
    const emailSet = new Set<string>();
    
    if (primary.email) {
      emails.push(primary.email);
      emailSet.add(primary.email);
    }
    
    for (const contact of sorted) {
      if (contact.email && !emailSet.has(contact.email)) {
        emails.push(contact.email);
        emailSet.add(contact.email);
      }
    }

    // Collect unique phone numbers (primary first)
    const phoneNumbers: string[] = [];
    const phoneSet = new Set<string>();
    
    if (primary.phoneNumber) {
      phoneNumbers.push(primary.phoneNumber);
      phoneSet.add(primary.phoneNumber);
    }
    
    for (const contact of sorted) {
      if (contact.phoneNumber && !phoneSet.has(contact.phoneNumber)) {
        phoneNumbers.push(contact.phoneNumber);
        phoneSet.add(contact.phoneNumber);
      }
    }

    // Collect secondary IDs
    const secondaryContactIds = sorted
      .filter((c) => c.linkPrecedence === LinkPrecedence.secondary)
      .map((c) => c.id);

    const response: IdentifyResponseContact = {
      primaryContatctId: primary.id, // Note: typo preserved from spec
      emails,
      phoneNumbers,
      secondaryContactIds,
    };

    return { contact: response };
  }

  /**
   * Normalize email: lowercase and trim
   */
  private normalizeEmail(email: string | null | undefined): string | null {
    if (!email || email.trim() === '') {
      return null;
    }
    return email.trim().toLowerCase();
  }

  /**
   * Normalize phone: trim whitespace
   */
  private normalizePhone(phone: string | null | undefined): string | null {
    if (!phone || phone.trim() === '') {
      return null;
    }
    // Keep as string, just trim whitespace
    return phone.trim();
  }
}

// Default singleton instance
export const contactService = new ContactService();
