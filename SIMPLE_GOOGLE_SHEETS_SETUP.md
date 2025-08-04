# Simple Google Sheets Setup

## What This Does
Automatically syncs all your patient data (including AI analysis) to Google Sheets, which then works perfectly with AppSheet.

## Quick Setup (5 minutes)

### 1. Google Cloud Setup
- Go to [console.cloud.google.com](https://console.cloud.google.com)
- Create project → Enable "Google Sheets API"
- Create Service Account → Download JSON key

### 2. Create Google Sheet
- Go to [sheets.google.com](https://sheets.google.com)
- Create new sheet: "Patient Management Database"
- Share with service account email (from JSON)
- Copy Sheet ID from URL

### 3. Add to Replit Secrets
- **GOOGLE_SERVICE_ACCOUNT_KEY**: Entire JSON file content
- **GOOGLE_SHEET_ID**: Sheet ID from URL

### 4. Test Sync
Visit: `https://your-replit-app/api/google-sheets/sync` (POST request)

## Result
- All patient data automatically appears in Google Sheets
- AppSheet can connect to Google Sheets (works with any plan)
- Real-time updates every time you sync

## AppSheet Connection
Once Google Sheets is working:
1. Create AppSheet app
2. Choose "Google Sheets" as data source
3. Select your patient sheet
4. Done! Mobile access with real-time sync

Your patient data will include:
- Demographics and insurance
- AI analysis and LEQVIO approval data
- Letters of medical necessity
- All clinical information