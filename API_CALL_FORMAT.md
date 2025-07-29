# AIGENTS API Call Format & Examples

## Endpoint
```
POST https://start-chain-run-943506065004.us-central1.run.app
Content-Type: application/json
```

## Required Request Body Format

```json
{
  "run_email": "jeffrey.Bander@providerloop.com",
  "chain_to_run": "CHAIN_NAME",
  "human_readable_record": "Description of the process",
  "source_id": "OPTIONAL_SOURCE_ID",
  "first_step_user_input": "OPTIONAL_USER_INPUT",
  "starting_variables": {
    "key1": "value1",
    "key2": "value2"
  }
}
```

## Field Descriptions

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `run_email` | Yes | String | Fixed email: "jeffrey.Bander@providerloop.com" |
| `chain_to_run` | Yes | String | Name of the chain to execute |
| `human_readable_record` | Yes | String | Description of what triggered this chain |
| `source_id` | No | String | Unique identifier for the patient/record |
| `first_step_user_input` | No | String | Initial input for the first step of the chain |
| `starting_variables` | No | Object | Key-value pairs of variables to pass to the chain |

## Example 1: Patient Creation from Screenshot

```json
{
  "run_email": "jeffrey.Bander@providerloop.com",
  "chain_to_run": "Screenshot_Patient_Creator",
  "human_readable_record": "Medical database screenshot processing from external app",
  "source_id": "Smith_John__03_15_1985",
  "first_step_user_input": "",
  "starting_variables": {
    "patient_first_name": "John",
    "patient_last_name": "Smith",
    "patient_dob": "03/15/1985",
    "Patient_ID": "Smith_John__03_15_1985",
    "extraction_source": "medical_database_screenshot",
    "timestamp": "2025-07-28T20:30:00.000Z",
    "Patient_Address": "123 Main St, Anytown, ST 12345",
    "first_name": "John",
    "last_name": "Smith", 
    "date_of_birth": "03/15/1985",
    "Patient_Primary_Insurance": "Blue Cross Blue Shield",
    "Patient_Primary_Insurance_ID": "ABC123456789",
    "Patient_Secondary_Insurance": "Aetna",
    "Patient_Secondary_Insurance_ID": "XYZ987654321",
    "Patient_Phone_Number": "(555) 123-4567",
    "Patient_Email": "john.smith@email.com"
  }
}
```

## Example 2: Lab Processing

```json
{
  "run_email": "jeffrey.Bander@providerloop.com",
  "chain_to_run": "ATTACHMENT PROCESSING (LABS)",
  "human_readable_record": "Lab results processing for patient",
  "source_id": "Johnson_Mary__12_25_1975",
  "first_step_user_input": "Lab results attached for review",
  "starting_variables": {
    "patient_name": "Mary Johnson",
    "lab_type": "Complete Blood Count",
    "ordered_date": "07/28/2025",
    "results_available": "true"
  }
}
```

## Example 3: Sleep Study Processing

```json
{
  "run_email": "jeffrey.Bander@providerloop.com",
  "chain_to_run": "ATTACHMENT PROCESSING (SLEEP STUDY)",
  "human_readable_record": "Sleep study results processing",
  "source_id": "Davis_Robert__06_03_1990",
  "first_step_user_input": "",
  "starting_variables": {
    "patient_name": "Robert Davis",
    "study_date": "07/25/2025",
    "study_type": "Overnight Polysomnography",
    "referring_physician": "Dr. Smith"
  }
}
```

## Available Chain Names

- `"Screenshot_Patient_Creator"` - Creates a new patient using uploaded screenshot
- `"QuickAddQHC"` - Quick patient registration  
- `"ATTACHMENT PROCESSING (LABS)"` - Lab results processing
- `"ATTACHMENT PROCESSING (SLEEP STUDY)"` - Sleep study processing
- `"ATTACHMENT PROCESSING (RESEARCH STUDY)"` - Research study processing
- `"REFERRAL PROCESSING"` - Referral processing
- `"CLIENT REPORT SENT"` - Client report generation
- `"SLEEP STUDY RESULTS"` - Sleep study results

## Expected Response Format

### Success Response
```json
{
  "ChainRun_ID": "abc123def",
  "status": "success",
  "message": "Chain triggered successfully",
  "responses": [
    {
      "rows": [
        {
          "Run_ID": "abc123def",
          "_RowNumber": 1,
          "ID": "unique_id_here"
        }
      ]
    }
  ]
}
```

### Error Response
```json
{
  "error": "Error description",
  "message": "Detailed error message",
  "status": "error"
}
```

## JavaScript Example Usage

```javascript
async function triggerChain(patientInfo, extractedData) {
  const response = await fetch('https://start-chain-run-943506065004.us-central1.run.app', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      run_email: "jeffrey.Bander@providerloop.com",
      chain_to_run: "Screenshot_Patient_Creator",
      human_readable_record: "Medical database screenshot processing from external app",
      source_id: patientInfo.sourceId,
      first_step_user_input: "",
      starting_variables: {
        ...extractedData,
        extraction_source: "medical_database_screenshot",
        Patient_ID: patientInfo.sourceId,
        timestamp: new Date().toISOString(),
        // Include specific patient variables only for Screenshot_Patient_Creator chain
        ...(chainName === "Screenshot_Patient_Creator" && {
          Patient_Address: extractedData.patient_address || '',
          first_name: extractedData.patient_first_name || '',
          last_name: extractedData.patient_last_name || '',
          date_of_birth: extractedData.patient_dob || '',
          Patient_Primary_Insurance: extractedData.insurance_provider || '',
          Patient_Primary_Insurance_ID: extractedData.insurance_id || '',
          Patient_Secondary_Insurance: extractedData.secondary_insurance || '',
          Patient_Secondary_Insurance_ID: extractedData.secondary_insurance_id || '',
          Patient_Phone_Number: extractedData.patient_phone || '',
          Patient_Email: extractedData.patient_email || ''
        })
      }
    })
  });

  const result = await response.json();
  
  if (response.ok) {
    const chainRunId = result.ChainRun_ID || 
                       (result.responses?.[0]?.rows?.[0]?.Run_ID);
    console.log('Success! Chain Run ID:', chainRunId);
    return { success: true, chainRunId };
  } else {
    console.error('Error:', result.error || result.message);
    return { success: false, error: result.error || result.message };
  }
}
```

## Notes

1. **Fixed Email**: Always use "jeffrey.Bander@providerloop.com" as the run_email
2. **Source ID Format**: Use format "LastName_FirstName__MM_DD_YYYY" for patient IDs
3. **Chain Names**: Must match exactly (case-sensitive)
4. **Variables**: All values in starting_variables should be strings
5. **Response Parsing**: Chain Run ID can be in multiple locations in the response
6. **Logs URL**: View chain execution at `https://aigents-realtime-logs-943506065004.us-central1.run.app/?chainRunId={chainRunId}`

## Minimal Required Request

The absolute minimum request needs:
```json
{
  "run_email": "jeffrey.Bander@providerloop.com",
  "chain_to_run": "Screenshot_Patient_Creator",
  "human_readable_record": "Manual trigger"
}
```