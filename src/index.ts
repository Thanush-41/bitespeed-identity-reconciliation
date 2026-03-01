import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import app from './app';
import { prisma, disconnectDatabase } from './config/database';

const PORT = process.env.PORT || 3000;

async function main() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Start server
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/health`);
      console.log(`📍 Identify endpoint: http://localhost:${PORT}/identify`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\n🛑 Shutting down gracefully...');
      
      server.close(async () => {
        await disconnectDatabase();
        console.log('👋 Server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    await disconnectDatabase();
    process.exit(1);
  }
}

main();
