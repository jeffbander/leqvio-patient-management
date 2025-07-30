import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { useToast } from '@/hooks/use-toast'
import { AlertCircle, Upload, Camera, Eye, Send, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

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
  const [selectedChain] = useState<string>('Screenshot_Patient_Creator')
  const [sourceId, setSourceId] = useState<string>('')
  const [isManualSourceId, setIsManualSourceId] = useState<boolean>(false)
  const [additionalNotes] = useState<string>('')
  const [chainRunId, setChainRunId] = useState<string | null>(null)

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
          Patient_Primary_Insurance: editableData.insurance_provider || '',
          Patient_Primary_Insurance_ID: editableData.insurance_id || '',
          Patient_Secondary_Insurance: editableData.secondary_insurance || '',
          Patient_Secondary_Insurance_ID: editableData.secondary_insurance_id || '',
          Patient_Phone_Number: editableData.patient_phone || '',
          Patient_Email: editableData.patient_email || ''
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Medical Database Screenshot Processing</h1>
        <p className="text-gray-600">Upload a screenshot from your medical database to extract patient information and create a new patient record.</p>
      </div>

      <div className="grid gap-6">
        {/* Step 1: Upload Screenshot */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Step 1: Upload Medical Database Screenshot
            </CardTitle>
            <CardDescription>
              Select a screenshot from your medical database containing patient information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="screenshot">Choose Screenshot</Label>
              <Input
                id="screenshot"
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="mt-1"
              />
            </div>
            
            {previewUrl && (
              <div className="space-y-2">
                <Label>Preview</Label>
                <div className="border rounded-lg p-4 bg-gray-50">
                  <img
                    src={previewUrl}
                    alt="Screenshot preview"
                    className="max-w-full h-auto max-h-96 object-contain mx-auto"
                  />
                </div>
              </div>
            )}

            <Button 
              onClick={handleExtractData}
              disabled={!selectedFile || extractDataMutation.isPending}
              className="w-full"
            >
              {extractDataMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Extracting Patient Data...
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Extract Patient Data
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Step 2: Review & Edit Extracted Data */}
        {extractedData && editableData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Step 2: Review & Edit Patient Data
              </CardTitle>
              <CardDescription>
                Review and modify the extracted information as needed before proceeding
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

        {/* Step 3: Create Patient */}
        {editableData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Step 3: Create Patient Record
              </CardTitle>
              <CardDescription>
                Create a new patient record using the Screenshot Patient Creator automation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="font-medium text-blue-800">Screenshot Patient Creator</span>
                </div>
                <p className="text-sm text-blue-700">
                  This automation will create a new patient record using the extracted information from your medical database screenshot.
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

        {/* Step 4: Results */}
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