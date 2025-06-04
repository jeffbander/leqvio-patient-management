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

  // Test endpoint to verify webhook is working
  app.get("/api/email-webhook", (req, res) => {
    res.json({ 
      status: "Webhook endpoint is active", 
      url: `${req.protocol}://${req.get('host')}/api/email-webhook`,
      timestamp: new Date().toISOString()
    });
  });

  // Email webhook endpoint for SendGrid Inbound Parse
  app.post("/api/email-webhook", async (req, res) => {
    try {
      // Log all incoming data for debugging
      console.log("Received email webhook data:", JSON.stringify(req.body, null, 2));
      
      const { subject, text, html, from } = req.body;
      
      // Extract unique ID from subject line
      // Assuming format like "Response: [UNIQUE_ID]" or contains the unique ID
      const uniqueIdMatch = subject?.match(/[A-Za-z0-9\-_]{20,}/); // Adjust regex based on your ID format
      
      if (uniqueIdMatch) {
        const uniqueId = uniqueIdMatch[0];
        const emailContent = html || text || "No content";
        
        // Update the automation log with email response
        const updatedLog = await storage.updateAutomationLogWithEmailResponse(uniqueId, emailContent);
        
        if (updatedLog) {
          console.log(`Email response received for automation ${uniqueId}`);
          res.status(200).json({ success: true, message: "Email processed" });
        } else {
          console.log(`No matching automation log found for ID: ${uniqueId}`);
          res.status(404).json({ error: "No matching automation found" });
        }
      } else {
        console.log("No unique ID found in email subject:", subject);
        console.log("Full request body:", req.body);
        res.status(400).json({ error: "No unique ID found in subject" });
      }
    } catch (error) {
      console.error("Error processing email webhook:", error);
      res.status(500).json({ error: "Failed to process email" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
