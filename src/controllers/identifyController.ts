import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { contactService, ContactService } from '../services';
import { AppError, ValidationError } from '../utils';

// Zod schema for request validation
const identifySchema = z.object({
  email: z.string().email().nullable().optional(),
  phoneNumber: z.union([z.string(), z.number()]).nullable().optional(),
}).refine(
  (data) => {
    // At least one field must be provided and not null
    const hasEmail = data.email !== null && data.email !== undefined && data.email !== '';
    const hasPhone = data.phoneNumber !== null && data.phoneNumber !== undefined && data.phoneNumber !== '';
    return hasEmail || hasPhone;
  },
  {
    message: 'At least one of email or phoneNumber must be provided',
  }
);

export class IdentifyController {
  private service: ContactService;

  constructor(service: ContactService = contactService) {
    this.service = service;
  }

  /**
   * Handle POST /identify request
   */
  async handleIdentify(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Parse and validate request body
      const parseResult = identifySchema.safeParse(req.body);

      if (!parseResult.success) {
        const errorMessage = parseResult.error.errors.map((e) => e.message).join(', ');
        throw new ValidationError(errorMessage);
      }

      const { email, phoneNumber } = parseResult.data;

      // Convert phoneNumber to string if it's a number
      const phoneString = phoneNumber !== null && phoneNumber !== undefined
        ? String(phoneNumber)
        : null;

      // Call service
      const response = await this.service.identify(email ?? null, phoneString);

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
}

// Create controller instance with bound method
const controller = new IdentifyController();

// Export bound handler for routes
export const handleIdentify = controller.handleIdentify.bind(controller);
