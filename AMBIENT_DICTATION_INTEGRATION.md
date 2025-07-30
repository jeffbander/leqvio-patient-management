# Ambient Dictation Integration Guide for Providerloop Chains

This guide shows how to integrate your ambient dictation app with Providerloop Chains to automatically extract patient information and trigger AIGENTS automations.

## Overview

Your ambient dictation app can send patient data to Providerloop Chains, which will:
- Extract patient information (name, DOB) from transcribed text
- Generate the patient Source ID
- Trigger AIGENTS automation chains
- Log all activities in Providerloop Chains

## Integration Flow

```
Ambient Dictation App → Extract Patient Info → Generate Source ID → Trigger Chain → Log in Providerloop
                          ↓ (if extraction fails)
                        Ask User for Info
```

## Step 1: Extract Patient Information from Text

Add this function to your ambient dictation app to extract patient details:

```javascript
function extractPatientInfo(transcriptText) {
  // Patterns to match patient information
  const patterns = {
    // Name patterns
    namePatterns: [
      /patient (?:is |named? )?([A-Z][a-z]+)\s+([A-Z][a-z]+)/i,
      /treating ([A-Z][a-z]+)\s+([A-Z][a-z]+)/i,
      /(?:mr\.|mrs\.|ms\.|miss|doctor|dr\.) ([A-Z][a-z]+)\s+([A-Z][a-z]+)/i,
      /name is ([A-Z][a-z]+)\s+([A-Z][a-z]+)/i,
      /([A-Z][a-z]+)\s+([A-Z][a-z]+),?\s+(?:born|dob|date of birth)/i
    ],
    
    // Date patterns
    dobPatterns: [
      /(?:born|dob|date of birth)[:\s]+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i,
      /(?:born|dob|date of birth)[:\s]+(\w+)\s+(\d{1,2}),?\s+(\d{4})/i,
      /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
      /(\w+)\s+(\d{1,2}),?\s+(\d{4})/
    ]
  };

  let patientInfo = {
    firstName: null,
    lastName: null,
    dob: null,
    sourceId: null
  };

  // Try to extract name
  for (const pattern of patterns.namePatterns) {
    const match = transcriptText.match(pattern);
    if (match) {
      patientInfo.firstName = match[1];
      patientInfo.lastName = match[2];
      break;
    }
  }

  // Try to extract DOB
  for (const pattern of patterns.dobPatterns) {
    const match = transcriptText.match(pattern);
    if (match) {
      // Convert to MM/DD/YYYY format
      if (match[0].includes('/') || match[0].includes('-')) {
        // Numeric date
        const month = match[1].padStart(2, '0');
        const day = match[2].padStart(2, '0');
        const year = match[3].length === 2 ? '20' + match[3] : match[3];
        patientInfo.dob = `${month}/${day}/${year}`;
      } else {
        // Month name format
        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                          'july', 'august', 'september', 'october', 'november', 'december'];
        const monthNum = monthNames.findIndex(m => match[1].toLowerCase().startsWith(m)) + 1;
        if (monthNum > 0) {
          const month = monthNum.toString().padStart(2, '0');
          const day = match[2].padStart(2, '0');
          const year = match[3];
          patientInfo.dob = `${month}/${day}/${year}`;
        }
      }
      break;
    }
  }

  // Generate source ID if we have all info
  if (patientInfo.firstName && patientInfo.lastName && patientInfo.dob) {
    // Convert DOB to source ID format (MM_DD_YYYY)
    const dobFormatted = patientInfo.dob.replace(/\//g, '_');
    patientInfo.sourceId = `${patientInfo.lastName}_${patientInfo.firstName}__${dobFormatted}`;
  }

  return patientInfo;
}
```

## Step 2: Ask User for Missing Information

If extraction fails, prompt the user:

```javascript
async function getPatientInfoFromUser(existingInfo = {}) {
  // Example using browser prompts (replace with your UI)
  const patientInfo = {
    firstName: existingInfo.firstName,
    lastName: existingInfo.lastName,
    dob: existingInfo.dob
  };

  if (!patientInfo.firstName) {
    patientInfo.firstName = prompt("Enter patient's first name:");
  }
  
  if (!patientInfo.lastName) {
    patientInfo.lastName = prompt("Enter patient's last name:");
  }
  
  if (!patientInfo.dob) {
    patientInfo.dob = prompt("Enter patient's date of birth (MM/DD/YYYY):");
  }

  // Generate source ID
  if (patientInfo.firstName && patientInfo.lastName && patientInfo.dob) {
    const dobFormatted = patientInfo.dob.replace(/\//g, '_');
    patientInfo.sourceId = `${patientInfo.lastName}_${patientInfo.firstName}__${dobFormatted}`;
  }

  return patientInfo;
}
```

## Step 3: Trigger AIGENTS Chain

Send the data to Providerloop Chains API:

```javascript
async function triggerAIGENTSChain(patientInfo, transcriptText, chainName = "QuickAddQHC") {
  // Direct AIGENTS API endpoint (same as Providerloop Chains uses)
  const AIGENTS_API_URL = "https://start-chain-run-943506065004.us-central1.run.app";
  
  try {
    const response = await fetch(AIGENTS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        // Required fields for AIGENTS
        run_email: "jeffrey.Bander@providerloop.com",
        chain_to_run: chainName,
        human_readable_record: "Ambient dictation transcript from external app",
        source_id: patientInfo.sourceId,
        first_step_user_input: "",
        
        // Additional variables for the chain
        starting_variables: {
          ambient_transcript: transcriptText,
          transcription_source: "ambient_dictation_app",
          patient_first_name: patientInfo.firstName,
          patient_last_name: patientInfo.lastName,
          patient_dob: patientInfo.dob,
          timestamp: new Date().toISOString()
        }
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      // Extract Chain Run ID from AIGENTS response
      let chainRunId = result.ChainRun_ID || null;
      
      // Fallback to AppSheet response structure if needed
      if (!chainRunId && result.responses && result.responses[0] && result.responses[0].rows) {
        const firstRow = result.responses[0].rows[0];
        chainRunId = firstRow["Run_ID"] || firstRow["_RowNumber"] || firstRow["ID"] || 
                     firstRow["Run_Auto_Key"] || firstRow["Chain_Run_Key"] || firstRow.id;
      }
      
      return {
        success: true,
        chainRunId: chainRunId,
        message: `Chain ${chainName} triggered successfully`,
        viewUrl: `https://aigents-realtime-logs-943506065004.us-central1.run.app/?chainRunId=${chainRunId}`
      };
    } else {
      throw new Error(result.error || result.message || 'Failed to trigger chain');
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
```

## Step 4: Complete Integration Example

Here's how to put it all together in your ambient dictation app:

```javascript
// Main function to process ambient dictation
async function processAmbientDictation(transcriptText) {
  console.log("Processing transcript:", transcriptText);
  
  // Step 1: Try to extract patient info automatically
  let patientInfo = extractPatientInfo(transcriptText);
  
  // Step 2: If extraction incomplete, ask user
  if (!patientInfo.sourceId) {
    console.log("Could not extract complete patient info, asking user...");
    
    // Show what was extracted
    if (patientInfo.firstName || patientInfo.lastName || patientInfo.dob) {
      console.log("Partially extracted:", patientInfo);
    }
    
    // Get missing info from user
    patientInfo = await getPatientInfoFromUser(patientInfo);
    
    // Check if user provided all info
    if (!patientInfo.sourceId) {
      console.error("Cannot proceed without patient information");
      return;
    }
  }
  
  console.log("Patient info:", patientInfo);
  
  // Step 3: Trigger the chain
  const result = await triggerAIGENTSChain(
    patientInfo, 
    transcriptText,
    "QuickAddQHC" // or any other chain name
  );
  
  // Step 4: Handle the result
  if (result.success) {
    console.log("✓ Chain triggered successfully!");
    console.log("Chain Run ID:", result.chainRunId);
    console.log("View logs at:", result.viewUrl);
    
    // Optional: Show success to user
    alert(`Patient ${patientInfo.firstName} ${patientInfo.lastName} submitted successfully!`);
  } else {
    console.error("✗ Failed to trigger chain:", result.error);
    alert(`Error: ${result.error}`);
  }
}

// Example usage
const sampleTranscript = `
  I'm seeing patient John Smith today. He was born on March 15th, 1985. 
  He's here for his annual checkup and reports feeling well overall.
`;

processAmbientDictation(sampleTranscript);
```

## Available Chain Options

You can trigger any of these chains by changing the `chainName` parameter:

- `"QuickAddQHC"` - Quick patient registration
- `"ATTACHMENT PROCESSING (LABS)"` - Lab results processing
- `"ATTACHMENT PROCESSING (SLEEP STUDY)"` - Sleep study processing
- `"ATTACHMENT PROCESSING (RESEARCH STUDY)"` - Research study processing
- `"REFERRAL PROCESSING"` - Referral processing
- `"CLIENT REPORT SENT"` - Client report generation
- `"SLEEP STUDY RESULTS"` - Sleep study results

## Error Handling

Handle common errors gracefully:

```javascript
async function processWithErrorHandling(transcriptText) {
  try {
    await processAmbientDictation(transcriptText);
  } catch (error) {
    console.error("Processing error:", error);
    
    // Network error
    if (!navigator.onLine) {
      alert("No internet connection. Please try again when connected.");
      return;
    }
    
    // API error
    if (error.message.includes("Failed to trigger")) {
      alert("Could not connect to Providerloop Chains. Please try again later.");
      return;
    }
    
    // Generic error
    alert("An error occurred. Please check the console for details.");
  }
}
```

## Testing Your Integration

1. **Test extraction patterns**:
```javascript
const testCases = [
  "Patient is John Smith, born 01/15/1980",
  "Treating Mary Johnson, DOB 12-25-1975",
  "Mr. Robert Davis was born on June 3rd, 1990",
  "The patient Sarah Williams date of birth is 09/08/1985"
];

testCases.forEach(text => {
  const info = extractPatientInfo(text);
  console.log("Test:", text);
  console.log("Result:", info);
  console.log("---");
});
```

2. **Test with your Providerloop Chains instance**:
   - Replace `PROVIDERLOOP_API_URL` with your actual Replit app URL
   - Verify chains are triggered in the Providerloop logs page
   - Check the AIGENTS realtime logs dashboard

## Security Considerations

1. **CORS**: Ensure your Providerloop Chains app allows requests from your ambient dictation app domain
2. **Authentication**: Consider adding API key authentication if needed
3. **Data Privacy**: Patient data is sensitive - use HTTPS and don't log sensitive information
4. **Rate Limiting**: Implement rate limiting to prevent abuse

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Extraction fails | Check transcript format, add more extraction patterns |
| API returns 404 | Verify the Providerloop Chains URL is correct |
| Chain not triggering | Check chain name matches exactly (case-sensitive) |
| No logs appearing | Verify the chain_run_id is being returned |

## Next Steps

1. Customize the extraction patterns for your specific use case
2. Replace the basic prompts with your app's UI components
3. Add more sophisticated error handling
4. Consider batch processing for multiple patients
5. Add webhook support to get chain completion notifications

For support or questions, refer to the main Providerloop Chains documentation.