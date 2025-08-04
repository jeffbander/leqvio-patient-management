# AppSheet Integration Guide

## Overview
Your Providerloop Chains patient management system now has direct database connection capabilities for AppSheet. This allows real-time bi-directional data sync between your medical app and AppSheet mobile/web apps.

## What's Available

### ✅ AppSheet-Compatible API Endpoints
- **GET /api/appsheet/patients** - Get all patients with AI analysis
- **GET /api/appsheet/patients/:id** - Get single patient details
- **POST /api/appsheet/patients** - Create new patient from AppSheet
- **PUT /api/appsheet/patients/:id** - Update patient from AppSheet
- **GET /api/appsheet/metadata** - Schema information for AppSheet

### ✅ Complete Data Access
Your AppSheet app will have access to:
- **Patient Demographics**: Name, DOB, phone, email, address, MRN
- **Medical Information**: Ordering MD, diagnosis, status
- **Insurance Details**: Primary and secondary insurance (plan, numbers, group IDs)
- **AI Analysis**: Further analysis, letters of medical necessity
- **LEQVIO Analysis**: Approval likelihood, criteria assessment, documentation gaps, recommendations
- **Timestamps**: Created and updated dates

## Setting Up AppSheet Connection

### Step 1: Create New AppSheet App
1. Go to [AppSheet.com](https://www.appsheet.com)
2. Click "Create" → "Start with your own data"
3. Choose "REST API" as data source

### Step 2: Configure API Connection
**API Base URL:** `https://your-replit-app-name.replit.app/api/appsheet`
*(Replace with your actual Replit app URL)*

**Endpoints to configure:**
- **Primary Data Source**: `/patients`
- **Single Record**: `/patients/{ID}`
- **Metadata**: `/metadata`

### Step 3: Authentication Setup
Currently configured for **open access** (no authentication required).
For production, you may want to add API key authentication.

### Step 4: Data Structure
AppSheet will automatically detect these fields:

#### Core Patient Fields
- `ID` (Number) - Primary key
- `FirstName` (Text)
- `LastName` (Text) 
- `DateOfBirth` (Date)
- `Phone` (Text)
- `Email` (Email)
- `Address` (LongText)
- `MRN` (Text)

#### Medical Fields
- `OrderingMD` (Text)
- `Diagnosis` (Text)
- `Status` (Enum: started, in_progress, completed, cancelled)

#### Insurance Fields
- `PrimaryInsurance` (Text)
- `PrimaryPlan` (Text)
- `PrimaryInsuranceNumber` (Text)
- `PrimaryGroupId` (Text)
- `SecondaryInsurance` (Text)
- `SecondaryPlan` (Text)
- `SecondaryInsuranceNumber` (Text)
- `SecondaryGroupId` (Text)

#### AI Analysis Fields
- `FurtherAnalysis` (LongText)
- `LetterOfMedicalNecessity` (LongText)
- `ApprovalLikelihood` (Text)
- `CriteriaAssessment` (LongText)
- `DocumentationGaps` (LongText)
- `Recommendations` (LongText)

#### System Fields
- `CreatedAt` (DateTime)
- `UpdatedAt` (DateTime)

## AppSheet Configuration Tips

### 1. Set Primary Key
- Set `ID` as the primary key field
- Mark it as auto-generated

### 2. Configure Status Field
- Set `Status` as an Enum type
- Valid values: `started`, `in_progress`, `completed`, `cancelled`

### 3. Format Long Text Fields
- Set `FurtherAnalysis`, `LetterOfMedicalNecessity`, `CriteriaAssessment`, `DocumentationGaps`, and `Recommendations` as LongText
- Enable rich text formatting if needed

### 4. Date/Time Formatting
- `DateOfBirth` should be Date type
- `CreatedAt` and `UpdatedAt` should be DateTime type

### 5. Email Validation
- Set `Email` field with Email type for automatic validation

## Real-Time Sync Benefits

### ✅ Bi-Directional Updates
- Changes in AppSheet automatically update your medical database
- New patients added via your web app appear in AppSheet instantly

### ✅ Complete AI Analysis Access
- View LEQVIO approval analysis on mobile
- Access generated letters of medical necessity
- Review insurance criteria assessments

### ✅ Field-Level Updates
- Update individual patient fields from AppSheet
- Changes sync back to your main application

## Testing Your Connection

### Quick Test Endpoints
```bash
# Test metadata
curl "https://your-app.replit.app/api/appsheet/metadata"

# Test patient data
curl "https://your-app.replit.app/api/appsheet/patients"

# Test single patient
curl "https://your-app.replit.app/api/appsheet/patients/18"
```

### Sample AppSheet Configuration
1. **Data Source Type**: REST API
2. **Base URL**: `https://your-app.replit.app/api/appsheet`
3. **GET Method**: `/patients`
4. **POST Method**: `/patients`
5. **PUT Method**: `/patients/{ID}`
6. **Primary Key**: `ID`

## Cost Considerations

### AppSheet Pricing
- **Core Plan**: $5/user/month (basic features)
- **Team Plan**: $10/user/month (recommended for database connections)
- **Enterprise**: $20/user/month (advanced features)

### Your Costs
- **No additional costs** for the API integration
- **Same database costs** as your current setup
- **Same Replit hosting costs**

## Next Steps

1. **Create your AppSheet app** using the endpoints above
2. **Test the connection** with sample data
3. **Customize the AppSheet interface** for your medical workflow
4. **Add mobile-specific features** like barcode scanning, photo capture
5. **Set up user permissions** if needed

## Support

If you need help with:
- **API endpoint issues** - Check your Replit app logs
- **AppSheet configuration** - Refer to AppSheet documentation
- **Data sync problems** - Verify endpoint URLs are correct

Your medical data is now ready for mobile access through AppSheet!