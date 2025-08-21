import { google } from 'googleapis';
import { Patient } from '../shared/schema';

export class GoogleSheetsService {
  private sheets: any;
  private auth: any;

  constructor() {
    // Initialize Google Auth
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      let credentials;\n      try {\n        credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);\n      } catch (error) {\n        console.error('JSON parse error in googleSheets.ts:', error);\n        return;\n      }
      this.auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    }
  }

  async isConfigured(): Promise<boolean> {
    return !!(process.env.GOOGLE_SERVICE_ACCOUNT_KEY && process.env.GOOGLE_SHEET_ID);
  }

  async syncPatientsToSheet(patients: Patient[]): Promise<void> {
    if (!await this.isConfigured()) {
      throw new Error('Google Sheets not configured. Missing credentials or sheet ID.');
    }

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    
    // Define headers
    const headers = [
      'ID', 'First Name', 'Last Name', 'Date of Birth', 'Phone', 'Email', 'Address', 'MRN',
      'Ordering MD', 'Diagnosis', 'Status',
      'Primary Insurance', 'Primary Plan', 'Primary Insurance Number', 'Primary Group ID',
      'Secondary Insurance', 'Secondary Plan', 'Secondary Insurance Number', 'Secondary Group ID',
      'Created At', 'Updated At'
    ];

    // Convert patients to rows
    const rows = patients.map(patient => [
      patient.id,
      patient.firstName,
      patient.lastName,
      patient.dateOfBirth,
      patient.phone || '',
      patient.email || '',
      patient.address || '',
      patient.mrn || '',
      patient.orderingMD,
      patient.diagnosis,
      patient.status,
      patient.primaryInsurance || '',
      patient.primaryPlan || '',
      patient.primaryInsuranceNumber || '',
      patient.primaryGroupId || '',
      patient.secondaryInsurance || '',
      patient.secondaryPlan || '',
      patient.secondaryInsuranceNumber || '',
      patient.secondaryGroupId || '',
      new Date(patient.createdAt).toLocaleDateString(),
      new Date(patient.updatedAt).toLocaleDateString()
    ]);

    // Clear existing data and write new data
    try {
      // Clear the sheet first
      await this.sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: 'A:Z',
      });

      // Write headers and data
      await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'A1',
        valueInputOption: 'RAW',
        resource: {
          values: [headers, ...rows],
        },
      });

      console.log(`Successfully synced ${patients.length} patients to Google Sheets`);
    } catch (error) {
      console.error('Error syncing to Google Sheets:', error);
      throw error;
    }
  }

  async addPatientToSheet(patient: Patient): Promise<void> {
    if (!await this.isConfigured()) {
      return; // Silently skip if not configured
    }

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    
    const row = [
      patient.id,
      patient.firstName,
      patient.lastName,
      patient.dateOfBirth,
      patient.phone || '',
      patient.email || '',
      patient.address || '',
      patient.mrn || '',
      patient.orderingMD,
      patient.diagnosis,
      patient.status,
      patient.primaryInsurance || '',
      patient.primaryPlan || '',
      patient.primaryInsuranceNumber || '',
      patient.primaryGroupId || '',
      patient.secondaryInsurance || '',
      patient.secondaryPlan || '',
      patient.secondaryInsuranceNumber || '',
      patient.secondaryGroupId || '',
      new Date(patient.createdAt).toLocaleDateString(),
      new Date(patient.updatedAt).toLocaleDateString()
    ];

    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'A:Z',
        valueInputOption: 'RAW',
        resource: {
          values: [row],
        },
      });

      console.log(`Added patient ${patient.firstName} ${patient.lastName} to Google Sheets`);
    } catch (error) {
      console.error('Error adding patient to Google Sheets:', error);
      // Don't throw error - this shouldn't break the main patient creation flow
    }
  }
}

export const googleSheetsService = new GoogleSheetsService();