import "dotenv/config";
import { ApolloServer } from '@apollo/server';
import express from "express";
import cors from 'cors';
import bodyParser from 'body-parser';
import { typeDefs } from "./graphql/schema";
import { resolvers } from "./graphql/resolvers";
import { prisma } from "./services/scripts";
import { EligibilityWorker } from "./workers/EligibilityWorker";
import { EligibilityService } from "./services/EligibilityService";
import { CacheService } from "./services/CacheService";
import { redisConnection } from "./workers/queus";
import { serverAdapter } from "./monitoring/bullboard";

const PORT = process.env.PORT || 4000;

export async function createApp() {
  // Initialize services
  const cacheService = new CacheService(redisConnection);
  const eligibilityService = new EligibilityService(prisma);

  // Start background worker
  const worker = new EligibilityWorker(eligibilityService, cacheService);
  await worker.start();

  // Create Express app
  const app = express();

  // Global middleware
  app.use(cors());
  app.use(bodyParser.json());

  // Mount Bull Board
  app.use('/admin/queues', serverAdapter.getRouter());

  // Create Apollo Server
  const server = new ApolloServer({
    typeDefs,
    resolvers,
  });

  // Start Apollo Server
  await server.start();

  // Mount GraphQL endpoint
  app.post('/graphql', async (req, res) => {
    const { body } = req;
    
    try {
      const result = await server.executeOperation(
        {
          query: body.query,
          variables: body.variables,
          operationName: body.operationName,
        },
        {
          contextValue: {
            prisma,
            user: req.headers.authorization,
          },
        }
      );

      res.status(200).json(result);
    } catch (error) {
      console.error('GraphQL Error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Start server
const serverInstance = app.listen(PORT, () => {
    console.log(`🚀 Apollo Server running on http://localhost:${PORT}/graphql`);
    console.log(`📈 Bull Board available at http://localhost:${PORT}/admin/queues`);
  });

  
    
  //   // Graceful shutdown
  // process.on("SIGINT", async () => {
  //   console.log("\n🛑 Shutting down gracefully...");
  //   await server.stop();
  //   await worker.stop();
  //   await prisma.$disconnect();
  //   await redisConnection.quit();
  //   process.exit(0);
  // });

  return { app, serverInstance, worker, server };

}

if (import.meta.url === `file://${process.argv[1]}`) {
  createApp().catch(console.error);
}

