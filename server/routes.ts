import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import session from "express-session";
import { storage } from "./storage";
import { insertAutomationLogSchema, insertCustomChainSchema } from "@shared/schema";
import { sendMagicLink, verifyLoginToken } from "./auth";
import { extractPatientDataFromImage, extractInsuranceCardData } from "./openai-service";

// Analytics middleware to track API requests
const analyticsMiddleware = (req: any, res: any, next: any) => {
  const startTime = Date.now();
  const originalSend = res.send;
  let responseSize = 0;

  res.send = function(data: any) {
    const responseTime = Date.now() - startTime;
    responseSize = data ? Buffer.byteLength(data, 'utf8') : 0;
    
    // Only track API endpoints and webhooks, skip static files
    if (req.path.startsWith('/api') || req.path.startsWith('/webhook')) {
      const analyticsData = {
        endpoint: req.path,
        method: req.method,
        statusCode: res.statusCode,
        responseTime,
        userAgent: req.get('User-Agent') || '',
        ipAddress: req.ip || req.connection.remoteAddress || '',
        chainType: req.body?.chain_to_run || req.body?.chainType || null,
        uniqueId: req.body?.uniqueId || req.body?.["Chain Run ID"] || null,
        requestSize: req.get('Content-Length') ? parseInt(req.get('Content-Length')) : 0,
        responseSize,
        errorMessage: res.statusCode >= 400 ? (data?.error || data?.message || 'Unknown error') : null,
        requestData: req.method !== 'GET' ? req.body : null
      };

      // Store analytics asynchronously
      storage.createApiAnalytics(analyticsData).catch(error => {
        console.error('Failed to store analytics:', error);
      });
    }

    return originalSend.call(this, data);
  };

  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Apply analytics middleware to all routes
  app.use(analyticsMiddleware);
  
  // Store debug requests in memory for retrieval (moved to top)
  let debugRequests: any[] = [];

  // WEBHOOK ROUTES FIRST - these must be registered before any catch-all routes
  
  // Debug endpoint to accept any POST request and log everything
  app.post("/webhook/agents/debug", (req, res) => {
    const requestId = Date.now();
    const debugData = {
      requestId,
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      bodyType: typeof req.body,
      contentType: req.get('Content-Type'),
      userAgent: req.get('User-Agent')
    };
    
    // Store the debug request
    debugRequests.unshift(debugData);
    if (debugRequests.length > 10) debugRequests.pop(); // Keep only last 10
    
    console.log(`[WEBHOOK-DEBUG-${requestId}] === DEBUG ENDPOINT ===`);
    console.log(`[WEBHOOK-DEBUG-${requestId}] Method: ${req.method}`);
    console.log(`[WEBHOOK-DEBUG-${requestId}] URL: ${req.url}`);
    console.log(`[WEBHOOK-DEBUG-${requestId}] Headers:`, JSON.stringify(req.headers, null, 2));
    console.log(`[WEBHOOK-DEBUG-${requestId}] Body type: ${typeof req.body}`);
    console.log(`[WEBHOOK-DEBUG-${requestId}] Body:`, JSON.stringify(req.body, null, 2));
    console.log(`[WEBHOOK-DEBUG-${requestId}] Raw body length: ${JSON.stringify(req.body).length}`);
    
    res.status(200).json({
      message: "Debug endpoint received your request",
      receivedData: req.body,
      receivedHeaders: req.headers,
      timestamp: new Date().toISOString(),
      requestId: requestId,
      analysis: {
        hasChainRunId: !!req.body?.chainRunId,
        hasAgentResponse: !!req.body?.agentResponse,
        bodyKeys: Object.keys(req.body || {}),
        isValidJSON: typeof req.body === 'object'
      }
    });
  });

  // Endpoint to retrieve debug requests
  app.get("/webhook/agents/debug-logs", (req, res) => {
    res.json({
      totalRequests: debugRequests.length,
      requests: debugRequests
    });
  });

  // Production agent webhook endpoint
  app.post("/webhook/agents", async (req, res) => {
    const requestId = Date.now();
    console.log(`\n=== AGENT API MESSAGE RECEIVED ===`);
    console.log(`[WEBHOOK-AGENT-${requestId}] Timestamp: ${new Date().toISOString()}`);
    console.log(`[WEBHOOK-AGENT-${requestId}] Source IP: ${req.ip || req.connection.remoteAddress}`);
    console.log(`[WEBHOOK-AGENT-${requestId}] User-Agent: ${req.headers['user-agent']}`);
    console.log(`[WEBHOOK-AGENT-${requestId}] Content-Type: ${req.headers['content-type']}`);
    console.log(`[WEBHOOK-AGENT-${requestId}] Content-Length: ${req.headers['content-length']}`);
    console.log(`\n[WEBHOOK-AGENT-${requestId}] === RAW API MESSAGE ===`);
    console.log(`[WEBHOOK-AGENT-${requestId}]`, JSON.stringify(req.body, null, 2));
    console.log(`[WEBHOOK-AGENT-${requestId}] === END RAW MESSAGE ===\n`);
    console.log(`[WEBHOOK-AGENT-${requestId}] Message Type: ${typeof req.body}`);
    console.log(`[WEBHOOK-AGENT-${requestId}] Field Count: ${Object.keys(req.body || {}).length}`);
    console.log(`[WEBHOOK-AGENT-${requestId}] Available Fields: [${Object.keys(req.body || {}).join(', ')}]`);

    try {
      // Accept any payload and try to extract what we can
      const payload = req.body || {};
      
      // Try multiple possible field names for chainRunId
      const chainRunId = payload.chainRunId || payload.ChainRunId || payload.chainrun_id || payload.chain_run_id || payload['Chain Run ID'];
      
      // Try multiple possible field names for response content
      const responseContent = payload.agentResponse || payload.summ || payload.response || payload.content || payload.message;
      
      // Try multiple possible field names for agent name
      const agentName = payload.agentName || payload.agent_name || payload.name || 'Agents System';
      
      // Try multiple possible field names for timestamp
      const timestamp = payload.timestamp || payload['Current ISO DateTime'] || payload.datetime || payload.time;

      console.log(`[WEBHOOK-AGENT-${requestId}] Extracted values:`);
      console.log(`[WEBHOOK-AGENT-${requestId}] - chainRunId: ${chainRunId}`);
      console.log(`[WEBHOOK-AGENT-${requestId}] - responseContent: ${responseContent ? String(responseContent).substring(0, 100) + '...' : 'null'}`);
      console.log(`[WEBHOOK-AGENT-${requestId}] - agentName: ${agentName}`);
      console.log(`[WEBHOOK-AGENT-${requestId}] - timestamp: ${timestamp}`);

      // Only require chainRunId - make everything else optional
      if (!chainRunId) {
        console.log(`[WEBHOOK-AGENT-${requestId}] Missing chainRunId - tried: chainRunId, ChainRunId, chainrun_id, chain_run_id`);
        return res.status(400).json({ 
          error: "chainRunId is required",
          details: "Provide chainRunId, ChainRunId, chainrun_id, or chain_run_id field",
          receivedKeys: Object.keys(payload),
          receivedPayload: payload
        });
      }

      // Process even if no response content - just log the webhook received
      const finalResponseContent = responseContent || 'Webhook received (no response content)';

      console.log(`[WEBHOOK-AGENT-${requestId}] Processing agent response for chain: ${chainRunId}`);

      const result = await storage.updateAutomationLogWithAgentResponse(
        chainRunId,
        finalResponseContent,
        agentName,
        payload
      );

      if (result) {
        console.log(`[WEBHOOK-AGENT-${requestId}] Successfully updated automation log ID: ${result.id}`);
        
        // Create response with all received fields as variables
        const successResponse = {
          message: "Agent response processed successfully",
          chainRunId: chainRunId,
          status: "success",
          timestamp: new Date().toISOString(),
          receivedFields: Object.keys(payload)
        };

        // Add each received field as a separate variable for agents system
        const fieldNames = Object.keys(payload);
        console.log(`[WEBHOOK-AGENT-${requestId}] Adding ${fieldNames.length} fields to response:`);
        
        fieldNames.forEach((fieldName, index) => {
          const cleanFieldName = fieldName.replace(/\s+/g, '_').toLowerCase();
          successResponse[`receivedFields_${index}`] = fieldName;
          successResponse[cleanFieldName] = payload[fieldName];
          console.log(`[WEBHOOK-AGENT-${requestId}] - Field ${index}: "${fieldName}" -> "${cleanFieldName}" = "${payload[fieldName]}"`);
        });
        
        // Add receivedFields as array
        successResponse.receivedFields_array = fieldNames;
        
        console.log(`[WEBHOOK-AGENT-${requestId}] Complete response object keys:`, Object.keys(successResponse));
        
        console.log(`\n=== API RESPONSE TO AGENTS SYSTEM ===`);
        console.log(`[WEBHOOK-AGENT-${requestId}] Status: 200 OK`);
        console.log(`[WEBHOOK-AGENT-${requestId}] Response Body:`);
        console.log(`[WEBHOOK-AGENT-${requestId}]`, JSON.stringify(successResponse, null, 2));
        console.log(`[WEBHOOK-AGENT-${requestId}] === END RESPONSE ===\n`);
        
        res.json(successResponse);
      } else {
        console.log(`[WEBHOOK-AGENT-${requestId}] No automation found for chainRunId: ${chainRunId}`);
        
        const errorResponse = { 
          error: "No automation found with the provided chainRunId",
          chainRunId: chainRunId,
          availableChains: "Check your automation logs for valid chainRunIds"
        };
        
        console.log(`\n=== API RESPONSE TO AGENTS SYSTEM ===`);
        console.log(`[WEBHOOK-AGENT-${requestId}] Status: 404 Not Found`);
        console.log(`[WEBHOOK-AGENT-${requestId}] Response Body:`);
        console.log(`[WEBHOOK-AGENT-${requestId}]`, JSON.stringify(errorResponse, null, 2));
        console.log(`[WEBHOOK-AGENT-${requestId}] === END RESPONSE ===\n`);
        
        res.status(404).json(errorResponse);
      }
    } catch (error) {
      console.error(`[WEBHOOK-AGENT-${requestId}] Error processing agent webhook:`, error);
      
      const errorResponse = { 
        error: "Internal server error processing agent response",
        details: error.message 
      };
      
      console.log(`\n=== API RESPONSE TO AGENTS SYSTEM ===`);
      console.log(`[WEBHOOK-AGENT-${requestId}] Status: 500 Internal Server Error`);
      console.log(`[WEBHOOK-AGENT-${requestId}] Response Body:`);
      console.log(`[WEBHOOK-AGENT-${requestId}]`, JSON.stringify(errorResponse, null, 2));
      console.log(`[WEBHOOK-AGENT-${requestId}] === END RESPONSE ===\n`);
      
      res.status(500).json(errorResponse);
    }
  });

  // Configure session
  app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-for-dev',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in production with HTTPS
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Configure multer for multipart form data
  const upload = multer();

  // Health check
  app.get("/api/health", (req, res) => {
    console.log(`[HEALTH] Health check requested at ${new Date().toISOString()}`);
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    });
  });

  // Webhook health check
  app.get("/webhook/agents/health", (req, res) => {
    console.log(`[WEBHOOK-HEALTH] Agent webhook health check at ${new Date().toISOString()}`);
    res.json({ 
      webhook: "agents",
      status: "ready", 
      endpoint: "/webhook/agents",
      method: "POST",
      timestamp: new Date().toISOString(),
      expectedFields: ["chainRunId", "agentResponse", "agentName", "timestamp"]
    });
  });

  // (Duplicate routes removed - webhook routes are now registered at the top)

  // Authentication routes
  app.post("/api/auth/send-magic-link", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email || !email.includes("@")) {
        return res.status(400).json({ error: "Valid email required" });
      }
      
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const result = await sendMagicLink(email, baseUrl);
      
      if (result.success) {
        res.json({ 
          message: "Magic link created successfully",
          magicLink: result.magicLink 
        });
      } else {
        res.status(500).json({ error: "Failed to create magic link" });
      }
    } catch (error) {
      console.error("Magic link error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/auth/verify", async (req, res) => {
    try {
      const { token } = req.query;
      
      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "Invalid token" });
      }
      
      const result = await verifyLoginToken(token);
      
      if (result.success && result.user) {
        // Set session
        (req.session as any).userId = result.user.id;
        res.redirect("/");
      } else {
        res.redirect("/login?error=" + encodeURIComponent(result.error || "Login failed"));
      }
    } catch (error) {
      console.error("Token verification error:", error);
      res.redirect("/login?error=verification_failed");
    }
  });

  app.get("/api/auth/user", (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    storage.getUser(userId)
      .then(user => {
        if (user) {
          res.json(user);
        } else {
          res.status(404).json({ error: "User not found" });
        }
      })
      .catch(error => {
        console.error("Get user error:", error);
        res.status(500).json({ error: "Internal server error" });
      });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  // Automation logs endpoints
  app.post("/api/automation-logs", async (req, res) => {
    const requestId = Date.now();
    console.log(`\n=== AUTOMATION TRIGGER API LOGGED ===`);
    console.log(`[API-LOGS-CREATE-${requestId}] Timestamp: ${new Date().toISOString()}`);
    console.log(`[API-LOGS-CREATE-${requestId}] Source: Frontend Automation Trigger`);
    console.log(`[API-LOGS-CREATE-${requestId}] Action: Logging successful automation response`);
    console.log(`\n[API-LOGS-CREATE-${requestId}] === AUTOMATION LOG DATA ===`);
    console.log(`[API-LOGS-CREATE-${requestId}]`, JSON.stringify(req.body, null, 2));
    console.log(`[API-LOGS-CREATE-${requestId}] === END LOG DATA ===\n`);
    
    try {
      const validatedData = insertAutomationLogSchema.parse(req.body);
      console.log(`[API-LOGS-CREATE-${requestId}] Validation successful`);
      console.log(`[API-LOGS-CREATE-${requestId}] Validated data:`, JSON.stringify(validatedData, null, 2));
      
      const log = await storage.createAutomationLog(validatedData);
      console.log(`[API-LOGS-CREATE-${requestId}] Log created successfully:`);
      console.log(`[API-LOGS-CREATE-${requestId}] - ID: ${log.id}`);
      console.log(`[API-LOGS-CREATE-${requestId}] - ChainName: ${log.chainName}`);
      console.log(`[API-LOGS-CREATE-${requestId}] - UniqueId: ${log.uniqueId}`);
      console.log(`[API-LOGS-CREATE-${requestId}] - Email: ${log.email}`);
      console.log(`[API-LOGS-CREATE-${requestId}] - Status: ${log.status}`);
      
      res.json(log);
    } catch (error) {
      console.error(`[API-LOGS-CREATE-${requestId}] ERROR:`, error);
      console.error(`[API-LOGS-CREATE-${requestId}] Error details:`, (error as any).message);
      res.status(400).json({ 
        error: "Invalid log data", 
        details: (error as any).message,
        timestamp: new Date().toISOString(),
        requestId 
      });
    }
    console.log(`[API-LOGS-CREATE-${requestId}] === END CREATE LOG ===`);
  });

  app.get("/api/automation-logs", async (req, res) => {
    const requestId = Date.now();
    console.log(`[API-LOGS-GET-${requestId}] === FETCHING AUTOMATION LOGS ===`);
    console.log(`[API-LOGS-GET-${requestId}] Query params:`, req.query);
    
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const dateRange = req.query.dateRange as string;
      let dateFilter = null;
      
      // Calculate date filter based on range
      if (dateRange && dateRange !== 'all') {
        const now = new Date();
        const filterDate = new Date();
        
        switch (dateRange) {
          case '1day':
            filterDate.setDate(now.getDate() - 1);
            break;
          case '3days':
            filterDate.setDate(now.getDate() - 3);
            break;
          case 'week':
            filterDate.setDate(now.getDate() - 7);
            break;
          default:
            filterDate.setDate(now.getDate() - 3); // Default to 3 days
        }
        dateFilter = filterDate;
      }
      
      console.log(`[API-LOGS-GET-${requestId}] Fetching logs with limit: ${limit}, dateFilter: ${dateFilter ? dateFilter.toISOString() : 'null'}`);
      
      const logs = await storage.getAutomationLogs(limit, dateFilter);
      console.log(`[API-LOGS-GET-${requestId}] Retrieved ${logs.length} logs`);
      console.log(`[API-LOGS-GET-${requestId}] Log IDs: [${logs.map(log => log.id).join(', ')}]`);
      console.log(`[API-LOGS-GET-${requestId}] UniqueIds: [${logs.map(log => log.uniqueid || 'null').join(', ')}]`);
      
      res.json(logs);
    } catch (error) {
      console.error(`[API-LOGS-GET-${requestId}] ERROR:`, error);
      res.status(500).json({ 
        error: "Failed to fetch logs",
        timestamp: new Date().toISOString(),
        requestId 
      });
    }
    console.log(`[API-LOGS-GET-${requestId}] === END FETCH LOGS ===`);
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
    const requestId = Date.now();
    console.log(`[CUSTOM-CHAIN-CREATE-${requestId}] === CREATING CUSTOM CHAIN ===`);
    console.log(`[CUSTOM-CHAIN-CREATE-${requestId}] Request body:`, JSON.stringify(req.body, null, 2));
    
    try {
      const validatedData = insertCustomChainSchema.parse(req.body);
      console.log(`[CUSTOM-CHAIN-CREATE-${requestId}] Validation successful:`, validatedData);
      
      const chain = await storage.createCustomChain(validatedData);
      console.log(`[CUSTOM-CHAIN-CREATE-${requestId}] Chain created successfully:`, chain);
      
      res.json(chain);
    } catch (error) {
      console.error(`[CUSTOM-CHAIN-CREATE-${requestId}] ERROR:`, error);
      console.error(`[CUSTOM-CHAIN-CREATE-${requestId}] Error details:`, (error as any).message);
      res.status(400).json({ 
        error: "Invalid chain data", 
        details: (error as any).message,
        timestamp: new Date().toISOString(),
        requestId 
      });
    }
    console.log(`[CUSTOM-CHAIN-CREATE-${requestId}] === END CREATE CHAIN ===`);
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
  app.post("/api/email-webhook", upload.any(), async (req, res) => {
    try {
      // Log all incoming data for debugging
      console.log("Received email webhook data:", JSON.stringify(req.body, null, 2));
      console.log("Request headers:", JSON.stringify(req.headers, null, 2));
      console.log("Available fields:", Object.keys(req.body));
      
      // SendGrid sends form data, get the actual field values
      const subject = req.body.subject;
      const text = req.body.text;
      const html = req.body.html;
      const from = req.body.from;
      
      // Log all available fields to understand the email structure
      console.log("All email fields:");
      Object.keys(req.body).forEach(key => {
        const value = req.body[key];
        console.log(`${key}: ${typeof value === 'string' ? value.substring(0, 200) : value}`);
      });
      
      console.log("Subject found:", subject);
      console.log("Text found:", text);
      console.log("HTML found:", html);
      console.log("Email content for ID extraction:", req.body.email?.substring(0, 500));
      
      // Extract unique ID from email content first (prioritize run ID patterns)
      const emailContent = html || text || req.body.email || "";
      console.log("Full email content for debugging:", emailContent?.substring(0, 1000));
      
      // Look for patterns like "Output from run (548d4e08)" or "run ID: 548d4e08"
      // Also handle HTML encoded content
      const decodedContent = emailContent?.replace(/=3D/g, '=').replace(/=\r?\n/g, '');
      
      // Look for ChainRun_ID first as primary identifier
      let uniqueIdMatch = decodedContent?.match(/"ChainRun_ID"\s*:\s*"([A-Za-z0-9\-_]+)"/i);
      console.log("ChainRun_ID match attempt:", uniqueIdMatch);
      
      if (!uniqueIdMatch) {
        // Look for "Output from run (ID)" pattern which is what AppSheet sends
        uniqueIdMatch = decodedContent?.match(/Output\s+from\s+run\s*\(([A-Za-z0-9\-_]{6,})\)/i);
        console.log("Output from run pattern match:", uniqueIdMatch);
      }
      
      if (!uniqueIdMatch) {
        // Other fallback patterns
        uniqueIdMatch = decodedContent?.match(/ChainRun_ID[^"]*"([A-Za-z0-9\-_]{6,})"/i) ||
                       decodedContent?.match(/run\s*\(([A-Za-z0-9\-_]{6,})\)/i);
        console.log("Fallback pattern match:", uniqueIdMatch);
      }
      
      // If still no match, try subject line as last resort
      if (!uniqueIdMatch) {
        uniqueIdMatch = subject?.match(/\(([A-Za-z0-9\-_]{6,})\)/); // Look for IDs in parentheses in subject
        console.log("Subject pattern match:", uniqueIdMatch);
      }
      
      if (uniqueIdMatch && uniqueIdMatch[1]) {
        uniqueIdMatch = [uniqueIdMatch[1]]; // Use the captured group
        console.log("Using captured group:", uniqueIdMatch);
      }
      
      if (uniqueIdMatch) {
        const uniqueId = uniqueIdMatch[0];
        console.log("Extracted unique ID:", uniqueId);
        
        // Extract HTML content from the raw email
        let emailContent = "No content found";
        const rawEmail = req.body.email || "";
        
        // Look for HTML content between Content-Type: text/html markers
        const htmlMatch = rawEmail.match(/Content-Type: text\/html[\s\S]*?Content-Transfer-Encoding: quoted-printable\s*([\s\S]*?)(?=--[0-9a-f]+|$)/i);
        
        if (htmlMatch && htmlMatch[1]) {
          emailContent = htmlMatch[1]
            .replace(/=3D/g, '=')
            .replace(/=([0-9A-F]{2})/g, (match: string, hex: string) => {
              return String.fromCharCode(parseInt(hex, 16));
            })
            .replace(/=\r?\n/g, '')
            .trim();
        } else {
          // Fallback to full email content
          emailContent = html || text || rawEmail || "No content";
        }
        
        console.log("Processed email content length:", emailContent.length);
        console.log("Email content preview:", emailContent.substring(0, 1000));
        
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

  // API Analytics endpoints
  app.get("/api/analytics/summary", async (req, res) => {
    try {
      const timeRange = req.query.timeRange as string || '24h';
      const summary = await storage.getAnalyticsSummary(timeRange);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch analytics summary" });
    }
  });

  app.get("/api/analytics/endpoints", async (req, res) => {
    try {
      const timeRange = req.query.timeRange as string || '24h';
      const endpointStats = await storage.getEndpointStats(timeRange);
      res.json(endpointStats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch endpoint stats" });
    }
  });

  app.get("/api/analytics/response-times", async (req, res) => {
    try {
      const timeRange = req.query.timeRange as string || '24h';
      const responseTimeStats = await storage.getResponseTimeStats(timeRange);
      res.json(responseTimeStats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch response time stats" });
    }
  });

  app.get("/api/analytics/errors", async (req, res) => {
    try {
      const timeRange = req.query.timeRange as string || '24h';
      const errorStats = await storage.getErrorRateStats(timeRange);
      res.json(errorStats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch error stats" });
    }
  });

  app.get("/api/analytics/raw", async (req, res) => {
    try {
      const timeRange = req.query.timeRange as string || '24h';
      const analytics = await storage.getApiAnalytics(timeRange);
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch raw analytics" });
    }
  });

  // Photo text extraction endpoint - Basic patient data
  app.post("/api/extract-patient-data", upload.single('photo'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No photo file uploaded" });
      }

      // Convert uploaded file to base64
      const base64Image = req.file.buffer.toString('base64');
      
      // Extract patient data using OpenAI Vision
      const extractedData = await extractPatientDataFromImage(base64Image);
      
      console.log("Photo text extraction completed:", {
        fileName: req.file.originalname,
        confidence: extractedData.confidence,
        extractedFields: {
          firstName: extractedData.firstName,
          lastName: extractedData.lastName,
          dateOfBirth: extractedData.dateOfBirth
        }
      });
      
      res.json(extractedData);
    } catch (error) {
      console.error("Photo extraction error:", error);
      res.status(500).json({ 
        error: "Failed to extract patient data from photo",
        details: (error as Error).message 
      });
    }
  });

  // Insurance card comprehensive extraction endpoint
  app.post("/api/extract-insurance-card", upload.single('photo'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No insurance card image uploaded" });
      }

      // Convert uploaded file to base64
      const base64Image = req.file.buffer.toString('base64');
      
      // Extract comprehensive insurance card data using OpenAI Vision
      const extractedData = await extractInsuranceCardData(base64Image);
      
      console.log("Insurance card extraction completed:", {
        fileName: req.file.originalname,
        imageSide: extractedData.metadata.image_side,
        overallConfidence: extractedData.metadata.ocr_confidence.overall,
        extractedFields: {
          insurerName: extractedData.insurer.name,
          memberId: extractedData.member.member_id,
          subscriberName: extractedData.member.subscriber_name,
          groupNumber: extractedData.insurer.group_number,
          pharmacyBin: extractedData.pharmacy.bin,
          customerServicePhone: extractedData.contact.customer_service_phone
        }
      });
      
      res.json(extractedData);
    } catch (error) {
      console.error("Insurance card extraction error:", error);
      res.status(500).json({ 
        error: "Failed to extract insurance card data",
        details: (error as Error).message 
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
