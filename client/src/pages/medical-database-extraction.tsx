import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
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

interface ChainOption {
  id: string
  name: string
  description: string
}

const availableChains: ChainOption[] = [
  { id: 'QuickAddQHC', name: 'Quick Patient Registration', description: 'Register new patient in system' },
  { id: 'ATTACHMENT PROCESSING (LABS)', name: 'Lab Processing', description: 'Process lab results and reports' },
  { id: 'ATTACHMENT PROCESSING (SLEEP STUDY)', name: 'Sleep Study Processing', description: 'Process sleep study results' },
  { id: 'REFERRAL PROCESSING', name: 'Referral Processing', description: 'Process patient referrals' },
  { id: 'CLIENT REPORT SENT', name: 'Client Report', description: 'Generate and send client reports' },
  { id: 'SLEEP STUDY RESULTS', name: 'Sleep Study Results', description: 'Process sleep study results' }
]

export default function MedicalDatabaseExtraction() {
  const { toast } = useToast()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [extractedData, setExtractedData] = useState<ExtractedPatientData | null>(null)
  const [selectedChain, setSelectedChain] = useState<string>('')
  const [sourceId, setSourceId] = useState<string>('')
  const [isManualSourceId, setIsManualSourceId] = useState<boolean>(false)
  const [additionalNotes, setAdditionalNotes] = useState<string>('')
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
      if (!extractedData || !selectedChain) {
        throw new Error('Missing required data')
      }

      const requestBody = {
        run_email: "jeffrey.Bander@providerloop.com",
        chain_to_run: selectedChain,
        human_readable_record: "Medical database screenshot processing from external app",
        source_id: sourceId,
        first_step_user_input: additionalNotes,
        starting_variables: {
          ...extractedData,
          extraction_source: "medical_database_screenshot",
          Patient_ID: sourceId,
          timestamp: new Date().toISOString(),
          ...(additionalNotes && { additional_notes: additionalNotes })
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
    if (extractedData && selectedChain) {
      triggerChainMutation.mutate()
    }
  }

  const resetForm = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    setExtractedData(null)
    setSelectedChain('')
    setSourceId('')
    setIsManualSourceId(false)
    setAdditionalNotes('')
    setChainRunId(null)
  }

  const handleSourceIdToggle = () => {
    setIsManualSourceId(!isManualSourceId)
    if (!isManualSourceId) {
      // Switching to manual - keep current value
    } else {
      // Switching to auto - regenerate if we have data
      if (extractedData?.patient_first_name && extractedData?.patient_last_name && extractedData?.patient_dob) {
        const firstName = extractedData.patient_first_name.replace(/\s+/g, '_')
        const lastName = extractedData.patient_last_name.replace(/\s+/g, '_')
        const dobFormatted = extractedData.patient_dob.replace(/[\/\-]/g, '_')
        const autoSourceId = `${lastName}_${firstName}__${dobFormatted}`
        setSourceId(autoSourceId)
      }
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Medical Database Screenshot Processing</h1>
        <p className="text-gray-600">Upload a screenshot from your medical database to extract patient information and trigger AIGENTS automation chains.</p>
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

        {/* Step 2: Review Extracted Data */}
        {extractedData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Step 2: Review Extracted Patient Data
              </CardTitle>
              <CardDescription>
                Verify the extracted information is correct before proceeding
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(extractedData).map(([key, value]) => (
                  value && (
                    <div key={key} className="space-y-1">
                      <Label className="text-sm font-medium text-gray-700">
                        {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Label>
                      <div className="p-2 bg-gray-50 rounded border text-sm">
                        {value}
                      </div>
                    </div>
                  )
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

        {/* Step 3: Configure Chain */}
        {extractedData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Step 3: Configure & Trigger Chain
              </CardTitle>
              <CardDescription>
                Select the automation chain to run with this patient data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="chain">Select Chain to Run</Label>
                <Select value={selectedChain} onValueChange={setSelectedChain}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an automation chain" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableChains.map((chain) => (
                      <SelectItem key={chain.id} value={chain.id}>
                        <div>
                          <div className="font-medium">{chain.name}</div>
                          <div className="text-sm text-gray-500">{chain.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="Any additional context or instructions for the chain..."
                  rows={3}
                />
              </div>

              <Button
                onClick={handleTriggerChain}
                disabled={!selectedChain || !sourceId.trim() || triggerChainMutation.isPending}
                className="w-full"
                size="lg"
              >
                {triggerChainMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Triggering Chain...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Trigger {availableChains.find(c => c.id === selectedChain)?.name || 'Chain'}
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