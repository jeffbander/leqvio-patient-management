// ============================================
// PASTE THIS CODE INTO YOUR AMBIENT DICTATION APP
// ============================================

// Configuration - Direct AIGENTS API endpoint (same as used in Providerloop Chains)
const AIGENTS_API_URL = "https://start-chain-run-943506065004.us-central1.run.app";

// Main function - Call this with your transcribed text
async function sendToProviderloop(transcriptText) {
  console.log("[Providerloop] Processing transcript...");
  
  // Step 1: Extract patient info
  const patientInfo = extractPatientInfo(transcriptText);
  console.log("[Providerloop] Extracted:", patientInfo);
  
  // Step 2: Check if we got everything
  if (!patientInfo.sourceId) {
    // Missing info - ask user
    alert("Could not extract complete patient information from transcript.\n\nFound:\n" +
          `First Name: ${patientInfo.firstName || 'Missing'}\n` +
          `Last Name: ${patientInfo.lastName || 'Missing'}\n` +
          `DOB: ${patientInfo.dob || 'Missing'}`);
    
    // Get missing info from user
    if (!patientInfo.firstName) {
      patientInfo.firstName = prompt("Enter patient's first name:");
      if (!patientInfo.firstName) return; // User cancelled
    }
    
    if (!patientInfo.lastName) {
      patientInfo.lastName = prompt("Enter patient's last name:");
      if (!patientInfo.lastName) return; // User cancelled
    }
    
    if (!patientInfo.dob) {
      patientInfo.dob = prompt("Enter patient's date of birth (MM/DD/YYYY):");
      if (!patientInfo.dob) return; // User cancelled
    }
    
    // Generate source ID
    const dobFormatted = patientInfo.dob.replace(/\//g, '_');
    patientInfo.sourceId = `${patientInfo.lastName}_${patientInfo.firstName}__${dobFormatted}`;
  }
  
  // Step 3: Send directly to AIGENTS API (same as Providerloop Chains does)
  try {
    const response = await fetch(AIGENTS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        run_email: "jeffrey.Bander@providerloop.com",
        chain_to_run: "QuickAddQHC", // Change this to different chain if needed
        human_readable_record: "Ambient dictation transcript from external app",
        source_id: patientInfo.sourceId,
        first_step_user_input: "",
        starting_variables: {
          ambient_transcript: transcriptText,
          transcription_source: "ambient_dictation_app",
          patient_first_name: patientInfo.firstName,
          patient_last_name: patientInfo.lastName,
          patient_dob: patientInfo.dob,
          Patient_ID: patientInfo.sourceId,
          timestamp: new Date().toISOString()
        }
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      // Success! Extract the Chain Run ID from AIGENTS response
      let chainRunId = result.ChainRun_ID || null;
      
      // Fallback to AppSheet response structure if needed
      if (!chainRunId && result.responses && result.responses[0] && result.responses[0].rows) {
        const firstRow = result.responses[0].rows[0];
        chainRunId = firstRow["Run_ID"] || firstRow["_RowNumber"] || firstRow["ID"] || 
                     firstRow["Run_Auto_Key"] || firstRow["Chain_Run_Key"] || firstRow.id;
      }
      
      const viewUrl = `https://aigents-realtime-logs-943506065004.us-central1.run.app/?chainRunId=${chainRunId}`;
      alert(`✓ Success! Patient ${patientInfo.firstName} ${patientInfo.lastName} submitted.\n\nChain Run ID: ${chainRunId}\n\nView logs at:\n${viewUrl}`);
      console.log("[Providerloop] Success! View at:", viewUrl);
      return { success: true, chainRunId, viewUrl };
    } else {
      throw new Error(result.error || result.message || 'Failed to trigger chain');
    }
  } catch (error) {
    alert(`Error: ${error.message}`);
    console.error("[Providerloop] Error:", error);
    return { success: false, error: error.message };
  }
}

// Helper function to extract patient info from text
function extractPatientInfo(text) {
  const info = {
    firstName: null,
    lastName: null,
    dob: null,
    sourceId: null
  };
  
  // Try to find patient name
  const namePatterns = [
    /patient (?:is |named? )?([A-Z][a-z]+)\s+([A-Z][a-z]+)/i,
    /treating ([A-Z][a-z]+)\s+([A-Z][a-z]+)/i,
    /(?:mr\.|mrs\.|ms\.|miss|doctor|dr\.) ([A-Z][a-z]+)\s+([A-Z][a-z]+)/i,
    /name is ([A-Z][a-z]+)\s+([A-Z][a-z]+)/i,
    /for ([A-Z][a-z]+)\s+([A-Z][a-z]+)/i,
    /patient ([A-Z][a-z]+)\s+([A-Z][a-z]+)/i
  ];
  
  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match) {
      info.firstName = match[1];
      info.lastName = match[2];
      break;
    }
  }
  
  // Try to find date of birth
  const dobPatterns = [
    /(?:born|dob|date of birth)[:\s]+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i,
    /(?:born|dob|date of birth)[:\s]+(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i,
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/
  ];
  
  for (const pattern of dobPatterns) {
    const match = text.match(pattern);
    if (match) {
      if (match[0].match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/)) {
        // Numeric format
        info.dob = `${match[1].padStart(2,'0')}/${match[2].padStart(2,'0')}/${match[3]}`;
      } else {
        // Month name format
        const months = ['january','february','march','april','may','june',
                       'july','august','september','october','november','december'];
        const monthNum = months.findIndex(m => match[1].toLowerCase().startsWith(m)) + 1;
        if (monthNum > 0) {
          info.dob = `${monthNum.toString().padStart(2,'0')}/${match[2].padStart(2,'0')}/${match[3]}`;
        }
      }
      break;
    }
  }
  
  // Generate source ID if we have all info
  if (info.firstName && info.lastName && info.dob) {
    const dobFormatted = info.dob.replace(/\//g, '_');
    info.sourceId = `${info.lastName}_${info.firstName}__${dobFormatted}`;
  }
  
  return info;
}

// ============================================
// HOW TO USE THIS CODE:
// ============================================
// 
// 1. Copy this entire code into your ambient dictation app
// 
// 2. Call sendToProviderloop() with your transcribed text:
//
//    Example:
//    const transcript = "I'm seeing patient John Smith today. He was born on March 15th, 1985.";
//    await sendToProviderloop(transcript);
//
// 3. The function will:
//    - Extract patient name and DOB automatically
//    - Ask user for any missing information
//    - Send to Providerloop Chains
//    - Show success/error message
//    - Return result with chain run ID
//
// 4. To use a different chain, change "QuickAddQHC" to one of:
//    - "ATTACHMENT PROCESSING (LABS)"
//    - "ATTACHMENT PROCESSING (SLEEP STUDY)"
//    - "REFERRAL PROCESSING"
//    - "CLIENT REPORT SENT"
//    - "SLEEP STUDY RESULTS"
//
// ============================================