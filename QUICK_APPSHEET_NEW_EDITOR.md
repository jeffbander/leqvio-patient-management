# Quick AppSheet Setup (New Editor) - 5 Minutes

## Your Data is Ready

✅ **Patient Database**: 18+ patients with complete medical data
✅ **AI Analysis**: LEQVIO approval analysis included
✅ **REST API**: Live endpoints available
✅ **CSV Export**: Downloadable patient data

## Fast Setup Process

### Method 1: CSV Upload (Fastest - 2 minutes)

1. **Download your data**: 
   ```
   https://[your-replit-url]/api/patients-csv
   ```
   *(Replace [your-replit-url] with your actual app URL)*

2. **Create AppSheet app**:
   - Go to [appsheet.com](https://www.appsheet.com)
   - Click **"Create"** → **"Start with existing data"**
   - Choose **"Upload file"** or **"CSV"**
   - Upload your downloaded CSV file

3. **Done!** AppSheet auto-detects all your fields

### Method 2: REST API (Real-time sync)

1. **In AppSheet data source selection**:
   - Look for **"Cloud database"** or **"REST API"**
   - If not visible, try **"Other sources"** → **"Web API"**

2. **API Configuration**:
   - **Endpoint**: `https://[your-replit-url]/api/appsheet/patients`
   - **Method**: GET
   - **Auth**: None

## Your Available Data

**Patient Fields:**
- Demographics (name, DOB, phone, email, address)
- Medical (MRN, ordering MD, diagnosis, status)
- Insurance (primary/secondary with all details)

**AI Analysis Fields:**
- Approval likelihood assessment
- Criteria evaluation results
- Documentation gap analysis
- Clinical recommendations
- Letters of medical necessity

## Need Your Exact URLs?

**Find your Replit app URL:**
1. Look at your browser address bar when viewing your app
2. It looks like: `https://something.replit.app`

**Your API endpoints:**
- **CSV Download**: `https://[your-url]/api/patients-csv`
- **REST API**: `https://[your-url]/api/appsheet/patients`
- **Metadata**: `https://[your-url]/api/appsheet/metadata`

## Quick Test

**Test your API now:**
Visit `https://[your-url]/api/appsheet/patients` in browser
- Should show JSON with patient data
- If you see HTML instead, check the URL

**Test CSV download:**
Visit `https://[your-url]/api/patients-csv` in browser
- Should download a CSV file with patient data

## AppSheet New Editor Tips

**Look for these options:**
- **"Start with existing data"** (not "Start from scratch")
- **"Upload file"** for CSV method
- **"Cloud database"** or **"External API"** for REST method

**If you don't see REST API option:**
- Your AppSheet plan might not include it
- Use CSV method instead (works perfectly)
- Can upgrade later for real-time sync

Ready to start? What's your Replit app URL?