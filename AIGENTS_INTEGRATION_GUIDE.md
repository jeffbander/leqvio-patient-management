# AIGENTS Platform Integration Guide

This guide shows how to integrate the automation trigger and webhook functionality from this app into any other Replit project for your AIGENTS platform.

## Quick Setup

### 1. Copy Core Files

Copy these files from this project to your new Replit app:

**Backend Files:**
- `server/routes.ts` (webhook endpoints)
- `server/storage.ts` (database operations)
- `shared/schema.ts` (database schema)

**Frontend Files:**
- `client/src/pages/automation-trigger.tsx` (trigger form)
- `client/src/pages/logs.tsx` (logs viewer)

### 2. Database Schema Setup

Add to your database schema:

```sql
-- Automation logs table
CREATE TABLE automation_logs (
  id SERIAL PRIMARY KEY,
  chain_name TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL,
  response TEXT,
  request_data JSONB,
  unique_id TEXT,
  email_response TEXT,
  email_received_at TIMESTAMP,
  agent_response TEXT,
  agent_name TEXT,
  agent_received_at TIMESTAMP,
  webhook_payload JSONB,
  chain_type TEXT,
  is_completed BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Custom chains table (optional)
CREATE TABLE custom_chains (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Or use Drizzle push: `npm run db:push`

### 3. Environment Variables

Set these in your new Replit:

```bash
DATABASE_URL=your_postgres_connection_string
```

### 4. Package Dependencies

Install required packages:

```bash
npm install @neondatabase/serverless drizzle-orm drizzle-zod zod multer
npm install --save-dev @types/multer drizzle-kit
```

## Integration Options

### Option A: Complete Integration
Copy all files and get the full automation trigger + logs system.

### Option B: API Only
Just copy the webhook endpoints for receiving AIGENTS responses:

```typescript
// Minimal webhook integration
app.post('/webhook/agents', async (req, res) => {
  try {
    const { chainRunId, agentResponse, agentName } = req.body;
    
    // Your custom logic here
    console.log('Received from AIGENTS:', {
      chainRunId,
      agentResponse,
      agentName
    });
    
    res.json({
      message: "Agent response processed successfully",
      chainRunId,
      status: "success"
    });
  } catch (error) {
    res.status(500).json({ error: "Processing failed" });
  }
});
```

### Option C: Trigger Only
Just copy the automation trigger form to send requests to AIGENTS:

```typescript
const triggerAutomation = async (data) => {
  const response = await fetch("https://start-chain-run-943506065004.us-central1.run.app", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      run_email: "jeffrey.Bander@providerloop.com",
      chain_to_run: data.chain_to_run,
      human_readable_record: "external app",
      source_id: data.source_id,
      first_step_user_input: data.first_step_user_input,
      starting_variables: data.starting_variables
    })
  });
  
  return response.json();
};
```

## Webhook Configuration

Configure your AIGENTS system to send responses to:

```
POST https://your-new-replit-app.replit.app/webhook/agents
Content-Type: application/json

{
  "Chain Run ID": "your-chain-run-id",
  "agentResponse": "agent response content",
  "agentName": "Agent Name",
  "Current ISO DateTime": "2025-06-26T12:00:00Z"
}
```

## Customization

### Update Email Address
Change the email in automation trigger:

```typescript
const requestBody = {
  run_email: "your-email@domain.com", // Update this
  // ... other fields
};
```

### Custom Chain Types
Add your chain types to the dropdown:

```typescript
const CHAIN_OPTIONS = [
  { value: "YOUR_CHAIN_1", label: "Your Chain 1" },
  { value: "YOUR_CHAIN_2", label: "Your Chain 2" },
  // Add your chains here
];
```

### Custom Fields
Add additional fields to the automation trigger form by updating the schema:

```typescript
const automationFormSchema = z.object({
  // Existing fields
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  
  // Add your custom fields
  your_custom_field: z.string().optional(),
});
```

## Testing

1. **Test Automation Trigger**: Submit the form and verify the API call
2. **Test Webhook**: Send a POST request to `/webhook/agents` 
3. **Test Logs**: Check that logs are being stored and displayed

## Support

This integration uses the same patterns as the current Providerloop Chains app. Refer to the source code for detailed implementation examples.

## Quick Start Template

Want a minimal template? I can create a simplified version with just the essential AIGENTS integration code.