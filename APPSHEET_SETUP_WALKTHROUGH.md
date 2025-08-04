# AppSheet Setup Walkthrough

## Step-by-Step Configuration

### Step 1: Get Your API URL
Your Replit app API base URL: `https://your-replit-name.replit.app/api/appsheet`

**To find your exact URL:**
1. Look at your Replit project URL (e.g., `https://providerloop-chains.replit.app`)
2. Add `/api/appsheet` to the end
3. Example: `https://providerloop-chains.replit.app/api/appsheet`

### Step 2: Create New AppSheet App

1. **Go to AppSheet.com**
   - Visit [appsheet.com](https://www.appsheet.com)
   - Sign in with your Google account

2. **Create New App**
   - Click "Create" → "Start with your own data"
   - Choose "REST API" as your data source

3. **Configure API Connection**
   - **Data Source Name**: `Patients`
   - **API Base URL**: `https://your-replit-name.replit.app/api/appsheet`
   - **API Method**: `GET`
   - **API Endpoint**: `/patients`

### Step 3: Configure Data Structure

1. **Primary Table Setup**
   - Table Name: `Patients`
   - Primary Key: `ID` 
   - Mark `ID` as auto-generated

2. **Field Configuration**
   Configure these key fields:

   ```
   ID - Number (Primary Key, Auto-generated)
   FirstName - Text (Required)
   LastName - Text (Required)
   DateOfBirth - Date
   Phone - Phone
   Email - Email
   Address - LongText
   MRN - Text
   OrderingMD - Text
   Diagnosis - Text
   Status - Enum (started, in_progress, completed, cancelled)
   
   # Insurance Fields
   PrimaryInsurance - Text
   PrimaryPlan - Text
   PrimaryInsuranceNumber - Text
   PrimaryGroupId - Text
   SecondaryInsurance - Text
   SecondaryPlan - Text
   SecondaryInsuranceNumber - Text
   SecondaryGroupId - Text
   
   # AI Analysis Fields
   FurtherAnalysis - LongText
   LetterOfMedicalNecessity - LongText
   ApprovalLikelihood - Text
   CriteriaAssessment - LongText
   DocumentationGaps - LongText
   Recommendations - LongText
   
   # System Fields
   CreatedAt - DateTime
   UpdatedAt - DateTime
   ```

### Step 4: Configure API Methods

1. **READ Operations**
   - **GET All**: `/patients`
   - **GET Single**: `/patients/{ID}`

2. **WRITE Operations**
   - **POST Create**: `/patients`
   - **PUT Update**: `/patients/{ID}`

3. **Test Connection**
   - Use AppSheet's "Test" button to verify connection
   - Should show your patient data

### Step 5: Customize App Interface

1. **Views Configuration**
   - **Table View**: Show all patients in a list
   - **Detail View**: Show individual patient details
   - **Form View**: For adding/editing patients

2. **Key Views to Create:**
   - **Patient List**: Table view with Name, Status, Insurance
   - **Patient Detail**: All fields organized in tabs
   - **Add Patient**: Form for new patient entry
   - **Analysis View**: Focus on AI analysis fields

### Step 6: Configure Permissions

1. **Read Permissions**: Allow all users to view patient data
2. **Write Permissions**: Restrict who can edit/add patients
3. **Field-Level Security**: Hide sensitive fields if needed

## Advanced Configuration

### Conditional Formatting
```
Status = "completed" → Green background
Status = "in_progress" → Yellow background
Status = "started" → Blue background
Status = "cancelled" → Red background
```

### Action Buttons
- **View Analysis**: Navigate to analysis details
- **Generate Report**: Export patient information
- **Send Letter**: Email letter of medical necessity

### Data Validation
- **Required Fields**: FirstName, LastName, OrderingMD
- **Email Format**: Validate email addresses
- **Phone Format**: Standard phone number format
- **Date Range**: DateOfBirth must be reasonable

## Testing Your Configuration

### Test Data Access
1. **View Patient List**: Should show all patients from your database
2. **Open Patient Detail**: Click on a patient to see full details
3. **Check AI Analysis**: Verify LEQVIO analysis data appears
4. **Test Updates**: Edit a patient field and verify it syncs back

### Troubleshooting Common Issues

**"No data found"**
- Check your API URL is correct
- Verify your Replit app is running
- Test API endpoint in browser: `https://your-app.replit.app/api/appsheet/patients`

**"Authentication Error"**
- Currently configured for open access
- If you added authentication, configure API keys in AppSheet

**"Field not recognized"**
- Check field names match exactly (case-sensitive)
- Verify data types are correct in AppSheet

## Mobile App Features

### Key Mobile Benefits
- **Offline Access**: AppSheet caches data for offline viewing
- **Photo Capture**: Add patient photos or document images
- **Location Services**: Record visit locations
- **Push Notifications**: Alerts for patient updates

### Recommended Mobile Views
1. **Quick Patient Search**: Search by name or MRN
2. **Status Dashboard**: Count by patient status
3. **Insurance Overview**: Primary/secondary insurance summary
4. **Analysis Summary**: Key LEQVIO analysis points

## Next Steps

1. **Test Your Connection**: Verify data loads correctly
2. **Customize Interface**: Organize fields for your workflow
3. **Add Mobile Features**: Photo capture, scanning, etc.
4. **Set User Permissions**: Control who can edit data
5. **Deploy to Users**: Share app with your team

Your patient data is now accessible on mobile devices with real-time sync to your medical database!