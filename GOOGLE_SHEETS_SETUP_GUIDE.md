# Google Sheets Integration Setup

## Step 1: Get Google API Credentials

### Create Google Service Account
1. **Go to [Google Cloud Console](https://console.cloud.google.com)**
2. **Create or select a project**
3. **Enable Google Sheets API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Google Sheets API"
   - Click "Enable"

4. **Create Service Account**:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "Service Account"
   - Name: `patient-sheets-sync`
   - Role: "Editor"
   - Click "Create"

5. **Download JSON Key**:
   - Click on your new service account
   - Go to "Keys" tab
   - Click "Add Key" → "Create new key" → "JSON"
   - Download the JSON file

## Step 2: Create Google Sheet

1. **Create new Google Sheet**:
   - Go to [sheets.google.com](https://sheets.google.com)
   - Create a new sheet
   - Name it: `Patient Database Sync`

2. **Get Sheet ID**:
   - Look at the URL: `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`
   - Copy the SHEET_ID_HERE part

3. **Share with Service Account**:
   - Click "Share" in your Google Sheet
   - Add the service account email (from the JSON file)
   - Give "Editor" permission

## Step 3: Add Credentials to Replit

You'll need to add these as secrets in Replit:

**GOOGLE_SERVICE_ACCOUNT_KEY**: The entire contents of the JSON file you downloaded

**GOOGLE_SHEET_ID**: The ID from your Google Sheet URL

## Example JSON Key Format
```json
{
  "type": "service_account",
  "project_id": "your-project",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",
  "client_email": "patient-sheets-sync@your-project.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
}
```

## Quick Setup Checklist
- [ ] Create Google Cloud Project
- [ ] Enable Google Sheets API
- [ ] Create Service Account with Editor role
- [ ] Download JSON key file
- [ ] Create Google Sheet
- [ ] Share sheet with service account email
- [ ] Copy Sheet ID from URL
- [ ] Add both secrets to Replit

Once you have these credentials, I'll set up automatic sync between your patient database and Google Sheets!