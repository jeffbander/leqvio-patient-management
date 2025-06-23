# AIGENTS Automations Template

## Overview
This is a complete template for building intelligent automation systems that connect AppSheet automations with agents systems through bidirectional webhook communication. The system provides real-time API response display and supports multiple chain types with dynamic field structures.

## Features
- **Real-time Webhook Integration**: Instant API response display without email dependency
- **Dynamic Field Mapping**: Automatically handles different chain types (research, pre_pre_chart, custom)
- **Complete Payload Storage**: Database storage for all webhook variables
- **Chain Type Detection**: Automatic identification of automation types
- **Production Ready**: Deployed and tested webhook endpoints

## Quick Start

### 1. Deploy to Replit
1. Fork this project on Replit
2. The system will automatically install dependencies
3. Configure your database (PostgreSQL is included)

### 2. Set Up Environment Variables
Required secrets (add via Replit Secrets):
```
DATABASE_URL=<automatically provided>
SENDGRID_API_KEY=<optional, for email notifications>
```

### 3. Configure Your Webhook URL
Your webhook endpoint will be:
```
https://your-repl-name.replit.app/webhook/agents
```

### 4. Test the System
1. Run the application
2. Use the built-in automation trigger form
3. Configure your agents system to send webhooks

## Webhook Configuration

### Endpoint Details
- **URL**: `https://your-domain/webhook/agents`
- **Method**: POST
- **Content-Type**: application/json

### Required Fields
- `Chain Run ID`: Unique identifier (any format)
- At least one response field (varies by chain type)

### Supported Chain Types

#### Research Chains
```json
{
  "Chain Run ID": "unique-id",
  "summ": "Research summary content",
  "Current ISO DateTime": "2025-06-23T02:00:00Z"
}
```

#### Pre Pre Chart Chains
```json
{
  "Chain Run ID": "unique-id",
  "Pre Pre Chart V2": "Quality control feedback",
  "Pre Pre Chart V3": "Final corrected chart",
  "pre_pre_output": "Detailed patient summary",
  "Current ISO DateTime": "2025-06-23T02:00:00Z"
}
```

#### Custom Chains
The system automatically handles any field structure. Include `Chain Run ID` and your custom fields.

## Architecture

### Frontend (React + TypeScript)
- Real-time automation logs display
- API payload viewer with full text support
- Form for triggering automations
- No authentication required (configurable)

### Backend (Express.js + PostgreSQL)
- Webhook endpoints for receiving agent responses
- Database storage with Drizzle ORM
- Automatic chain type detection
- Complete payload logging

### Database Schema
- `automation_logs`: Stores all automation data and responses
- `custom_chains`: Reusable automation configurations
- `users`: User management (optional)

## Customization

### Adding New Chain Types
1. The system automatically detects new chain types
2. No code changes needed for new field structures
3. Chain type is determined by field names

### Modifying the UI
- Edit `client/src/pages/automation-trigger.tsx` for main interface
- Modify `client/src/components/ui/` for component styling
- Update `client/src/index.css` for colors and themes

### Adding Authentication
Uncomment authentication code in:
- `server/routes.ts` - API protection
- `client/src/App.tsx` - Route protection
- Enable user management features

## Production Deployment

### On Replit
1. Click "Deploy" in your Repl
2. Configure custom domain (optional)
3. Update webhook URLs in your agents system

### Environment Configuration
The system automatically configures:
- Database connection
- Session management
- CORS settings
- Production optimizations

## API Reference

### Webhook Endpoint
```
POST /webhook/agents
Content-Type: application/json

{
  "Chain Run ID": "required-unique-id",
  "field1": "any content",
  "field2": "any content",
  "Current ISO DateTime": "optional-timestamp"
}
```

### Response Format
```json
{
  "message": "Agent response processed successfully",
  "chainRunId": "your-id",
  "status": "success",
  "timestamp": "2025-06-23T02:00:00Z",
  "receivedFields": ["Chain Run ID", "field1", "field2"],
  "field1": "processed-value",
  "field2": "processed-value"
}
```

### Automation Logs API
```
GET /api/automation-logs
```
Returns all automation logs with webhook payloads.

## Troubleshooting

### Common Issues
1. **Webhook not receiving data**: Check URL and ensure POST method
2. **Field mapping issues**: Verify field names match your agents system
3. **Database errors**: Ensure DATABASE_URL is configured

### Debug Mode
Enable logging by checking browser console and server logs for webhook processing details.

## Contributing
This template is designed to be easily customizable. Fork and modify according to your automation needs.

## License
Open source template for automation systems.