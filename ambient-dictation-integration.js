// Ambient Dictation Integration Module for Providerloop Chains
// Copy this file to your ambient dictation app and import the functions you need

const AIGENTS_API_URL = "https://start-chain-run-943506065004.us-central1.run.app";

// Extract patient information from transcribed text
export function extractPatientInfo(transcriptText) {
  // Patterns to match patient information
  const patterns = {
    // Name patterns - looking for first and last name
    namePatterns: [
      /patient (?:is |named? )?([A-Z][a-z]+)\s+([A-Z][a-z]+)/i,
      /treating ([A-Z][a-z]+)\s+([A-Z][a-z]+)/i,
      /(?:mr\.|mrs\.|ms\.|miss|doctor|dr\.) ([A-Z][a-z]+)\s+([A-Z][a-z]+)/i,
      /name is ([A-Z][a-z]+)\s+([A-Z][a-z]+)/i,
      /([A-Z][a-z]+)\s+([A-Z][a-z]+),?\s+(?:born|dob|date of birth)/i,
      /for ([A-Z][a-z]+)\s+([A-Z][a-z]+)/i, // "for John Smith"
      /patient ([A-Z][a-z]+)\s+([A-Z][a-z]+)/i // "patient John Smith"
    ],
    
    // Date patterns - various formats
    dobPatterns: [
      /(?:born|dob|date of birth|birthday)[:\s]+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i,
      /(?:born|dob|date of birth|birthday)[:\s]+(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i,
      /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/, // plain date format
      /(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/ // "January 15th, 1985"
    ]
  };

  let patientInfo = {
    firstName: null,
    lastName: null,
    dob: null,
    sourceId: null,
    extractionConfidence: 0
  };

  // Try to extract name
  for (const pattern of patterns.namePatterns) {
    const match = transcriptText.match(pattern);
    if (match) {
      patientInfo.firstName = match[1].trim();
      patientInfo.lastName = match[2].trim();
      patientInfo.extractionConfidence += 0.5;
      break;
    }
  }

  // Try to extract DOB
  for (const pattern of patterns.dobPatterns) {
    const match = transcriptText.match(pattern);
    if (match) {
      // Convert to MM/DD/YYYY format
      if (match[0].match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/)) {
        // Numeric date format
        const month = match[1].padStart(2, '0');
        const day = match[2].padStart(2, '0');
        const year = match[3].length === 2 ? '20' + match[3] : match[3];
        patientInfo.dob = `${month}/${day}/${year}`;
        patientInfo.extractionConfidence += 0.5;
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
          patientInfo.extractionConfidence += 0.5;
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

// Trigger AIGENTS chain with patient data
export async function triggerAIGENTSChain(patientInfo, transcriptText, chainName = "QuickAddQHC") {
  if (!patientInfo.sourceId) {
    throw new Error("Cannot trigger chain without complete patient information (name and DOB)");
  }

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
          Patient_ID: patientInfo.sourceId, // Also send as Patient_ID for compatibility
          extraction_confidence: patientInfo.extractionConfidence,
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
      error: error.message || 'Network error'
    };
  }
}

// Main processing function with automatic extraction and user prompting
export async function processAmbientDictation(
  transcriptText, 
  options = {
    chainName: "QuickAddQHC",
    askUserCallback: null, // Function to call to get user input
    onSuccess: null,       // Success callback
    onError: null         // Error callback
  }
) {
  try {
    console.log("[Ambient Dictation] Processing transcript...");
    
    // Step 1: Try to extract patient info automatically
    let patientInfo = extractPatientInfo(transcriptText);
    console.log("[Ambient Dictation] Extraction result:", patientInfo);
    
    // Step 2: If extraction incomplete, ask user
    if (!patientInfo.sourceId) {
      console.log("[Ambient Dictation] Could not extract complete patient info");
      
      if (options.askUserCallback) {
        // Use custom callback to get user input
        const userInput = await options.askUserCallback(patientInfo);
        if (userInput) {
          patientInfo = {
            ...patientInfo,
            ...userInput
          };
          
          // Generate source ID with user input
          if (patientInfo.firstName && patientInfo.lastName && patientInfo.dob) {
            const dobFormatted = patientInfo.dob.replace(/\//g, '_');
            patientInfo.sourceId = `${patientInfo.lastName}_${patientInfo.firstName}__${dobFormatted}`;
          }
        }
      } else {
        // Default browser prompts (replace with your UI)
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
      }
      
      // Check if user provided all info
      if (!patientInfo.sourceId) {
        throw new Error("Cannot proceed without patient information");
      }
    }
    
    console.log("[Ambient Dictation] Final patient info:", patientInfo);
    
    // Step 3: Trigger the chain
    const result = await triggerAIGENTSChain(
      patientInfo, 
      transcriptText,
      options.chainName || "QuickAddQHC"
    );
    
    // Step 4: Handle the result
    if (result.success) {
      console.log("[Ambient Dictation] ✓ Chain triggered successfully!");
      console.log("[Ambient Dictation] Chain Run ID:", result.chainRunId);
      console.log("[Ambient Dictation] View logs at:", result.viewUrl);
      
      if (options.onSuccess) {
        options.onSuccess(result, patientInfo);
      }
      
      return result;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error("[Ambient Dictation] ✗ Error:", error.message);
    
    if (options.onError) {
      options.onError(error);
    } else {
      // Default error handling
      alert(`Error: ${error.message}`);
    }
    
    throw error;
  }
}

// Example usage for testing
export function runExample() {
  const sampleTranscript = `
    I'm seeing patient John Smith today. He was born on March 15th, 1985. 
    He's here for his annual checkup and reports feeling well overall.
    Blood pressure is 120/80, heart rate is 72.
  `;

  processAmbientDictation(sampleTranscript, {
    chainName: "QuickAddQHC",
    onSuccess: (result, patientInfo) => {
      console.log("Success! Patient:", `${patientInfo.firstName} ${patientInfo.lastName}`);
      console.log("View at:", result.viewUrl);
    },
    onError: (error) => {
      console.error("Failed:", error.message);
    }
  });
}

// Export chain name constants for convenience
export const CHAIN_NAMES = {
  QUICK_ADD: "QuickAddQHC",
  LABS: "ATTACHMENT PROCESSING (LABS)",
  SLEEP_STUDY: "ATTACHMENT PROCESSING (SLEEP STUDY)",
  RESEARCH_STUDY: "ATTACHMENT PROCESSING (RESEARCH STUDY)",
  REFERRAL: "REFERRAL PROCESSING",
  CLIENT_REPORT: "CLIENT REPORT SENT",
  SLEEP_RESULTS: "SLEEP STUDY RESULTS"
};