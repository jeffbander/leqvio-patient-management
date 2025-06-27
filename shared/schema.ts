import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at"),
});

export const loginTokens = pgTable("login_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const automationLogs = pgTable("automation_logs", {
  id: serial("id").primaryKey(),
  chainName: text("chain_name").notNull(),
  email: text("email").notNull(),
  status: text("status").notNull(), // 'success' | 'error'
  response: text("response").notNull(),
  requestData: jsonb("request_data").notNull(),
  uniqueId: text("unique_id"), // Store the unique ID from API response
  emailResponse: text("email_response"), // Store email response content
  emailReceivedAt: timestamp("email_received_at"), // When email response was received
  agentResponse: text("agent_response"), // Store agent response content
  agentName: text("agent_name"), // Name of the agent that sent the response
  agentReceivedAt: timestamp("agent_received_at"), // When agent response was received
  webhookPayload: jsonb("webhook_payload"), // Store complete webhook payload from agents system
  chainType: text("chain_type"), // Type of chain (research, pre_pre_chart, etc.)
  isCompleted: boolean("is_completed").default(false), // Mark when chain processing is complete
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const customChains = pgTable("custom_chains", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const apiAnalytics = pgTable("api_analytics", {
  id: serial("id").primaryKey(),
  endpoint: text("endpoint").notNull(), // '/webhook/agents', '/api/automation-logs', etc.
  method: text("method").notNull(), // GET, POST, etc.
  statusCode: integer("status_code").notNull(),
  responseTime: integer("response_time").notNull(), // in milliseconds
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  chainType: text("chain_type"), // Type of chain being processed
  uniqueId: text("unique_id"), // Chain Run ID for tracking
  requestSize: integer("request_size"), // Size of request payload in bytes
  responseSize: integer("response_size"), // Size of response payload in bytes
  errorMessage: text("error_message"), // Store error details if any
  requestData: jsonb("request_data"), // Store request payload for analysis
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const automationLogsRelations = relations(automationLogs, ({ one }) => ({}));
export const customChainsRelations = relations(customChains, ({ one }) => ({}));
export const apiAnalyticsRelations = relations(apiAnalytics, ({ one }) => ({}));

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  name: true,
});

export const insertLoginTokenSchema = createInsertSchema(loginTokens).omit({
  id: true,
  createdAt: true,
});

export const insertAutomationLogSchema = createInsertSchema(automationLogs).omit({
  id: true,
  createdAt: true,
}).extend({
  timestamp: z.union([z.date(), z.string().transform((str) => new Date(str))]),
});

export const insertCustomChainSchema = createInsertSchema(customChains).omit({
  id: true,
  createdAt: true,
});

export const insertApiAnalyticsSchema = createInsertSchema(apiAnalytics).omit({
  id: true,
  timestamp: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type LoginToken = typeof loginTokens.$inferSelect;
export type InsertLoginToken = z.infer<typeof insertLoginTokenSchema>;
export type AutomationLog = typeof automationLogs.$inferSelect;
export type InsertAutomationLog = z.infer<typeof insertAutomationLogSchema>;
export type CustomChain = typeof customChains.$inferSelect;
export type InsertCustomChain = z.infer<typeof insertCustomChainSchema>;
export type ApiAnalytics = typeof apiAnalytics.$inferSelect;
export type InsertApiAnalytics = z.infer<typeof insertApiAnalyticsSchema>;
