import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAutomationLogSchema, insertCustomChainSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Automation logs endpoints
  app.post("/api/automation-logs", async (req, res) => {
    try {
      const validatedData = insertAutomationLogSchema.parse(req.body);
      const log = await storage.createAutomationLog(validatedData);
      res.json(log);
    } catch (error) {
      res.status(400).json({ error: "Invalid log data" });
    }
  });

  app.get("/api/automation-logs", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const logs = await storage.getAutomationLogs(limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  });

  app.delete("/api/automation-logs", async (req, res) => {
    try {
      await storage.clearAutomationLogs();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to clear logs" });
    }
  });

  // Custom chains endpoints
  app.post("/api/custom-chains", async (req, res) => {
    try {
      const validatedData = insertCustomChainSchema.parse(req.body);
      const chain = await storage.createCustomChain(validatedData);
      res.json(chain);
    } catch (error) {
      res.status(400).json({ error: "Invalid chain data" });
    }
  });

  app.get("/api/custom-chains", async (req, res) => {
    try {
      const chains = await storage.getCustomChains();
      res.json(chains);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch chains" });
    }
  });

  app.delete("/api/custom-chains/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCustomChain(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete chain" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
