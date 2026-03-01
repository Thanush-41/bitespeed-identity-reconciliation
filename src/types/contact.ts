import { LinkPrecedence } from '@prisma/client';

export interface Contact {
  id: number;
  phoneNumber: string | null;
  email: string | null;
  linkedId: number | null;
  linkPrecedence: LinkPrecedence;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface IdentifyRequest {
  email?: string | null;
  phoneNumber?: string | null;
}

export interface IdentifyResponseContact {
  primaryContatctId: number; // Note: typo preserved from spec
  emails: string[];
  phoneNumbers: string[];
  secondaryContactIds: number[];
}

export interface IdentifyResponse {
  contact: IdentifyResponseContact;
}

export interface CreateContactData {
  email?: string | null;
  phoneNumber?: string | null;
  linkedId?: number | null;
  linkPrecedence: LinkPrecedence;
}
