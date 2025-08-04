# AppSheet New Editor Setup Guide

## Step-by-Step Connection Process

### Step 1: Find Your API URL
Your Replit app URL: Look at your browser address when viewing your app
- Example: `https://providerloop-chains-abc123.replit.app`
- Your API endpoint: `https://[your-app-url].replit.app/api/appsheet/patients`
- CSV download: `https://[your-app-url].replit.app/api/patients-csv`

### Step 2: Create New AppSheet App (New Editor)

1. **Go to AppSheet.com**
   - Visit [appsheet.com](https://www.appsheet.com)
   - Sign in with Google account

2. **Create New App**
   - Click **"Create"** button (top right)
   - Choose **"Start with existing data"**

### Step 3: Data Source Options (New Editor)

**Option A: REST API Connection (Preferred)**
1. In data source selection, look for:
   - **"Cloud database"** 
   - **"REST API"**
   - **"External API"**
   - **"Other data sources"** → **"API"**

2. **API Configuration:**
   - **Data source name**: `Patients`
   - **API endpoint URL**: `https://[your-app].replit.app/api/appsheet/patients`
   - **HTTP method**: `GET`
   - **Authentication**: None
   - **Headers**: Leave blank

**Option B: CSV Upload (Immediate Solution)**
1. First download your data:
   - Visit: `https://[your-app].replit.app/api/patients-csv`
   - Save the downloaded CSV file

2. In AppSheet data source selection:
   - Choose **"Upload file"** or **"CSV file"**
   - Upload your `patients.csv` file
   - AppSheet will auto-detect all columns

### Step 4: Configure Data Structure (New Editor)

**Primary Table Setup:**
- Table name: `Patients`
- Primary key: `ID` (set as key column)
- Row requirements: Check required fields

**Key Field Types to Verify:**
```
ID - Number (Key field)
FirstName - Text
LastName - Text
DateOfBirth - Date
Phone - Phone
Email - Email
Status - Enum (started, in_progress, completed, cancelled)
PrimaryInsurance - Text
ApprovalLikelihood - Text
FurtherAnalysis - LongText
CriteriaAssessment - LongText
```

### Step 5: Test Connection

1. **Preview Data**: Click **"Preview"** to see your patient records
2. **Verify Fields**: Check that all columns loaded correctly
3. **Test Updates**: If using REST API, verify write operations

### Step 6: App Configuration

**Views to Create:**
1. **Patient List View** - Table view showing key info
2. **Patient Detail View** - Form view with all fields
3. **Add Patient View** - Form for new entries
4. **Analysis Dashboard** - Focus on AI analysis fields

**Mobile Optimization:**
- Set **"Mobile-first"** in app settings
- Configure offline sync for field work
- Enable photo capture for document uploads

## Current Data Available

Your database includes:
- **18+ patients** with complete demographics
- **Insurance information** (primary/secondary)
- **AI analysis data** including LEQVIO approval analysis
- **Medical information** (diagnosis, ordering MD)
- **System fields** (created/updated timestamps)

## Troubleshooting New Editor

**If REST API option is missing:**
1. Check your AppSheet plan - REST API requires paid plan
2. Look under **"Advanced data sources"**
3. Try **"External database"** → **"Web service"**
4. Use CSV upload as alternative

**If connection fails:**
1. Test API endpoint in browser first
2. Check for CORS errors in browser console
3. Verify your Replit app is running
4. Try incognito/private browsing mode

**Common New Editor Locations:**
- Data sources: **"Add data"** → **"Choose data source"**
- API options: **"Cloud"** → **"REST API"** or **"Web API"**
- CSV upload: **"Files"** → **"Upload CSV"**

## Mobile App Features

Once connected, your AppSheet app will have:
- **Real-time patient data** from your database
- **Offline access** to patient records
- **Mobile forms** for patient updates
- **Photo capture** for documents
- **Push notifications** for status changes
- **Role-based permissions** for team access

## Next Steps

1. **Test with CSV first** - Quick setup to verify data
2. **Switch to REST API** - For real-time sync
3. **Customize interface** - Organize for medical workflow
4. **Add mobile features** - Photos, location, offline access
5. **Set permissions** - Control data access by role

Your patient management system is ready for mobile access!