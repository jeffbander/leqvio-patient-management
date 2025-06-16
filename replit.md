# AIGENTS Automations

## Overview
Intelligent web application for AIGENTS Automations, designed to streamline complex workflow processes with user-friendly and visually engaging interfaces. The system provides bidirectional webhook communication between AppSheet automations and agents systems.

## Recent Changes
- **2025-06-15**: Deployed application to https://chain-automator-notifications6.replit.app
- **2025-06-15**: Added comprehensive logging system for webhook debugging
- **2025-06-15**: Configured agents system webhook with response mapping (String and Object types)
- **2025-06-15**: Implemented agent webhook endpoint `/webhook/agents` for receiving responses from agents system
- **2025-06-15**: Added database fields for agent responses: `agent_response`, `agent_name`, `agent_received_at`
- **2025-06-15**: Updated frontend to display agent responses in green-styled sections
- **2025-06-15**: Successfully tested webhook with ChainRun_ID 9aff4ab8 integration

## Current Issue - RESOLVED
- ✓ Fixed webhook routing issue causing HTML responses instead of JSON
- ✓ Moved webhook routes to top of registration order to prevent frontend catch-all override
- ✓ Fixed field mapping to accept agents system field names: `"Chain Run ID"` → `chainRunId`, `summ` → `agentResponse`
- ✓ Removed validation requirement allowing flexible webhook payloads
- ✓ Webhook successfully tested with ChainRun_ID 1a2470b2 using exact AppSheet field names
- ✓ 400 Bad Request errors resolved - agents system webhooks now process with 200 OK responses
- Agents system can now send webhooks with proper field mapping

## Project Architecture

### Frontend
- React with TypeScript
- Tailwind CSS for styling
- TanStack React Query for data management
- Wouter for routing
- Direct access (no authentication required)

### Backend
- Express.js server
- PostgreSQL database with Drizzle ORM
- Webhook endpoints for bidirectional communication

### Webhook System
- **Email Webhook**: `/api/email-webhook` - Receives AppSheet automation responses via email
- **Agent Webhook**: `/webhook/agents` - Receives agent system responses via HTTP POST
- **ChainRun_ID Tracking**: Unique identifier linking all automation components

### Database Schema
- `automation_logs`: Stores automation data, email responses, and agent responses
- `custom_chains`: Stores reusable automation configurations
- `users`: User management (currently unused - direct access)
- `login_tokens`: Token-based authentication (currently unused)

## User Preferences
- Prefers simple, everyday language
- Needs clear webhook configuration examples
- Focuses on bidirectional communication workflow
- Values working end-to-end automation testing

## Webhook Configuration Details

### Agent Webhook Endpoint
- **URL**: `https://[your-domain]/webhook/agents`
- **Method**: POST
- **Content-Type**: application/json

### Required Fields
- `chainRunId`: Unique identifier from automation (required)
- `agentResponse`: Agent's response content (required)
- `agentName`: Name of responding agent (optional)
- `timestamp`: Response timestamp (optional)

### Example Payload
```json
{
  "chainRunId": "9aff4ab8",
  "agentResponse": "Agent response content here",
  "agentName": "Research Agent",
  "timestamp": "2025-06-15T14:03:08.976Z"
}
```

### Response Format
Success: `{"message": "Agent response processed successfully", "chainRunId": "9aff4ab8", "status": "success"}`
Error: `{"error": "Error message"}`