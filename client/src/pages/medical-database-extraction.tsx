import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { useToast } from '@/hooks/use-toast'
import { AlertCircle, Upload, Camera, Eye, Send, Loader2, UserPlus, ClipboardList } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'

interface ExtractedPatientData {
  patient_first_name?: string
  patient_last_name?: string
  patient_dob?: string
  patient_gender?: string
  patient_phone?: string
  patient_email?: string
  patient_address?: string
  patient_city?: string
  patient_state?: string
  patient_zip?: string
  patient_ssn?: string
  medical_record_number?: string
  insurance_provider?: string
  insurance_id?: string
  insurance_group?: string
  primary_care_physician?: string
  allergies?: string
  medications?: string
  medical_conditions?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  [key: string]: string | undefined
}



export default function MedicalDatabaseExtraction() {
  const { toast } = useToast()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [extractedData, setExtractedData] = useState<ExtractedPatientData | null>(null)
  const [editableData, setEditableData] = useState<ExtractedPatientData | null>(null)
  const [selectedChain] = useState<string>('leqvio')
  const [sourceId, setSourceId] = useState<string>('')
  const [isManualSourceId, setIsManualSourceId] = useState<boolean>(false)
  const [additionalNotes] = useState<string>('')
  const [chainRunId, setChainRunId] = useState<string | null>(null)
  const [entryMode, setEntryMode] = useState<'screenshot' | 'manual'>('screenshot')
  const [clinicalNotes, setClinicalNotes] = useState<string>('')
  const [clinicalFormFile, setClinicalFormFile] = useState<File | null>(null)
  const [clinicalPreviewUrl, setClinicalPreviewUrl] = useState<string | null>(null)
  const [extractedClinicalData, setExtractedClinicalData] = useState<string>('')

  // State for insurance information
  const [insuranceMode, setInsuranceMode] = useState<'manual' | 'screenshot'>('manual')
  const [insuranceFile, setInsuranceFile] = useState<File | null>(null)
  const [insurancePreviewUrl, setInsurancePreviewUrl] = useState<string>('')
  const [insuranceProvider, setInsuranceProvider] = useState<string>('')
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState<string>('')
  const [insuranceGroupNumber, setInsuranceGroupNumber] = useState<string>('')
  const [insuranceNotes, setInsuranceNotes] = useState<string>('')

  // Extract clinical data from screenshot
  const extractClinicalDataMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('photo', file)
      formData.append('extractionType', 'clinical_notes')
      
      const response = await fetch('/api/extract-patient-info', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        throw new Error('Failed to extract clinical data')
      }
      
      return response.json()
    },
    onSuccess: (data) => {
      setExtractedClinicalData(data.extractedData?.rawData || '')
      setClinicalNotes(data.extractedData?.rawData || '')
      
      // Try to parse patient data from LEQVIO form
      const rawData = data.extractedData?.rawData || ''
      const parsedPatientData = parsePatientDataFromLeqvioForm(rawData)
      
      if (parsedPatientData && Object.keys(parsedPatientData).length > 0) {
        setExtractedData(parsedPatientData)
        setEditableData({ ...parsedPatientData })
        
        // Auto-generate source ID if we have name and DOB
        if (parsedPatientData.patient_first_name && parsedPatientData.patient_last_name && parsedPatientData.patient_dob) {
          const firstName = parsedPatientData.patient_first_name.replace(/\s+/g, '_')
          const lastName = parsedPatientData.patient_last_name.replace(/\s+/g, '_')
          const dobFormatted = parsedPatientData.patient_dob.replace(/[\/\-]/g, '_')
          const autoSourceId = `${lastName}_${firstName}__${dobFormatted}`
          setSourceId(autoSourceId)
        }
      }
      
      toast({
        title: "LEQVIO form processed successfully",
        description: "Patient data extracted from form. Review and edit as needed."
      })
    },
    onError: (error) => {
      toast({
        title: "Extraction failed",
        description: "Failed to extract clinical data from screenshot. Please try again.",
        variant: "destructive"
      })
      console.error('Clinical data extraction error:', error)
    }
  })

  // Extract patient data from screenshot
  const extractDataMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('photo', file)
      formData.append('extractionType', 'medical_database')
      
      const response = await fetch('/api/extract-patient-info', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        throw new Error('Failed to extract patient data')
      }
      
      return response.json()
    },
    onSuccess: (data) => {
      setExtractedData(data.extractedData)
      setEditableData({ ...data.extractedData })
      
      // Auto-generate source ID if we have name and DOB
      if (data.extractedData.patient_first_name && data.extractedData.patient_last_name && data.extractedData.patient_dob) {
        const firstName = data.extractedData.patient_first_name.replace(/\s+/g, '_')
        const lastName = data.extractedData.patient_last_name.replace(/\s+/g, '_')
        const dobFormatted = data.extractedData.patient_dob.replace(/[\/\-]/g, '_')
        const autoSourceId = `${lastName}_${firstName}__${dobFormatted}`
        setSourceId(autoSourceId)
      }
      
      toast({
        title: "Success",
        description: "Patient data extracted successfully",
        variant: "default",
      })
    },
    onError: (error) => {
      toast({
        title: "Extraction Failed",
        description: error instanceof Error ? error.message : "Failed to extract patient data",
        variant: "destructive",
      })
    }
  })

  // Trigger AIGENTS chain
  const triggerChainMutation = useMutation({
    mutationFn: async () => {
      if (!editableData || !selectedChain) {
        throw new Error('Missing required data')
      }

      const requestBody = {
        run_email: "jeffrey.Bander@providerloop.com",
        chain_to_run: selectedChain,
        human_readable_record: "Medical database screenshot processing from external app",
        source_id: sourceId,
        first_step_user_input: "",
        starting_variables: {
          ...editableData,
          extraction_source: "medical_database_screenshot",
          Patient_ID: sourceId,
          timestamp: new Date().toISOString(),
          raw_data: JSON.stringify(extractedData || {}),
          // Include specific patient variables for Screenshot_Patient_Creator chain
          Patient_Address: editableData.patient_address || '',
          first_name: editableData.patient_first_name || '',
          last_name: editableData.patient_last_name || '',
          date_of_birth: editableData.patient_dob || '',
          Patient_Primary_Insurance: insuranceProvider || editableData.insurance_provider || '',
          Patient_Primary_Insurance_ID: insurancePolicyNumber || editableData.insurance_id || '',
          Patient_Secondary_Insurance: editableData.secondary_insurance || '',
          Patient_Secondary_Insurance_ID: editableData.secondary_insurance_id || '',
          Patient_Phone_Number: editableData.patient_phone || '',
          Patient_Email: editableData.patient_email || '',
          clinical_notes: clinicalNotes || '',
          insurance_provider: insuranceProvider || '',
          insurance_policy_number: insurancePolicyNumber || '',
          insurance_group_number: insuranceGroupNumber || '',
          insurance_notes: insuranceNotes || ''
        }
      }

      const response = await fetch("https://start-chain-run-943506065004.us-central1.run.app", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to trigger chain')
      }

      return result
    },
    onSuccess: (result) => {
      // Extract ChainRun_ID from response
      let extractedChainRunId = result.ChainRun_ID || null
      
      if (!extractedChainRunId && result.responses && result.responses[0] && result.responses[0].rows) {
        const firstRow = result.responses[0].rows[0]
        extractedChainRunId = firstRow["Run_ID"] || firstRow["_RowNumber"] || firstRow["ID"] || 
                             firstRow["Run_Auto_Key"] || firstRow["Chain_Run_Key"] || firstRow.id
      }
      
      setChainRunId(extractedChainRunId)
      
      toast({
        title: "Chain Triggered Successfully",
        description: `Chain Run ID: ${extractedChainRunId}`,
        variant: "default",
      })
    },
    onError: (error) => {
      toast({
        title: "Chain Trigger Failed",
        description: error instanceof Error ? error.message : "Failed to trigger chain",
        variant: "destructive",
      })
    }
  })

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      
      // Create preview URL
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      
      // Reset previous data
      setExtractedData(null)
      setEditableData(null)
      setSourceId('')
      setChainRunId(null)
    }
  }

  const handleExtractData = () => {
    if (selectedFile) {
      extractDataMutation.mutate(selectedFile)
    }
  }

  const handleClinicalFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setClinicalFormFile(file)
      
      // Create preview URL for supported formats
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file)
        setClinicalPreviewUrl(url)
      } else {
        setClinicalPreviewUrl(null)
      }
      
      // Reset previous data
      setExtractedClinicalData('')
      setClinicalNotes('')
    }
  }

  const handleExtractClinicalData = () => {
    if (clinicalFormFile) {
      extractClinicalDataMutation.mutate(clinicalFormFile)
    }
  }

  const handleInsuranceFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setInsuranceFile(file)
      
      // Create preview URL for supported formats
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file)
        setInsurancePreviewUrl(url)
      } else {
        setInsurancePreviewUrl('')
      }
    }
  }

  // Extract insurance data from screenshot
  const extractInsuranceDataMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('photo', file)
      formData.append('extractionType', 'insurance_card')
      
      const response = await fetch('/api/extract-patient-info', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        throw new Error('Failed to extract insurance data')
      }
      
      return response.json()
    },
    onSuccess: (data) => {
      const rawData = data.extractedData?.rawData || ''
      
      // Parse insurance information from extracted text
      const providerMatch = rawData.match(/Insurance Provider:\s*([^\n]+)/i) ||
                           rawData.match(/Plan Name:\s*([^\n]+)/i) ||
                           rawData.match(/Company:\s*([^\n]+)/i)
      
      const policyMatch = rawData.match(/Policy Number:\s*([^\n]+)/i) ||
                         rawData.match(/Member ID:\s*([^\n]+)/i) ||
                         rawData.match(/ID:\s*([^\n]+)/i)
      
      const groupMatch = rawData.match(/Group Number:\s*([^\n]+)/i) ||
                        rawData.match(/Group:\s*([^\n]+)/i)
      
      if (providerMatch) setInsuranceProvider(providerMatch[1].trim())
      if (policyMatch) setInsurancePolicyNumber(policyMatch[1].trim())
      if (groupMatch) setInsuranceGroupNumber(groupMatch[1].trim())
      
      setInsuranceNotes(rawData)
      
      toast({
        title: "Insurance data extracted successfully",
        description: "Review and edit the insurance information as needed."
      })
    },
    onError: (error) => {
      toast({
        title: "Extraction Failed",
        description: error instanceof Error ? error.message : "Failed to extract insurance data",
        variant: "destructive",
      })
    }
  })

  const handleExtractInsuranceData = () => {
    if (insuranceFile) {
      extractInsuranceDataMutation.mutate(insuranceFile)
    }
  }

  // Parse patient data from LEQVIO form raw text
  const parsePatientDataFromLeqvioForm = (rawData: string): ExtractedPatientData | null => {
    if (!rawData) return null
    
    try {
      // Extract common patterns from LEQVIO form data
      const data: Partial<ExtractedPatientData> = {}
      
      // Name extraction patterns
      const firstNameMatch = rawData.match(/First Name:\s*([^\n]+)/i)
      const lastNameMatch = rawData.match(/Last Name:\s*([^\n]+)/i)
      
      if (firstNameMatch) data.patient_first_name = firstNameMatch[1].trim()
      if (lastNameMatch) data.patient_last_name = lastNameMatch[1].trim()
      
      // Date of birth pattern
      const dobMatch = rawData.match(/Date of Birth:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i) ||
                      rawData.match(/DOB:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)
      if (dobMatch) data.patient_dob = dobMatch[1]
      
      // Phone number pattern
      const phoneMatch = rawData.match(/Phone[^\d]*(\(\d{3}\)\s*\d{3}-\d{4}|\d{3}-\d{3}-\d{4}|\d{10})/i)
      if (phoneMatch) data.patient_phone = phoneMatch[1]
      
      // Email pattern
      const emailMatch = rawData.match(/Email:\s*([^\s\n]+@[^\s\n]+)/i)
      if (emailMatch) data.patient_email = emailMatch[1]
      
      // Address pattern
      const addressMatch = rawData.match(/Address:\s*([^\n]+)/i)
      if (addressMatch) data.patient_address = addressMatch[1].trim()
      
      // Sex/Gender pattern
      const sexMatch = rawData.match(/Sex:\s*(Male|Female)/i)
      if (sexMatch) data.patient_gender = sexMatch[1]
      
      return Object.keys(data).length > 0 ? data as ExtractedPatientData : null
    } catch (error) {
      console.error('Error parsing LEQVIO form data:', error)
      return null
    }
  }

  const handleTriggerChain = () => {
    if (editableData && selectedChain) {
      triggerChainMutation.mutate()
    }
  }

  const resetForm = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    setExtractedData(null)
    setEditableData(null)
    setSourceId('')
    setIsManualSourceId(false)
    setChainRunId(null)
    setClinicalNotes('')
    setClinicalFormFile(null)
    setClinicalPreviewUrl(null)
    setExtractedClinicalData('')
  }

  const startManualEntry = () => {
    const emptyData: ExtractedPatientData = {
      patient_first_name: '',
      patient_last_name: '',
      patient_dob: '',
      patient_gender: '',
      patient_phone: '',
      patient_email: '',
      patient_address: '',
      patient_city: '',
      patient_state: '',
      patient_zip: '',
      patient_ssn: '',
      medical_record_number: '',
      insurance_provider: '',
      insurance_id: '',
      insurance_group: '',
      primary_care_physician: '',
      allergies: '',
      medications: '',
      medical_conditions: '',
      emergency_contact_name: '',
      emergency_contact_phone: ''
    }
    setExtractedData(emptyData)
    setEditableData(emptyData)
    setChainRunId(null)
  }

  const resetToOriginal = () => {
    if (extractedData) {
      setEditableData({ ...extractedData })
      
      // Regenerate source ID if needed
      if (!isManualSourceId && extractedData.patient_first_name && extractedData.patient_last_name && extractedData.patient_dob) {
        const firstName = extractedData.patient_first_name.replace(/\s+/g, '_')
        const lastName = extractedData.patient_last_name.replace(/\s+/g, '_')
        const dobFormatted = extractedData.patient_dob.replace(/[\/\-]/g, '_')
        const autoSourceId = `${lastName}_${firstName}__${dobFormatted}`
        setSourceId(autoSourceId)
      }
    }
  }

  const handleSourceIdToggle = () => {
    setIsManualSourceId(!isManualSourceId)
    if (!isManualSourceId) {
      // Switching to manual - keep current value
    } else {
      // Switching to auto - regenerate if we have data
      if (editableData?.patient_first_name && editableData?.patient_last_name && editableData?.patient_dob) {
        const firstName = editableData.patient_first_name.replace(/\s+/g, '_')
        const lastName = editableData.patient_last_name.replace(/\s+/g, '_')
        const dobFormatted = editableData.patient_dob.replace(/[\/\-]/g, '_')
        const autoSourceId = `${lastName}_${firstName}__${dobFormatted}`
        setSourceId(autoSourceId)
      }
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Patient Data Processing</h1>
        <p className="text-gray-600">Upload LEQVIO Service Center Start Forms to extract patient information and create new patient records with leqvio chain automation.</p>
      </div>

      <div className="grid gap-6">
        {/* Step 1: LEQVIO Form Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Step 1: LEQVIO Form Upload
            </CardTitle>
            <CardDescription>
              Upload the completed LEQVIO Service Center Start Form to extract patient information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="leqvio-form">LEQVIO Form Upload</Label>
                <Input
                  id="leqvio-form"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp"
                  onChange={handleClinicalFileSelect}
                  className="mt-1"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Upload the completed LEQVIO form (PDF) or image to extract patient data
                </p>
              </div>
              
              {clinicalPreviewUrl && (
                <div className="space-y-2">
                  <Label>Preview</Label>
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <img
                      src={clinicalPreviewUrl}
                      alt="LEQVIO form preview"
                      className="max-w-full h-auto max-h-64 object-contain mx-auto"
                    />
                  </div>
                </div>
              )}

              {clinicalFormFile && (
                <Button 
                  onClick={handleExtractClinicalData}
                  disabled={extractClinicalDataMutation.isPending}
                  className="w-full"
                >
                  {extractClinicalDataMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing LEQVIO Form...
                    </>
                  ) : (
                    <>
                      <Eye className="mr-2 h-4 w-4" />
                      Extract Patient Data from LEQVIO Form
                    </>
                  )}
                </Button>
              )}

              {extractedClinicalData && (
                <div className="space-y-2">
                  <Label>Extracted Form Information</Label>
                  <Textarea
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    className="min-h-[120px]"
                    placeholder="Review and edit extracted LEQVIO form information..."
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Insurance Information */}
        {extractedClinicalData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Step 2: Insurance Information
              </CardTitle>
              <CardDescription>
                Add insurance information manually or by uploading insurance card screenshots
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button 
                    variant={insuranceMode === 'manual' ? 'default' : 'outline'}
                    onClick={() => setInsuranceMode('manual')}
                    className="flex items-center gap-2"
                  >
                    <UserPlus className="h-4 w-4" />
                    Manual Entry
                  </Button>
                  <Button 
                    variant={insuranceMode === 'screenshot' ? 'default' : 'outline'}
                    onClick={() => setInsuranceMode('screenshot')}
                    className="flex items-center gap-2"
                  >
                    <Camera className="h-4 w-4" />
                    Upload Insurance Card
                  </Button>
                </div>
                
                {insuranceMode === 'manual' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="insurance-provider">Insurance Provider</Label>
                        <Input
                          id="insurance-provider"
                          value={insuranceProvider}
                          onChange={(e) => setInsuranceProvider(e.target.value)}
                          placeholder="e.g., Blue Cross Blue Shield"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="policy-number">Policy/Member ID</Label>
                        <Input
                          id="policy-number"
                          value={insurancePolicyNumber}
                          onChange={(e) => setInsurancePolicyNumber(e.target.value)}
                          placeholder="Policy or Member ID number"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="group-number">Group Number</Label>
                        <Input
                          id="group-number"
                          value={insuranceGroupNumber}
                          onChange={(e) => setInsuranceGroupNumber(e.target.value)}
                          placeholder="Group number (if applicable)"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="insurance-notes">Additional Insurance Notes</Label>
                      <Textarea
                        id="insurance-notes"
                        value={insuranceNotes}
                        onChange={(e) => setInsuranceNotes(e.target.value)}
                        placeholder="Any additional insurance information or notes..."
                        className="min-h-[80px] mt-1"
                      />
                    </div>
                  </div>
                )}
                
                {insuranceMode === 'screenshot' && (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="insurance-card">Insurance Card Screenshot</Label>
                      <Input
                        id="insurance-card"
                        type="file"
                        accept="image/*"
                        onChange={handleInsuranceFileSelect}
                        className="mt-1"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Upload a clear photo of the front and/or back of the insurance card
                      </p>
                    </div>
                    
                    {insurancePreviewUrl && (
                      <div className="space-y-2">
                        <Label>Preview</Label>
                        <div className="border rounded-lg p-4 bg-gray-50">
                          <img
                            src={insurancePreviewUrl}
                            alt="Insurance card preview"
                            className="max-w-full h-auto max-h-64 object-contain mx-auto"
                          />
                        </div>
                      </div>
                    )}

                    {insuranceFile && (
                      <Button 
                        onClick={handleExtractInsuranceData}
                        disabled={extractInsuranceDataMutation.isPending}
                        className="w-full"
                      >
                        {extractInsuranceDataMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Extracting Insurance Information...
                          </>
                        ) : (
                          <>
                            <Eye className="mr-2 h-4 w-4" />
                            Extract Insurance Information
                          </>
                        )}
                      </Button>
                    )}

                    {(insuranceProvider || insurancePolicyNumber || insuranceGroupNumber) && (
                      <div className="space-y-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <Label className="text-blue-800">Extracted Insurance Information</Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          {insuranceProvider && (
                            <div>
                              <span className="font-medium">Provider:</span> {insuranceProvider}
                            </div>
                          )}
                          {insurancePolicyNumber && (
                            <div>
                              <span className="font-medium">Policy ID:</span> {insurancePolicyNumber}
                            </div>
                          )}
                          {insuranceGroupNumber && (
                            <div>
                              <span className="font-medium">Group:</span> {insuranceGroupNumber}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Review & Edit Patient Data */}
        {extractedData && editableData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Step 2: Review & Edit Patient Data
              </CardTitle>
              <CardDescription>
                Review and modify the patient information as needed before creating the record
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-600">Edit any fields as needed</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetToOriginal}
                  className="text-xs"
                >
                  Reset to Original
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(editableData).map(([key, value]) => (
                  <div key={key} className="space-y-1">
                    <Label htmlFor={key} className="text-sm font-medium text-gray-700">
                      {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Label>
                    <Input
                      id={key}
                      value={value || ''}
                      onChange={(e) => setEditableData(prev => prev ? { ...prev, [key]: e.target.value } : null)}
                      placeholder={`Enter ${key.replace(/_/g, ' ').toLowerCase()}`}
                      className="text-sm"
                    />
                  </div>
                ))}
              </div>

              {/* Source ID Configuration */}
              <div className="space-y-2 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <Label htmlFor="sourceId">Patient Source ID</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSourceIdToggle}
                  >
                    {isManualSourceId ? 'Switch to Auto' : 'Edit Manually'}
                  </Button>
                </div>
                <Input
                  id="sourceId"
                  value={sourceId}
                  onChange={(e) => setSourceId(e.target.value)}
                  placeholder="Patient_Source_ID"
                  disabled={!isManualSourceId}
                  className={!isManualSourceId ? 'bg-gray-50' : ''}
                />
                {!isManualSourceId && (
                  <p className="text-sm text-gray-500">
                    Auto-generated from patient name and date of birth
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}



        {/* Step 4: Create Patient */}
        {editableData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Step 4: Create Patient Record
              </CardTitle>
              <CardDescription>
                Create a new patient record using the Screenshot Patient Creator automation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="font-medium text-blue-800">Leqvio</span>
                </div>
                <p className="text-sm text-blue-700">
                  This automation will process the patient information using the Leqvio chain workflow.
                </p>
              </div>

              <Button
                onClick={handleTriggerChain}
                disabled={!sourceId.trim() || triggerChainMutation.isPending}
                className="w-full"
                size="lg"
              >
                {triggerChainMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Patient Record...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Create Patient Record
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Results */}
        {chainRunId && (
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="text-green-800 flex items-center gap-2">
                ✓ Chain Successfully Triggered
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-green-700">Chain Run ID</Label>
                  <div className="p-2 bg-white rounded border text-sm font-mono">
                    {chainRunId}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-green-700">Patient Source ID</Label>
                  <div className="p-2 bg-white rounded border text-sm">
                    {sourceId}
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => window.open(`https://aigents-realtime-logs-943506065004.us-central1.run.app/?chainRunId=${chainRunId}`, '_blank')}
                  className="flex-1"
                >
                  View in AIGENTS Dashboard
                </Button>
                <Button
                  variant="outline"
                  onClick={resetForm}
                  className="flex-1"
                >
                  Process Another Screenshot
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}