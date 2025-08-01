# AIGENTS Webhook Configuration Guide

## Current Issue
Your AIGENTS chain is sending webhooks but without detailed response data. Here's how to configure it to include comprehensive results.

## Enhanced Webhook Handler
✅ **Updated**: The webhook handler now tries to capture response data from these fields:
- `agentResponse`, `summ`, `summary`, `response`, `content`, `result`, `output`
- `Pre Pre Chart V2`, `Pre_Pre_Chart_V2`, `chainOutput`, `automationResult`  
- `Chain_Output`, `Run_Output`, `Final_Output`, `Generated_Content`
- `Patient_Summary`, `Clinical_Summary`, `Analysis_Result`, `Processing_Result`

## AIGENTS Configuration Steps

### 1. Chain Output Configuration
In your **LEQVIO_app** chain settings:

```
Chain Settings → Output Configuration:
☑️ Include Chain Output in Webhook
☑️ Include Step Outputs in Webhook
☑️ Include Variables in Webhook
☑️ Include AI Generated Content in Webhook
```

### 2. Webhook URL Setup
Set your webhook endpoint to:
```
https://your-replit-app.replit.app/webhook/agents
Method: POST
Content-Type: application/json
```

### 3. Response Field Mapping
Configure AIGENTS to send response data in these fields:

**Option A - Standard Fields:**
```json
{
  "Chain Run ID": "0f3aa4f4",
  "agentResponse": "[Your AI generated content here]",
  "summ": "[Summary of processing results]",
  "Patient_Summary": "[Patient-specific results]"
}
```

**Option B - Custom Output Variables:**
Create output variables in your chain:
- `Final_Output` - Main results
- `Clinical_Summary` - Clinical findings  
- `Processing_Result` - Automation outcome
- `Generated_Content` - AI generated text

### 4. Chain Step Configuration
Make sure your final chain step:
1. **Captures AI outputs** into variables
2. **Includes output variables** in webhook payload
3. **Sets webhook trigger** on completion

## Testing the Configuration

### 1. Run a Test Chain
Trigger your LEQVIO_app chain with test data

### 2. Check Webhook Logs
Look for these log messages:
```
[AIGENTS-WEBHOOK-xxx] Found response data in field: agentResponse
[AIGENTS-WEBHOOK-xxx] All received fields: [field1, field2, ...]
[AIGENTS-WEBHOOK-xxx] Agent Response Length: 1250 chars
```

### 3. View Results
- Go to patient detail page
- Click "View AIGENTS Data" 
- Check if detailed response appears in modal

## Common AIGENTS Field Names
The webhook handler will automatically detect these field patterns:
- Any field containing "response", "output", "result", "summary"
- Fields ending in "_Output", "_Result", "_Summary"  
- AI-generated content fields
- Chain step output variables

## Troubleshooting

### If Still Getting "No Response Content":
1. **Check AIGENTS logs** - Is the chain actually completing?
2. **Verify webhook URL** - Is AIGENTS sending to the right endpoint?
3. **Check field names** - Are output variables being created?
4. **Enable debug mode** - Turn on detailed AIGENTS logging

### If Getting Partial Data:
1. **Check field mapping** - Are all outputs included in webhook?
2. **Review chain steps** - Are variables being passed between steps?
3. **Test output variables** - Manually check variable values in AIGENTS

## Next Steps
1. Configure AIGENTS chain output settings
2. Run a test patient through the chain
3. Check webhook logs for detailed response data
4. View results in patient detail page

The enhanced webhook handler will now capture much more detailed response data automatically!