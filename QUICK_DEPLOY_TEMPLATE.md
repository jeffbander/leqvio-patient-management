# Quick Deploy Template for AIGENTS Integration

## 1. Create New Replit App

Create a new Node.js Replit and add these files:

### package.json
```json
{
  "name": "aigents-integration-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "start": "NODE_ENV=production node dist/index.js"
  },
  "dependencies": {
    "@neondatabase/serverless": "^0.10.4",
    "drizzle-orm": "^0.30.0",
    "express": "^4.19.0",
    "multer": "^1.4.5",
    "tsx": "^4.7.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/multer": "^1.4.11",
    "@types/node": "^20.11.0"
  }
}
```

### server/index.js
```javascript
import express from 'express';
import { setupAIGENTSRoutes } from '../aigents-integration-package.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// Setup AIGENTS routes
setupAIGENTSRoutes(app);

// Simple test page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>AIGENTS Integration</title>
        <script src="/aigents-integration-package.js"></script>
    </head>
    <body>
        <h1>AIGENTS Integration Ready</h1>
        <p>Webhook endpoint: <code>/webhook/agents</code></p>
        <p>Test the automation trigger below:</p>
        
        <div id="form-container"></div>
        
        <script>
            document.getElementById('form-container').innerHTML = createSimpleAIGENTSForm();
        </script>
    </body>
    </html>
  `);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/webhook/agents`);
});
```

### public/aigents-integration-package.js
Copy the contents of `aigents-integration-package.js` from this project.

## 2. Environment Setup

Add to your Replit Secrets:
```
DATABASE_URL=your_postgresql_connection_string
```

## 3. Database Setup (Optional)

If you want to store logs, create these tables:

```sql
CREATE TABLE automation_logs (
  id SERIAL PRIMARY KEY,
  chain_name TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL,
  response TEXT,
  unique_id TEXT,
  webhook_payload JSONB,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 4. AIGENTS Webhook Configuration

Point your AIGENTS system to:
```
https://your-replit-app.replit.app/webhook/agents
```

## 5. Usage Examples

### Trigger Automation (Frontend)
```javascript
const result = await triggerAIGENTSAutomation({
  chainToRun: "Pre Pre chart",
  sourceId: "Smith_John__01_15_1980",
  firstStepInput: "Patient has chest pain"
});

console.log('Chain Run ID:', result.chainRunId);
```

### Handle Webhook (Backend)
The webhook endpoint automatically handles incoming AIGENTS responses and returns the required format.

## 6. Customization

### Change Email
```javascript
const result = await triggerAIGENTSAutomation({
  email: "your-email@domain.com",
  chainToRun: "Your Chain Name"
});
```

### Add Custom Storage
```javascript
const storage = {
  createAutomationLog: async (data) => {
    // Your custom storage logic
  },
  updateAutomationLogWithAgentResponse: async (id, response, name, payload) => {
    // Your custom update logic
  }
};

setupAIGENTSRoutes(app, storage);
```

This template gives you a complete AIGENTS integration in under 10 minutes!