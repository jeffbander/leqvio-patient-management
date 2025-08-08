import { Application } from 'express';
import { storage } from './storage';

// Helper function to parse AIGENTS response (same as other files)
const parseAigentsResponse = (response: string) => {
  if (!response || response === 'No response content' || response === 'Webhook received (no response content)') {
    return null;
  }

  try {
    const lines = response.split('\n');
    let approvalLikelihood = '';
    let criteriaItems: Array<{text: string, status: 'passed' | 'failed' | 'unknown'}> = [];
    let documentationGaps: string[] = [];
    let recommendations: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Extract approval likelihood
      if (line.includes('APPROVAL LIKELIHOOD:')) {
        approvalLikelihood = line.replace('APPROVAL LIKELIHOOD:', '').trim();
      }
      
      // Extract criteria assessment
      if (line.includes('CRITERIA ASSESSMENT')) {
        for (let j = i + 1; j < lines.length && !lines[j].includes('DOCUMENTATION GAPS'); j++) {
          const criteriaLine = lines[j].trim();
          if (criteriaLine.includes('✓')) {
            criteriaItems.push({
              text: criteriaLine.replace('✓', '').replace('•', '').trim(),
              status: 'passed'
            });
          } else if (criteriaLine.includes('✗')) {
            criteriaItems.push({
              text: criteriaLine.replace('✗', '').replace('•', '').trim(),
              status: 'failed'
            });
          }
        }
      }
      
      // Extract documentation gaps
      if (line.includes('DOCUMENTATION GAPS:')) {
        for (let j = i + 1; j < lines.length && !lines[j].includes('RECOMMENDATIONS'); j++) {
          const gapLine = lines[j].trim();
          if (gapLine.startsWith('–') || gapLine.startsWith('-')) {
            documentationGaps.push(gapLine.replace(/^[–-]/, '').trim());
          }
        }
      }
      
      // Extract recommendations
      if (line.includes('RECOMMENDATIONS:')) {
        for (let j = i + 1; j < lines.length && !lines[j].includes('ALTERNATIVE STRATEGIES'); j++) {
          const recLine = lines[j].trim();
          if (recLine.match(/^\d+\./)) {
            recommendations.push(recLine.replace(/^\d+\./, '').trim());
          }
        }
      }
    }

    return {
      approvalLikelihood,
      criteriaItems,
      documentationGaps,
      recommendations
    };
  } catch (error) {
    console.error('Error parsing AIGENTS response:', error);
    return null;
  }
};

// AppSheet-compatible API routes
export const setupAppsheetRoutes = (app: Application) => {
  
  // CORS headers for AppSheet
  app.use('/api/appsheet/*', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  // 1. Get all patients in AppSheet format
  app.get('/api/appsheet/patients', async (req, res) => {
    try {
      const patients = await storage.getAllPatients();
      
      // Get automation logs for all patients to include AI analysis
      const patientsWithAnalysis = await Promise.all(
        patients.map(async (patient) => {
          const automationLogs = await storage.getPatientAutomationLogs(patient.id);
          const latestWebhookData = automationLogs.length > 0 && automationLogs[0].webhookPayload
            ? automationLogs[0].webhookPayload
            : null;
          
          const furtherAnalysis = latestWebhookData?.websearch || latestWebhookData?.webSearch || latestWebhookData?.web_search || '';
          const letterOfMedicalNecessity = latestWebhookData?.lettofneed || latestWebhookData?.letterOfNeed || latestWebhookData?.letter_of_need || '';
          
          // Parse LEQVIO approval analysis
          const latestAnalysis = automationLogs.length > 0 && automationLogs[0].agentResponse 
            ? parseAigentsResponse(automationLogs[0].agentResponse)
            : null;

          return {
            // Core patient data
            ID: patient.id,
            FirstName: patient.firstName,
            LastName: patient.lastName,
            DateOfBirth: patient.dateOfBirth,
            Phone: patient.phone || '',
            Email: patient.email || '',
            Address: patient.address || '',
            MRN: patient.mrn || '',
            OrderingMD: patient.orderingMD,
            Diagnosis: patient.diagnosis,
            Status: patient.status,
            
            // Insurance information
            PrimaryInsurance: patient.primaryInsurance || '',
            PrimaryPlan: patient.primaryPlan || '',
            PrimaryInsuranceNumber: patient.primaryInsuranceNumber || '',
            PrimaryGroupId: patient.primaryGroupId || '',
            SecondaryInsurance: patient.secondaryInsurance || '',
            SecondaryPlan: patient.secondaryPlan || '',
            SecondaryInsuranceNumber: patient.secondaryInsuranceNumber || '',
            SecondaryGroupId: patient.secondaryGroupId || '',
            
            // AI Analysis data
            FurtherAnalysis: furtherAnalysis,
            LetterOfMedicalNecessity: letterOfMedicalNecessity,
            ApprovalLikelihood: latestAnalysis?.approvalLikelihood || '',
            CriteriaAssessment: latestAnalysis?.criteriaItems.map(item => 
              `${item.status === 'passed' ? '✓' : item.status === 'failed' ? '✗' : '?'} ${item.text}`
            ).join('; ') || '',
            DocumentationGaps: latestAnalysis?.documentationGaps.join('; ') || '',
            Recommendations: latestAnalysis?.recommendations.join('; ') || '',
            
            // Timestamps
            CreatedAt: patient.createdAt,
            UpdatedAt: patient.updatedAt
          };
        })
      );
      
      res.json(patientsWithAnalysis);
    } catch (error) {
      console.error('Error fetching patients for AppSheet:', error);
      res.status(500).json({ error: 'Failed to fetch patients' });
    }
  });

  // 2. Get single patient by ID
  app.get('/api/appsheet/patients/:id', async (req, res) => {
    try {
      const patient = await storage.getPatient(parseInt(req.params.id));
      if (!patient) {
        return res.status(404).json({ error: 'Patient not found' });
      }

      const automationLogs = await storage.getPatientAutomationLogs(patient.id);
      const latestWebhookData = automationLogs.length > 0 && automationLogs[0].webhookPayload
        ? automationLogs[0].webhookPayload
        : null;
      
      const furtherAnalysis = latestWebhookData?.websearch || latestWebhookData?.webSearch || latestWebhookData?.web_search || '';
      const letterOfMedicalNecessity = latestWebhookData?.lettofneed || latestWebhookData?.letterOfNeed || latestWebhookData?.letter_of_need || '';
      
      const latestAnalysis = automationLogs.length > 0 && automationLogs[0].agentResponse 
        ? parseAigentsResponse(automationLogs[0].agentResponse)
        : null;

      const appsheetPatient = {
        ID: patient.id,
        FirstName: patient.firstName,
        LastName: patient.lastName,
        DateOfBirth: patient.dateOfBirth,
        Phone: patient.phone || '',
        Email: patient.email || '',
        Address: patient.address || '',
        MRN: patient.mrn || '',
        OrderingMD: patient.orderingMD,
        Diagnosis: patient.diagnosis,
        Status: patient.status,
        PrimaryInsurance: patient.primaryInsurance || '',
        PrimaryPlan: patient.primaryPlan || '',
        PrimaryInsuranceNumber: patient.primaryInsuranceNumber || '',
        PrimaryGroupId: patient.primaryGroupId || '',
        SecondaryInsurance: patient.secondaryInsurance || '',
        SecondaryPlan: patient.secondaryPlan || '',
        SecondaryInsuranceNumber: patient.secondaryInsuranceNumber || '',
        SecondaryGroupId: patient.secondaryGroupId || '',
        FurtherAnalysis: furtherAnalysis,
        LetterOfMedicalNecessity: letterOfMedicalNecessity,
        ApprovalLikelihood: latestAnalysis?.approvalLikelihood || '',
        CriteriaAssessment: latestAnalysis?.criteriaItems.map(item => 
          `${item.status === 'passed' ? '✓' : item.status === 'failed' ? '✗' : '?'} ${item.text}`
        ).join('; ') || '',
        DocumentationGaps: latestAnalysis?.documentationGaps.join('; ') || '',
        Recommendations: latestAnalysis?.recommendations.join('; ') || '',
        CreatedAt: patient.createdAt,
        UpdatedAt: patient.updatedAt
      };

      res.json(appsheetPatient);
    } catch (error) {
      console.error('Error fetching patient for AppSheet:', error);
      res.status(500).json({ error: 'Failed to fetch patient' });
    }
  });

  // 3. Create new patient from AppSheet
  app.post('/api/appsheet/patients', async (req, res) => {
    try {
      const patientData = {
        firstName: req.body.FirstName,
        lastName: req.body.LastName,
        dateOfBirth: req.body.DateOfBirth,
        phone: req.body.Phone,
        email: req.body.Email,
        address: req.body.Address,
        mrn: req.body.MRN,
        orderingMD: req.body.OrderingMD,
        diagnosis: req.body.Diagnosis,
        status: req.body.Status || 'started',
        primaryInsurance: req.body.PrimaryInsurance,
        primaryPlan: req.body.PrimaryPlan,
        primaryInsuranceNumber: req.body.PrimaryInsuranceNumber,
        primaryGroupId: req.body.PrimaryGroupId,
        secondaryInsurance: req.body.SecondaryInsurance,
        secondaryPlan: req.body.SecondaryPlan,
        secondaryInsuranceNumber: req.body.SecondaryInsuranceNumber,
        secondaryGroupId: req.body.SecondaryGroupId
      };

      const newPatient = await storage.createPatient(patientData);
      
      // Return in AppSheet format
      const appsheetPatient = {
        ID: newPatient.id,
        FirstName: newPatient.firstName,
        LastName: newPatient.lastName,
        DateOfBirth: newPatient.dateOfBirth,
        Phone: newPatient.phone || '',
        Email: newPatient.email || '',
        Address: newPatient.address || '',
        MRN: newPatient.mrn || '',
        OrderingMD: newPatient.orderingMD,
        Diagnosis: newPatient.diagnosis,
        Status: newPatient.status,
        PrimaryInsurance: newPatient.primaryInsurance || '',
        PrimaryPlan: newPatient.primaryPlan || '',
        PrimaryInsuranceNumber: newPatient.primaryInsuranceNumber || '',
        PrimaryGroupId: newPatient.primaryGroupId || '',
        SecondaryInsurance: newPatient.secondaryInsurance || '',
        SecondaryPlan: newPatient.secondaryPlan || '',
        SecondaryInsuranceNumber: newPatient.secondaryInsuranceNumber || '',
        SecondaryGroupId: newPatient.secondaryGroupId || '',
        FurtherAnalysis: '',
        LetterOfMedicalNecessity: '',
        ApprovalLikelihood: '',
        CriteriaAssessment: '',
        DocumentationGaps: '',
        Recommendations: '',
        CreatedAt: newPatient.createdAt,
        UpdatedAt: newPatient.updatedAt
      };

      res.status(201).json(appsheetPatient);
    } catch (error) {
      console.error('Error creating patient from AppSheet:', error);
      res.status(500).json({ error: 'Failed to create patient' });
    }
  });

  // 4. Update patient from AppSheet
  app.put('/api/appsheet/patients/:id', async (req, res) => {
    try {
      const patientId = parseInt(req.params.id);
      
      // Get current patient data before update to compare changes
      const currentPatient = await storage.getPatient(patientId);
      if (!currentPatient) {
        return res.status(404).json({ error: 'Patient not found' });
      }

      const updateData: any = {
        firstName: req.body.FirstName,
        lastName: req.body.LastName,
        dateOfBirth: req.body.DateOfBirth,
        phone: req.body.Phone,
        email: req.body.Email,
        address: req.body.Address,
        mrn: req.body.MRN,
        orderingMD: req.body.OrderingMD,
        diagnosis: req.body.Diagnosis,
        status: req.body.Status,
        primaryInsurance: req.body.PrimaryInsurance,
        primaryPlan: req.body.PrimaryPlan,
        primaryInsuranceNumber: req.body.PrimaryInsuranceNumber,
        primaryGroupId: req.body.PrimaryGroupId,
        secondaryInsurance: req.body.SecondaryInsurance,
        secondaryPlan: req.body.SecondaryPlan,
        secondaryInsuranceNumber: req.body.SecondaryInsuranceNumber,
        secondaryGroupId: req.body.SecondaryGroupId,
        authNumber: req.body.AuthNumber,
        refNumber: req.body.RefNumber,
        startDate: req.body.StartDate,
        endDate: req.body.EndDate,
        authStatus: req.body.AuthStatus,
        scheduleStatus: req.body.ScheduleStatus
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      // Generate notes for insurance and authorization changes
      const changeNotes: string[] = [];
      const timestamp = new Date().toLocaleString();

      // Check for insurance changes
      const insuranceFields = [
        { key: 'primaryInsurance', label: 'Primary Insurance' },
        { key: 'primaryInsuranceNumber', label: 'Primary Member ID' },
        { key: 'primaryGroupId', label: 'Primary Group ID' },
        { key: 'secondaryInsurance', label: 'Secondary Insurance' },
        { key: 'secondaryInsuranceNumber', label: 'Secondary Member ID' },
        { key: 'secondaryGroupId', label: 'Secondary Group ID' }
      ];

      insuranceFields.forEach(field => {
        const oldValue = (currentPatient as any)[field.key] || '';
        const newValue = updateData[field.key] || '';
        if (oldValue !== newValue && (oldValue || newValue)) {
          changeNotes.push(`${field.label} changed from "${oldValue}" to "${newValue}"`);
        }
      });

      // Check for authorization changes
      const authFields = [
        { key: 'authNumber', label: 'Auth Number' },
        { key: 'refNumber', label: 'Ref Number' },
        { key: 'startDate', label: 'Start Date' },
        { key: 'endDate', label: 'End Date' },
        { key: 'authStatus', label: 'Auth Status' },
        { key: 'scheduleStatus', label: 'Schedule Status' }
      ];

      authFields.forEach(field => {
        const oldValue = (currentPatient as any)[field.key] || '';
        const newValue = updateData[field.key] || '';
        if (oldValue !== newValue && (oldValue || newValue)) {
          changeNotes.push(`${field.label} changed from "${oldValue}" to "${newValue}"`);
        }
      });

      // Add change notes to existing notes if there are any changes
      if (changeNotes.length > 0) {
        const existingNotes = currentPatient.notes || '';
        const newNoteEntry = `[${timestamp}] ${changeNotes.join('; ')}`;
        updateData.notes = existingNotes ? `${existingNotes}\n${newNoteEntry}` : newNoteEntry;
      }

      const updatedPatient = await storage.updatePatient(patientId, updateData);
      
      if (!updatedPatient) {
        return res.status(404).json({ error: 'Patient not found' });
      }

      // Get analysis data for response
      const automationLogs = await storage.getPatientAutomationLogs(patientId);
      const latestWebhookData = automationLogs.length > 0 && automationLogs[0].webhookPayload
        ? automationLogs[0].webhookPayload
        : null;
      
      const furtherAnalysis = latestWebhookData?.websearch || latestWebhookData?.webSearch || latestWebhookData?.web_search || '';
      const letterOfMedicalNecessity = latestWebhookData?.lettofneed || latestWebhookData?.letterOfNeed || latestWebhookData?.letter_of_need || '';
      
      const latestAnalysis = automationLogs.length > 0 && automationLogs[0].agentResponse 
        ? parseAigentsResponse(automationLogs[0].agentResponse)
        : null;

      const appsheetPatient = {
        ID: updatedPatient.id,
        FirstName: updatedPatient.firstName,
        LastName: updatedPatient.lastName,
        DateOfBirth: updatedPatient.dateOfBirth,
        Phone: updatedPatient.phone || '',
        Email: updatedPatient.email || '',
        Address: updatedPatient.address || '',
        MRN: updatedPatient.mrn || '',
        OrderingMD: updatedPatient.orderingMD,
        Diagnosis: updatedPatient.diagnosis,
        Status: updatedPatient.status,
        PrimaryInsurance: updatedPatient.primaryInsurance || '',
        PrimaryPlan: updatedPatient.primaryPlan || '',
        PrimaryInsuranceNumber: updatedPatient.primaryInsuranceNumber || '',
        PrimaryGroupId: updatedPatient.primaryGroupId || '',
        SecondaryInsurance: updatedPatient.secondaryInsurance || '',
        SecondaryPlan: updatedPatient.secondaryPlan || '',
        SecondaryInsuranceNumber: updatedPatient.secondaryInsuranceNumber || '',
        SecondaryGroupId: updatedPatient.secondaryGroupId || '',
        FurtherAnalysis: furtherAnalysis,
        LetterOfMedicalNecessity: letterOfMedicalNecessity,
        ApprovalLikelihood: latestAnalysis?.approvalLikelihood || '',
        CriteriaAssessment: latestAnalysis?.criteriaItems.map(item => 
          `${item.status === 'passed' ? '✓' : item.status === 'failed' ? '✗' : '?'} ${item.text}`
        ).join('; ') || '',
        DocumentationGaps: latestAnalysis?.documentationGaps.join('; ') || '',
        Recommendations: latestAnalysis?.recommendations.join('; ') || '',
        CreatedAt: updatedPatient.createdAt,
        UpdatedAt: updatedPatient.updatedAt
      };

      res.json(appsheetPatient);
    } catch (error) {
      console.error('Error updating patient from AppSheet:', error);
      res.status(500).json({ error: 'Failed to update patient' });
    }
  });

  // 5. AppSheet metadata endpoint
  app.get('/api/appsheet/metadata', (req, res) => {
    res.json({
      name: 'Providerloop Chains Patient Management',
      description: 'Medical patient management system with LEQVIO analysis',
      version: '1.0.0',
      endpoints: {
        patients: '/api/appsheet/patients',
        singlePatient: '/api/appsheet/patients/:id',
        createPatient: 'POST /api/appsheet/patients',
        updatePatient: 'PUT /api/appsheet/patients/:id'
      },
      dataTypes: {
        ID: 'Number',
        FirstName: 'Text',
        LastName: 'Text',
        DateOfBirth: 'Date',
        Phone: 'Text',
        Email: 'Email',
        Address: 'LongText',
        MRN: 'Text',
        OrderingMD: 'Text',
        Diagnosis: 'Text',
        Status: 'Enum',
        PrimaryInsurance: 'Text',
        PrimaryPlan: 'Text',
        PrimaryInsuranceNumber: 'Text',
        PrimaryGroupId: 'Text',
        SecondaryInsurance: 'Text',
        SecondaryPlan: 'Text',
        SecondaryInsuranceNumber: 'Text',
        SecondaryGroupId: 'Text',
        FurtherAnalysis: 'LongText',
        LetterOfMedicalNecessity: 'LongText',
        ApprovalLikelihood: 'Text',
        CriteriaAssessment: 'LongText',
        DocumentationGaps: 'LongText',
        Recommendations: 'LongText',
        CreatedAt: 'DateTime',
        UpdatedAt: 'DateTime'
      },
      sampleData: {
        statusOptions: ['started', 'in_progress', 'completed', 'cancelled'],
        diagnosisCodes: ['E78.2', 'I70.2-I70.9', 'E78.01', 'Z95.1', 'I20.0-I25.9', 'E78.0']
      }
    });
  });
};