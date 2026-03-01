// Jest test setup file
import { jest } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Mock console.error and console.log in tests to keep output clean
// Uncomment if desired:
// global.console.error = jest.fn();
// global.console.log = jest.fn();
