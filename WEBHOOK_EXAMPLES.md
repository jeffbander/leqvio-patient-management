# Webhook Examples and Testing

## Testing Your Webhook

### Using curl
```bash
# Test with research chain data
curl -X POST "https://your-project.replit.app/webhook/agents" \
  -H "Content-Type: application/json" \
  -d '{
    "Chain Run ID": "test-123",
    "summ": "This is a test research summary",
    "Current ISO DateTime": "2025-06-23T02:00:00Z"
  }'

# Test with pre pre chart data
curl -X POST "https://your-project.replit.app/webhook/agents" \
  -H "Content-Type: application/json" \
  -d '{
    "Chain Run ID": "chart-456",
    "Pre Pre Chart V2": "Quality control feedback",
    "Pre Pre Chart V3": "Final corrected chart",
    "pre_pre_output": "Detailed patient summary",
    "Current ISO DateTime": "2025-06-23T02:00:00Z"
  }'
```

### Expected Response
```json
{
  "message": "Agent response processed successfully",
  "chainRunId": "test-123",
  "status": "success",
  "timestamp": "2025-06-23T02:00:00Z",
  "receivedFields": ["Chain Run ID", "summ", "Current ISO DateTime"],
  "receivedFields_0": "Chain Run ID",
  "chain_run_id": "test-123",
  "receivedFields_1": "summ", 
  "summ": "This is a test research summary",
  "receivedFields_2": "Current ISO DateTime",
  "current_iso_datetime": "2025-06-23T02:00:00Z"
}
```

## Example Payloads by Chain Type

### Research Chain
```json
{
  "Chain Run ID": "research-001",
  "summ": "Comprehensive analysis of market trends shows 15% growth in Q4 with primary drivers being increased consumer spending and supply chain improvements.",
  "Current ISO DateTime": "2025-06-23T14:30:00Z"
}
```

### Pre Pre Chart Chain
```json
{
  "Chain Run ID": "chart-002", 
  "Pre Pre Chart V2": "Review needed: Medication dosage should be verified against patient weight. Consider drug interactions with current prescriptions.",
  "Pre Pre Chart V3": "Patient: Smith, John (MRN: 123456)\n- Last visit: 2025-06-20\n- Current medications: Verified and updated\n- Next appointment: 2025-07-01",
  "pre_pre_output": "Complete chart review completed. All medications verified, no contraindications found. Patient education provided regarding new treatment plan.",
  "Current ISO DateTime": "2025-06-23T14:30:00Z"
}
```

### Custom Business Process Chain
```json
{
  "Chain Run ID": "process-003",
  "approval_status": "approved",
  "processed_documents": "Contract_v2.pdf, Amendment_A.pdf",
  "final_output": "All documents reviewed and approved. Legal team sign-off complete. Ready for execution.",
  "reviewer_notes": "Standard contract terms verified. Amendment addresses scope changes appropriately.",
  "Current ISO DateTime": "2025-06-23T14:30:00Z"
}
```

### Educational Content Chain
```json
{
  "Chain Run ID": "edu-004",
  "lesson_summary": "Introduction to Machine Learning concepts including supervised, unsupervised, and reinforcement learning paradigms.",
  "key_concepts": "Neural networks, decision trees, clustering algorithms, feature engineering",
  "assessment_ready": "true",
  "content_level": "intermediate",
  "Current ISO DateTime": "2025-06-23T14:30:00Z"
}
```

## Integration Examples

### Python Integration
```python
import requests
import json
from datetime import datetime

def send_automation_result(chain_id, result_data):
    webhook_url = "https://your-project.replit.app/webhook/agents"
    
    payload = {
        "Chain Run ID": chain_id,
        "Current ISO DateTime": datetime.now().isoformat() + "Z",
        **result_data  # Add your custom fields
    }
    
    response = requests.post(
        webhook_url,
        headers={"Content-Type": "application/json"},
        data=json.dumps(payload)
    )
    
    return response.json()

# Usage example
result = send_automation_result("py-test-001", {
    "analysis_result": "Data processing complete",
    "confidence_score": "0.95",
    "recommendations": "Implement suggested changes"
})
```

### JavaScript/Node.js Integration
```javascript
async function sendWebhookResult(chainId, resultData) {
    const webhookUrl = "https://your-project.replit.app/webhook/agents";
    
    const payload = {
        "Chain Run ID": chainId,
        "Current ISO DateTime": new Date().toISOString(),
        ...resultData
    };
    
    const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
    });
    
    return await response.json();
}

// Usage example
const result = await sendWebhookResult("js-test-001", {
    processing_status: "completed",
    output_file: "results_2025-06-23.csv", 
    summary: "1,247 records processed successfully"
});
```

### AppSheet Integration
Set up AppSheet to call your webhook URL with automation results:

```
Webhook URL: https://your-project.replit.app/webhook/agents
Method: POST
Headers: Content-Type: application/json
Body Template:
{
  "Chain Run ID": "<<ChainRunID>>",
  "automation_result": "<<AutomationOutput>>",
  "status": "<<ProcessingStatus>>",
  "Current ISO DateTime": "<<UTCNOW()>>"
}
```

## Troubleshooting Webhook Issues

### Common Problems

1. **400 Bad Request**
   - Check JSON formatting
   - Ensure Content-Type header is set
   - Verify required fields are present

2. **Field Not Appearing in UI**
   - Check field names for special characters
   - Verify JSON structure is valid
   - Ensure webhook payload is being stored

3. **Timeout Issues**
   - Webhook endpoint has 30-second timeout
   - For long-running processes, send results asynchronously
   - Use chunked responses for large payloads

### Debug Mode
Enable debug logging by checking the browser console and server logs when sending webhooks.

## Best Practices

### Field Naming
- Use consistent naming conventions
- Avoid special characters in field names  
- Include descriptive field names for better UI display

### Payload Size
- Keep payloads under 1MB for optimal performance
- For large content, consider splitting into multiple requests
- Use compression for text-heavy payloads

### Error Handling
- Always check webhook response status
- Implement retry logic for failed requests
- Log webhook attempts for debugging

### Security
- Use HTTPS for all webhook communications
- Consider adding API key authentication if needed
- Validate payload structure before processing