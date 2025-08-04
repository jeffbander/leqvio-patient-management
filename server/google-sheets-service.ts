import { GoogleAuth } from 'google-auth-library';
import { sheets_v4, google } from 'googleapis';
import { storage } from './storage';

interface PatientRow {
  ID: string;
  FirstName: string;
  LastName: string;
  DateOfBirth: string;
  Phone: string;
  Email: string;
  Address: string;
  MRN: string;
  OrderingMD: string;
  Diagnosis: string;
  Status: string;
  PrimaryInsurance: string;
  PrimaryPlan: string;
  PrimaryInsuranceNumber: string;
  PrimaryGroupId: string;
  SecondaryInsurance: string;
  SecondaryPlan: string;
  SecondaryInsuranceNumber: string;
  SecondaryGroupId: string;
  FurtherAnalysis: string;
  LetterOfMedicalNecessity: string;
  ApprovalLikelihood: string;
  CriteriaAssessment: string;
  DocumentationGaps: string;
  Recommendations: string;
  CreatedAt: string;
  UpdatedAt: string;
}

// Helper function to parse AIGENTS response
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
      
      if (line.includes('APPROVAL LIKELIHOOD:')) {
        approvalLikelihood = line.replace('APPROVAL LIKELIHOOD:', '').trim();
      }
      
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
      
      if (line.includes('DOCUMENTATION GAPS:')) {
        for (let j = i + 1; j < lines.length && !lines[j].includes('RECOMMENDATIONS'); j++) {
          const gapLine = lines[j].trim();
          if (gapLine.startsWith('–') || gapLine.startsWith('-')) {
            documentationGaps.push(gapLine.replace(/^[–-]/, '').trim());
          }
        }
      }
      
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

class GoogleSheetsService {
  private auth: GoogleAuth | null = null;
  private sheets: sheets_v4.Sheets | null = null;
  private isConfigured = false;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    try {
      if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY || !process.env.GOOGLE_SHEET_ID) {
        console.log('Google Sheets: Missing credentials, service not configured');
        return;
      }

      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      
      this.auth = new GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      this.isConfigured = true;
      
      console.log('Google Sheets service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Google Sheets service:', error);
      this.isConfigured = false;
    }
  }

  async syncPatients(): Promise<{ success: boolean; message: string; recordCount?: number }> {
    if (!this.isConfigured || !this.sheets) {
      return { success: false, message: 'Google Sheets service not configured' };
    }

    try {
      const patients = await storage.getAllPatients();
      
      if (patients.length === 0) {
        return { success: false, message: 'No patients found to sync' };
      }

      // Get automation logs for AI analysis data
      const patientsWithAnalysis = await Promise.all(
        patients.map(async (patient) => {
          const automationLogs = await storage.getPatientAutomationLogs(patient.id);
          const latestWebhookData = automationLogs.length > 0 && automationLogs[0].webhookPayload
            ? automationLogs[0].webhookPayload
            : null;
          
          const furtherAnalysis = latestWebhookData?.websearch || latestWebhookData?.webSearch || latestWebhookData?.web_search || '';
          const letterOfMedicalNecessity = latestWebhookData?.lettofneed || latestWebhookData?.letterOfNeed || latestWebhookData?.letter_of_need || '';
          
          const latestAnalysis = automationLogs.length > 0 && automationLogs[0].agentResponse 
            ? parseAigentsResponse(automationLogs[0].agentResponse)
            : null;

          return {
            ID: patient.id.toString(),
            FirstName: patient.firstName || '',
            LastName: patient.lastName || '',
            DateOfBirth: patient.dateOfBirth || '',
            Phone: patient.phone || '',
            Email: patient.email || '',
            Address: patient.address || '',
            MRN: patient.mrn || '',
            OrderingMD: patient.orderingMD || '',
            Diagnosis: patient.diagnosis || '',
            Status: patient.status || '',
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
            CreatedAt: patient.createdAt?.toString() || '',
            UpdatedAt: patient.updatedAt?.toString() || ''
          } as PatientRow;
        })
      );

      const sheetId = process.env.GOOGLE_SHEET_ID!;
      
      // Clear existing data
      await this.sheets.spreadsheets.values.clear({
        spreadsheetId: sheetId,
        range: 'A:Z'
      });

      // Prepare header row
      const headers = [
        'ID', 'FirstName', 'LastName', 'DateOfBirth', 'Phone', 'Email', 'Address', 'MRN',
        'OrderingMD', 'Diagnosis', 'Status', 'PrimaryInsurance', 'PrimaryPlan', 
        'PrimaryInsuranceNumber', 'PrimaryGroupId', 'SecondaryInsurance', 'SecondaryPlan',
        'SecondaryInsuranceNumber', 'SecondaryGroupId', 'FurtherAnalysis', 
        'LetterOfMedicalNecessity', 'ApprovalLikelihood', 'CriteriaAssessment',
        'DocumentationGaps', 'Recommendations', 'CreatedAt', 'UpdatedAt'
      ];

      // Convert patient data to rows
      const rows = [
        headers,
        ...patientsWithAnalysis.map(patient => [
          patient.ID,
          patient.FirstName,
          patient.LastName,
          patient.DateOfBirth,
          patient.Phone,
          patient.Email,
          patient.Address,
          patient.MRN,
          patient.OrderingMD,
          patient.Diagnosis,
          patient.Status,
          patient.PrimaryInsurance,
          patient.PrimaryPlan,
          patient.PrimaryInsuranceNumber,
          patient.PrimaryGroupId,
          patient.SecondaryInsurance,
          patient.SecondaryPlan,
          patient.SecondaryInsuranceNumber,
          patient.SecondaryGroupId,
          patient.FurtherAnalysis,
          patient.LetterOfMedicalNecessity,
          patient.ApprovalLikelihood,
          patient.CriteriaAssessment,
          patient.DocumentationGaps,
          patient.Recommendations,
          patient.CreatedAt,
          patient.UpdatedAt
        ])
      ];

      // Update the sheet
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: 'A1',
        valueInputOption: 'RAW',
        requestBody: {
          values: rows
        }
      });

      console.log(`Successfully synced ${patientsWithAnalysis.length} patients to Google Sheets`);
      
      return { 
        success: true, 
        message: `Successfully synced ${patientsWithAnalysis.length} patients to Google Sheets`,
        recordCount: patientsWithAnalysis.length
      };

    } catch (error) {
      console.error('Error syncing to Google Sheets:', error);
      return { 
        success: false, 
        message: `Failed to sync to Google Sheets: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  async getStatus(): Promise<{ configured: boolean; hasCredentials: boolean; sheetId?: string }> {
    return {
      configured: this.isConfigured,
      hasCredentials: !!(process.env.GOOGLE_SERVICE_ACCOUNT_KEY && process.env.GOOGLE_SHEET_ID),
      sheetId: process.env.GOOGLE_SHEET_ID
    };
  }
}

export const googleSheetsService = new GoogleSheetsService();