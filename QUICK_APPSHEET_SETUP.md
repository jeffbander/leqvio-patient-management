# Quick AppSheet Setup Guide

## Your API Details

**Base URL**: `https://[your-replit-app-name].replit.app/api/appsheet`
**Example**: `https://providerloop-chains.replit.app/api/appsheet`

## 5-Minute Setup Process

### 1. Create AppSheet App
1. Go to [appsheet.com](https://www.appsheet.com)
2. Click **"Create"** → **"Start with your own data"**
3. Select **"REST API"** as data source

### 2. Configure API Connection
**In the AppSheet setup wizard:**
- **Data source name**: `Patients`
- **API Base URL**: `https://[your-app-name].replit.app/api/appsheet`
- **Endpoint**: `/patients`
- **Method**: `GET`
- **Authentication**: None (leave blank)

### 3. Quick Field Setup
AppSheet will auto-detect these fields. Just verify:

**Essential Fields:**
- `ID` (Number) - Set as Primary Key
- `FirstName` (Text) 
- `LastName` (Text)
- `Status` (Enum) - Values: started, in_progress, completed, cancelled
- `Diagnosis` (Text)
- `PrimaryInsurance` (Text)

**AI Analysis Fields:**
- `ApprovalLikelihood` (Text)
- `FurtherAnalysis` (LongText)
- `LetterOfMedicalNecessity` (LongText)

### 4. Test Connection
Click **"Test"** in AppSheet - you should see your patient data!

### 5. Configure Write Operations
- **Create**: POST `/patients`
- **Update**: PUT `/patients/{ID}`
- **Primary Key**: `ID`

## Your Current Data
You have **patient data ready** including:
- Patient demographics and insurance information
- AI analysis and LEQVIO approval data
- Real-time sync capabilities

## Need Your Exact URL?
Your Replit app URL is shown in your browser when you visit your app. Replace the domain in the API base URL above.

## Test Your API First
Visit this URL in your browser to test:
`https://[your-app-name].replit.app/api/appsheet/patients`

You should see JSON data with your patient information.

## Next Steps After Setup
1. **Test the app** - View your patient list
2. **Customize views** - Organize fields for mobile use
3. **Add permissions** - Control who can edit data
4. **Deploy** - Share with your team

Ready to start? Let me know if you need help with any specific step!