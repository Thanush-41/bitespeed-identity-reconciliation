import { LinkPrecedence } from '@prisma/client';
import { ContactService } from '../../services/contactService';
import { ContactRepository } from '../../repositories/contactRepository';
import { createMockPrimary, createMockSecondary } from '../helpers';
import { ValidationError } from '../../utils';

// Mock the repository
jest.mock('../../repositories/contactRepository');

describe('ContactService', () => {
  let service: ContactService;
  let mockRepository: jest.Mocked<ContactRepository>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock repository
    mockRepository = {
      findByEmailOrPhone: jest.fn(),
      findAllInCluster: jest.fn(),
      createContact: jest.fn(),
      updateContactToSecondary: jest.fn(),
      findById: jest.fn(),
      getPrismaClient: jest.fn(),
    } as unknown as jest.Mocked<ContactRepository>;

    // Create service with mock repository
    service = new ContactService(mockRepository);
  });

  describe('identify', () => {
    describe('when both email and phone are null/empty', () => {
      it('should throw ValidationError', async () => {
        await expect(service.identify(null, null)).rejects.toThrow(ValidationError);
        await expect(service.identify(undefined, undefined)).rejects.toThrow(ValidationError);
        await expect(service.identify('', '')).rejects.toThrow(ValidationError);
      });
    });

    describe('when no matching contacts exist', () => {
      it('should create a new primary contact', async () => {
        const newContact = createMockPrimary(1, 'lorraine@hillvalley.edu', '123456');

        mockRepository.findByEmailOrPhone.mockResolvedValue([]);
        mockRepository.createContact.mockResolvedValue(newContact);

        const result = await service.identify('lorraine@hillvalley.edu', '123456');

        expect(mockRepository.createContact).toHaveBeenCalledWith({
          email: 'lorraine@hillvalley.edu',
          phoneNumber: '123456',
          linkPrecedence: LinkPrecedence.primary,
        });

        expect(result.contact.primaryContatctId).toBe(1);
        expect(result.contact.emails).toEqual(['lorraine@hillvalley.edu']);
        expect(result.contact.phoneNumbers).toEqual(['123456']);
        expect(result.contact.secondaryContactIds).toEqual([]);
      });

      it('should handle email-only request', async () => {
        const newContact = createMockPrimary(1, 'test@example.com', null as unknown as string);
        newContact.phoneNumber = null;

        mockRepository.findByEmailOrPhone.mockResolvedValue([]);
        mockRepository.createContact.mockResolvedValue(newContact);

        const result = await service.identify('test@example.com', null);

        expect(mockRepository.createContact).toHaveBeenCalledWith({
          email: 'test@example.com',
          phoneNumber: null,
          linkPrecedence: LinkPrecedence.primary,
        });

        expect(result.contact.emails).toEqual(['test@example.com']);
        expect(result.contact.phoneNumbers).toEqual([]);
      });

      it('should handle phone-only request', async () => {
        const newContact = createMockPrimary(1, null as unknown as string, '123456');
        newContact.email = null;

        mockRepository.findByEmailOrPhone.mockResolvedValue([]);
        mockRepository.createContact.mockResolvedValue(newContact);

        const result = await service.identify(null, '123456');

        expect(mockRepository.createContact).toHaveBeenCalledWith({
          email: null,
          phoneNumber: '123456',
          linkPrecedence: LinkPrecedence.primary,
        });

        expect(result.contact.emails).toEqual([]);
        expect(result.contact.phoneNumbers).toEqual(['123456']);
      });
    });

    describe('when email matches existing contact', () => {
      it('should create secondary when phone is new', async () => {
        const primary = createMockPrimary(1, 'lorraine@hillvalley.edu', '123456');
        const newSecondary = createMockSecondary(2, 'lorraine@hillvalley.edu', '999999', 1);

        mockRepository.findByEmailOrPhone.mockResolvedValue([primary]);
        mockRepository.findAllInCluster.mockResolvedValue([primary]);
        mockRepository.createContact.mockResolvedValue(newSecondary);

        const result = await service.identify('lorraine@hillvalley.edu', '999999');

        expect(mockRepository.createContact).toHaveBeenCalledWith({
          email: 'lorraine@hillvalley.edu',
          phoneNumber: '999999',
          linkedId: 1,
          linkPrecedence: LinkPrecedence.secondary,
        });

        expect(result.contact.primaryContatctId).toBe(1);
        expect(result.contact.secondaryContactIds).toContain(2);
      });
    });

    describe('when phone matches existing contact', () => {
      it('should create secondary when email is new', async () => {
        const primary = createMockPrimary(1, 'lorraine@hillvalley.edu', '123456');
        const newSecondary = createMockSecondary(23, 'mcfly@hillvalley.edu', '123456', 1);

        mockRepository.findByEmailOrPhone.mockResolvedValue([primary]);
        mockRepository.findAllInCluster.mockResolvedValue([primary]);
        mockRepository.createContact.mockResolvedValue(newSecondary);

        const result = await service.identify('mcfly@hillvalley.edu', '123456');

        expect(mockRepository.createContact).toHaveBeenCalledWith({
          email: 'mcfly@hillvalley.edu',
          phoneNumber: '123456',
          linkedId: 1,
          linkPrecedence: LinkPrecedence.secondary,
        });

        expect(result.contact.primaryContatctId).toBe(1);
        expect(result.contact.emails).toContain('mcfly@hillvalley.edu');
      });
    });

    describe('when exact match exists', () => {
      it('should return existing cluster without creating new contact', async () => {
        const primary = createMockPrimary(1, 'lorraine@hillvalley.edu', '123456');

        mockRepository.findByEmailOrPhone.mockResolvedValue([primary]);
        mockRepository.findAllInCluster.mockResolvedValue([primary]);

        const result = await service.identify('lorraine@hillvalley.edu', '123456');

        expect(mockRepository.createContact).not.toHaveBeenCalled();
        expect(result.contact.primaryContatctId).toBe(1);
        expect(result.contact.secondaryContactIds).toEqual([]);
      });

      it('should return cluster when querying with email only', async () => {
        const primary = createMockPrimary(1, 'lorraine@hillvalley.edu', '123456');
        const secondary = createMockSecondary(23, 'mcfly@hillvalley.edu', '123456', 1);

        mockRepository.findByEmailOrPhone.mockResolvedValue([primary]);
        mockRepository.findAllInCluster.mockResolvedValue([primary, secondary]);

        const result = await service.identify('lorraine@hillvalley.edu', null);

        expect(mockRepository.createContact).not.toHaveBeenCalled();
        expect(result.contact.primaryContatctId).toBe(1);
        expect(result.contact.emails).toEqual(['lorraine@hillvalley.edu', 'mcfly@hillvalley.edu']);
      });

      it('should return cluster when querying with phone only', async () => {
        const primary = createMockPrimary(1, 'lorraine@hillvalley.edu', '123456');
        const secondary = createMockSecondary(23, 'mcfly@hillvalley.edu', '123456', 1);

        mockRepository.findByEmailOrPhone.mockResolvedValue([primary, secondary]);
        mockRepository.findAllInCluster.mockResolvedValue([primary, secondary]);

        const result = await service.identify(null, '123456');

        expect(mockRepository.createContact).not.toHaveBeenCalled();
        expect(result.contact.phoneNumbers).toEqual(['123456']);
      });
    });

    describe('when two primary contacts need to merge', () => {
      it('should make older primary stay primary and newer become secondary', async () => {
        const olderPrimary = createMockPrimary(
          11,
          'george@hillvalley.edu',
          '919191',
          new Date('2023-04-11T00:00:00.000Z')
        );
        const newerPrimary = createMockPrimary(
          27,
          'biffsucks@hillvalley.edu',
          '717171',
          new Date('2023-04-21T00:00:00.000Z')
        );

        // Request links the two via email from older + phone from newer
        mockRepository.findByEmailOrPhone.mockResolvedValue([olderPrimary, newerPrimary]);
        mockRepository.findById
          .mockResolvedValueOnce(olderPrimary)
          .mockResolvedValueOnce(newerPrimary);
        
        // After merge, newer becomes secondary
        const mergedCluster = [
          olderPrimary,
          { ...newerPrimary, linkedId: 11, linkPrecedence: LinkPrecedence.secondary },
        ];
        mockRepository.findAllInCluster.mockResolvedValue(mergedCluster);
        mockRepository.updateContactToSecondary.mockResolvedValue(undefined);

        const result = await service.identify('george@hillvalley.edu', '717171');

        // Verify newer primary was demoted
        expect(mockRepository.updateContactToSecondary).toHaveBeenCalledWith(27, 11);

        expect(result.contact.primaryContatctId).toBe(11);
        expect(result.contact.emails).toContain('george@hillvalley.edu');
        expect(result.contact.emails).toContain('biffsucks@hillvalley.edu');
        expect(result.contact.phoneNumbers).toContain('919191');
        expect(result.contact.phoneNumbers).toContain('717171');
        expect(result.contact.secondaryContactIds).toContain(27);
      });

      it('should cascade update secondaries of demoted primary', async () => {
        const olderPrimary = createMockPrimary(
          1,
          'a@test.com',
          '111',
          new Date('2023-01-01T00:00:00.000Z')
        );
        const newerPrimary = createMockPrimary(
          2,
          'b@test.com',
          '222',
          new Date('2023-02-01T00:00:00.000Z')
        );
        const secondaryOfNewer = createMockSecondary(3, 'c@test.com', '222', 2);

        mockRepository.findByEmailOrPhone.mockResolvedValue([olderPrimary, newerPrimary]);
        mockRepository.findById
          .mockResolvedValueOnce(olderPrimary)
          .mockResolvedValueOnce(newerPrimary);

        // After merge, all point to oldest primary
        const mergedCluster = [
          olderPrimary,
          { ...newerPrimary, linkedId: 1, linkPrecedence: LinkPrecedence.secondary },
          { ...secondaryOfNewer, linkedId: 1 },
        ];
        mockRepository.findAllInCluster.mockResolvedValue(mergedCluster);
        mockRepository.updateContactToSecondary.mockResolvedValue(undefined);

        await service.identify('a@test.com', '222');

        // updateContactToSecondary should handle cascade internally
        expect(mockRepository.updateContactToSecondary).toHaveBeenCalledWith(2, 1);
      });
    });

    describe('email normalization', () => {
      it('should lowercase email', async () => {
        const contact = createMockPrimary(1, 'test@example.com', '123');

        mockRepository.findByEmailOrPhone.mockResolvedValue([]);
        mockRepository.createContact.mockResolvedValue(contact);

        await service.identify('TEST@EXAMPLE.COM', '123');

        expect(mockRepository.findByEmailOrPhone).toHaveBeenCalledWith('test@example.com', '123');
      });

      it('should trim whitespace from email', async () => {
        const contact = createMockPrimary(1, 'test@example.com', '123');

        mockRepository.findByEmailOrPhone.mockResolvedValue([]);
        mockRepository.createContact.mockResolvedValue(contact);

        await service.identify('  test@example.com  ', '123');

        expect(mockRepository.findByEmailOrPhone).toHaveBeenCalledWith('test@example.com', '123');
      });
    });

    describe('phone normalization', () => {
      it('should trim whitespace from phone', async () => {
        const contact = createMockPrimary(1, 'test@example.com', '123456');

        mockRepository.findByEmailOrPhone.mockResolvedValue([]);
        mockRepository.createContact.mockResolvedValue(contact);

        await service.identify('test@example.com', '  123456  ');

        expect(mockRepository.findByEmailOrPhone).toHaveBeenCalledWith('test@example.com', '123456');
      });
    });
  });
});
