// Quick script to check debug logs
import https from 'https';

const options = {
  hostname: 'chain-automator-notifications6.replit.app',
  path: '/webhook/agents/debug-logs',
  method: 'GET',
  headers: {
    'User-Agent': 'Debug-Checker/1.0'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('=== DEBUG LOGS FROM AGENTS SYSTEM ===');
      console.log(`Total requests captured: ${parsed.totalRequests}`);
      
      if (parsed.requests && parsed.requests.length > 0) {
        const latest = parsed.requests[0];
        console.log('\n=== LATEST REQUEST ===');
        console.log('Timestamp:', latest.timestamp);
        console.log('Headers:', JSON.stringify(latest.headers, null, 2));
        console.log('Body:', JSON.stringify(latest.body, null, 2));
        console.log('Content-Type:', latest.contentType);
        console.log('Body Keys:', latest.body ? Object.keys(latest.body) : 'No body');
        
        // Check for missing fields
        const body = latest.body || {};
        console.log('\n=== ANALYSIS ===');
        console.log('chainRunId present:', !!body.chainRunId);
        console.log('agentResponse present:', !!body.agentResponse);
        console.log('chainRunId value:', body.chainRunId);
        console.log('agentResponse length:', body.agentResponse ? body.agentResponse.length : 0);
      } else {
        console.log('No debug requests captured yet');
      }
    } catch (e) {
      console.log('Raw response:', data);
      console.log('Parse error:', e.message);
    }
  });
});

req.on('error', (error) => {
  console.error('Request error:', error);
});

req.end();