import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useParams, Link } from 'wouter'
import { apiRequest, queryClient } from '@/lib/queryClient'
import { 
  ArrowLeft, 
  Camera, 
  Eye,
  FileText,
  FileSearch,
  Upload, 
  Save, 
  Loader2,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Stethoscope,
  Shield,
  History,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Target,
  Trash2,
  X,
  Plus,
  Copy
} from 'lucide-react'
import { format } from 'date-fns'
import { EpicInsuranceExtractor } from '@/components/EpicInsuranceExtractor'

// Component to display organized notes with sections
const OrganizedNotesDisplay = ({ notes }: { notes?: string | null }) => {
  if (!notes) {
    return <div className="text-gray-400 italic">No notes</div>
  }

  // Parse notes into sections
  const sections = {
    notes: [] as string[],
    voicemails: [] as string[],
    insuranceUpdates: [] as string[]
  }

  const lines = notes.split('\n')
  let currentSection = 'notes' // Default section for legacy notes

  for (const line of lines) {
    if (line === '=== NOTES ===') {
      currentSection = 'notes'
      continue
    } else if (line === '=== VOICEMAILS ===') {
      currentSection = 'voicemails'
      continue
    } else if (line === '=== INSURANCE & AUTH UPDATES ===') {
      currentSection = 'insuranceUpdates'
      continue
    }

    if (line.trim()) {
      if (currentSection === 'notes') {
        sections.notes.push(line)
      } else if (currentSection === 'voicemails') {
        sections.voicemails.push(line)
      } else if (currentSection === 'insuranceUpdates') {
        sections.insuranceUpdates.push(line)
      }
    }
  }

  // If no sections found, treat as legacy unorganized notes
  const hasOrganizedSections = notes.includes('=== NOTES ===') || notes.includes('=== VOICEMAILS ===') || notes.includes('=== INSURANCE & AUTH UPDATES ===')
  
  if (!hasOrganizedSections) {
    return <div className="whitespace-pre-line">{notes}</div>
  }

  return (
    <div className="space-y-4">
      {sections.notes.length > 0 && (
        <div>
          <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-2">
            <FileText className="h-4 w-4" />
            Notes
          </h4>
          <div className="pl-6 space-y-1">
            {sections.notes.map((note, idx) => (
              <div key={idx} className="text-sm text-gray-700 whitespace-pre-line">{note}</div>
            ))}
          </div>
        </div>
      )}
      
      {sections.voicemails.length > 0 && (
        <div>
          <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-2">
            <Phone className="h-4 w-4" />
            Voicemails
          </h4>
          <div className="pl-6 space-y-1">
            {sections.voicemails.map((voicemail, idx) => (
              <div key={idx} className="text-sm text-blue-700 whitespace-pre-line">{voicemail}</div>
            ))}
          </div>
        </div>
      )}
      
      {sections.insuranceUpdates.length > 0 && (
        <div>
          <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-2">
            <Shield className="h-4 w-4" />
            Insurance & Auth Updates
          </h4>
          <div className="pl-6 space-y-1">
            {sections.insuranceUpdates.map((update, idx) => (
              <div key={idx} className="text-sm text-green-700 whitespace-pre-line">{update}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface Patient {
  id: number
  firstName: string
  lastName: string
  dateOfBirth: string
  orderingMD: string
  diagnosis: string
  status: string
  phone?: string
  email?: string
  address?: string
  mrn?: string
  primaryInsurance?: string
  primaryPlan?: string
  primaryInsuranceNumber?: string
  primaryGroupId?: string
  secondaryInsurance?: string
  secondaryPlan?: string
  secondaryInsuranceNumber?: string
  secondaryGroupId?: string
  authNumber?: string
  refNumber?: string
  startDate?: string
  endDate?: string
  notes?: string
  leqvioCopayProgram?: boolean
  leqvioCvgStatus?: string
  leqvioEffectiveFrom?: string
  leqvioSubscriber?: string
  leqvioSubscriberId?: string
  createdAt: string
  updatedAt: string
}

interface PatientDocument {
  id: number
  documentType: string
  fileName: string
  extractedData?: string
  metadata?: any
  createdAt: string
}

interface Appointment {
  id: number
  patientId: number
  appointmentDate: string
  doseNumber: number
  status: string
  createdAt: string
  updatedAt: string
}

export default function PatientDetail() {
  const { toast } = useToast()
  const params = useParams()
  const patientId = parseInt(params.id as string)
  
  const [isEditing, setIsEditing] = useState(false)
  const [isEditingInsurance, setIsEditingInsurance] = useState(false)
  const [isEditingLeqvio, setIsEditingLeqvio] = useState(false)
  const [editedData, setEditedData] = useState<any>({})
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [documentType, setDocumentType] = useState<string>('epic_insurance_screenshot')
  const [clinicalNotes, setClinicalNotes] = useState('')
  const [processResult, setProcessResult] = useState<any>(null)
  const [showAigentsData, setShowAigentsData] = useState(false)
  const [viewedDocument, setViewedDocument] = useState<PatientDocument | null>(null)
  const [showAddAppointment, setShowAddAppointment] = useState(false)
  const [appointmentForm, setAppointmentForm] = useState({
    appointmentDate: '',
    doseNumber: 1
  })

  // Helper function to parse AIGENTS response
  const parseAigentsResponse = (response: string) => {
    if (!response || response === 'No response content' || response === 'Webhook received (no response content)') {
      return null
    }

    try {
      const lines = response.split('\n')
      let approvalLikelihood = ''
      let criteriaItems: Array<{text: string, status: 'passed' | 'failed' | 'unknown'}> = []
      let documentationGaps: string[] = []
      let recommendations: string[] = []

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        
        // Extract approval likelihood
        if (line.includes('APPROVAL LIKELIHOOD:')) {
          approvalLikelihood = line.replace('APPROVAL LIKELIHOOD:', '').trim()
        }
        
        // Extract criteria assessment
        if (line.includes('CRITERIA ASSESSMENT')) {
          for (let j = i + 1; j < lines.length && !lines[j].includes('DOCUMENTATION GAPS'); j++) {
            const criteriaLine = lines[j].trim()
            if (criteriaLine.includes('✓')) {
              criteriaItems.push({
                text: criteriaLine.replace('✓', '').replace('•', '').trim(),
                status: 'passed'
              })
            } else if (criteriaLine.includes('✗')) {
              criteriaItems.push({
                text: criteriaLine.replace('✗', '').replace('•', '').trim(),
                status: 'failed'
              })
            }
          }
        }
        
        // Extract documentation gaps
        if (line.includes('DOCUMENTATION GAPS:')) {
          for (let j = i + 1; j < lines.length && !lines[j].includes('RECOMMENDATIONS'); j++) {
            const gapLine = lines[j].trim()
            if (gapLine.startsWith('–') || gapLine.startsWith('-')) {
              documentationGaps.push(gapLine.replace(/^[–-]/, '').trim())
            }
          }
        }
        
        // Extract recommendations
        if (line.includes('RECOMMENDATIONS:')) {
          for (let j = i + 1; j < lines.length && !lines[j].includes('ALTERNATIVE STRATEGIES'); j++) {
            const recLine = lines[j].trim()
            if (recLine.match(/^\d+\./)) {
              recommendations.push(recLine.replace(/^\d+\./, '').trim())
            }
          }
        }
      }

      return {
        approvalLikelihood,
        criteriaItems,
        documentationGaps,
        recommendations
      }
    } catch (error) {
      console.error('Error parsing AIGENTS response:', error)
      return null
    }
  }

  const { data: patient, isLoading: patientLoading } = useQuery<Patient>({
    queryKey: [`/api/patients/${patientId}`],
    enabled: !!patientId
  })

  const { data: documents = [], isLoading: documentsLoading } = useQuery<PatientDocument[]>({
    queryKey: [`/api/patients/${patientId}/documents`],
    enabled: !!patientId
  })

  const { data: automationLogs = [] } = useQuery({
    queryKey: [`/api/patients/${patientId}/automation-logs`],
    enabled: !!patientId
  }) as { data: any[] }

  const { data: appointments = [], isLoading: appointmentsLoading } = useQuery<Appointment[]>({
    queryKey: [`/api/patients/${patientId}/appointments`],
    enabled: !!patientId
  })

  // Get latest AIGENTS analysis - moved after automationLogs query
  const latestAnalysis = automationLogs.length > 0 && automationLogs[0].agentresponse 
    ? parseAigentsResponse(automationLogs[0].agentresponse)
    : null
    
  // Extract additional webhook variables
  const latestWebhookData = automationLogs.length > 0 && automationLogs[0].webhookpayload
    ? automationLogs[0].webhookpayload
    : null
    
  const furtherAnalysis = latestWebhookData?.websearch || latestWebhookData?.webSearch || latestWebhookData?.web_search || null
  const letterOfMedicalNecessity = latestWebhookData?.lettofneed || latestWebhookData?.letterOfNeed || latestWebhookData?.letter_of_need || null

  const updatePatientMutation = useMutation({
    mutationFn: async (updates: Partial<Patient>) => {
      return apiRequest('PATCH', `/api/patients/${patientId}`, updates)
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Patient information updated successfully"
      })
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}`] })
      setIsEditing(false)
      setIsEditingInsurance(false)
      setIsEditingLeqvio(false)
      setEditedData({})
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update patient",
        variant: "destructive"
      })
    }
  })

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      return apiRequest('PATCH', `/api/patients/${patientId}/status`, { status })
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Patient status updated"
      })
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}`] })
    }
  })

  const uploadDocumentMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch(`/api/patients/${patientId}/documents`, {
        method: 'POST',
        body: formData
      })
      if (!response.ok) throw new Error('Failed to upload document')
      return response.json()
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Document uploaded and processed successfully"
      })
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/documents`] })
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}`] })
      setSelectedFile(null)
      
      // If insurance data was extracted, show it
      if (data.extractedData && Object.keys(data.extractedData).length > 0) {
        toast({
          title: "Data Extracted",
          description: "Insurance information has been extracted and saved"
        })
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload document",
        variant: "destructive"
      })
    }
  })

  const processDataMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/patients/${patientId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      if (!response.ok) throw new Error('Failed to process patient data')
      return response.json()
    },
    onSuccess: (data) => {
      setProcessResult(data)
      toast({
        title: "Success",
        description: `Data processed successfully. ${data.documentsProcessed.insurance} insurance and ${data.documentsProcessed.clinical} clinical documents sent to AIGENTS.`
      })
      // Refresh automation logs to show the new process event
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/automation-logs`] })
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process patient data",
        variant: "destructive"
      })
    }
  })

  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: number) => {
      const response = await fetch(`/api/patients/${patientId}/documents/${documentId}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to delete document')
      return response.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Document deleted successfully"
      })
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/documents`] })
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete document",
        variant: "destructive"
      })
    }
  })

  const createAppointmentMutation = useMutation({
    mutationFn: async (appointmentData: { appointmentDate: string; doseNumber: number }) => {
      return apiRequest('POST', `/api/patients/${patientId}/appointments`, appointmentData)
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Appointment created successfully"
      })
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/appointments`] })
      setShowAddAppointment(false)
      setAppointmentForm({ appointmentDate: '', doseNumber: 1 })
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create appointment",
        variant: "destructive"
      })
    }
  })

  const updateAppointmentMutation = useMutation({
    mutationFn: async ({ appointmentId, updates }: { appointmentId: number; updates: Partial<Appointment> }) => {
      return apiRequest('PATCH', `/api/appointments/${appointmentId}`, updates)
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Appointment updated successfully"
      })
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/appointments`] })
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update appointment",
        variant: "destructive"
      })
    }
  })

  const deleteAppointmentMutation = useMutation({
    mutationFn: async (appointmentId: number) => {
      return apiRequest('DELETE', `/api/appointments/${appointmentId}`)
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Appointment deleted successfully"
      })
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/appointments`] })
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete appointment",
        variant: "destructive"
      })
    }
  })

  const handleEdit = () => {
    if (!patient) return
    setEditedData({
      phone: patient.phone || '',
      email: patient.email || '',
      address: patient.address || '',
      orderingMD: patient.orderingMD || '',
      diagnosis: patient.diagnosis || '',
      mrn: patient.mrn || '',
      authNumber: patient.authNumber || '',
      refNumber: patient.refNumber || '',
      startDate: patient.startDate || '',
      endDate: patient.endDate || '',
      notes: patient.notes || ''
    })
    setIsEditing(true)
  }

  const handleEditInsurance = () => {
    if (!patient) return
    setEditedData({
      primaryInsurance: patient.primaryInsurance || '',
      primaryPlan: patient.primaryPlan || '',
      primaryInsuranceNumber: patient.primaryInsuranceNumber || '',
      primaryGroupId: patient.primaryGroupId || '',
      secondaryInsurance: patient.secondaryInsurance || '',
      secondaryPlan: patient.secondaryPlan || '',
      secondaryInsuranceNumber: patient.secondaryInsuranceNumber || '',
      secondaryGroupId: patient.secondaryGroupId || ''
    })
    setIsEditingInsurance(true)
  }

  const handleSave = () => {
    // Only send fields that can be updated
    const updateData: any = {
      firstName: editedData.firstName,
      lastName: editedData.lastName,
      dateOfBirth: editedData.dateOfBirth,
      orderingMD: editedData.orderingMD,
      diagnosis: editedData.diagnosis,
      phone: editedData.phone,
      email: editedData.email,
      address: editedData.address,
      mrn: editedData.mrn,
      notes: editedData.notes,
      authNumber: editedData.authNumber,
      refNumber: editedData.refNumber,
      startDate: editedData.startDate,
      endDate: editedData.endDate,
      primaryInsurance: editedData.primaryInsurance,
      primaryPlan: editedData.primaryPlan,
      primaryInsuranceNumber: editedData.primaryInsuranceNumber,
      primaryGroupId: editedData.primaryGroupId,
      secondaryInsurance: editedData.secondaryInsurance,
      secondaryPlan: editedData.secondaryPlan,
      secondaryInsuranceNumber: editedData.secondaryInsuranceNumber,
      secondaryGroupId: editedData.secondaryGroupId
    }
    
    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key]
      }
    })
    
    updatePatientMutation.mutate(updateData)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditedData({})
  }

  const handleSaveInsurance = () => {
    const updateData: any = {
      primaryInsurance: editedData.primaryInsurance,
      primaryPlan: editedData.primaryPlan,
      primaryInsuranceNumber: editedData.primaryInsuranceNumber,
      primaryGroupId: editedData.primaryGroupId,
      secondaryInsurance: editedData.secondaryInsurance,
      secondaryPlan: editedData.secondaryPlan,
      secondaryInsuranceNumber: editedData.secondaryInsuranceNumber,
      secondaryGroupId: editedData.secondaryGroupId
    }
    
    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key]
      }
    })
    
    updatePatientMutation.mutate(updateData)
  }

  const handleCancelInsurance = () => {
    setIsEditingInsurance(false)
    setEditedData({})
  }

  const handleEditLeqvio = () => {
    if (!patient) return
    setEditedData({
      leqvioCvgStatus: patient.leqvioCvgStatus || '',
      leqvioEffectiveFrom: patient.leqvioEffectiveFrom || '',
      leqvioSubscriber: patient.leqvioSubscriber || '',
      leqvioSubscriberId: patient.leqvioSubscriberId || ''
    })
    setIsEditingLeqvio(true)
  }

  const handleSaveLeqvio = () => {
    const updateData: any = {
      leqvioCvgStatus: editedData.leqvioCvgStatus,
      leqvioEffectiveFrom: editedData.leqvioEffectiveFrom,
      leqvioSubscriber: editedData.leqvioSubscriber,
      leqvioSubscriberId: editedData.leqvioSubscriberId
    }
    
    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key]
      }
    })
    
    updatePatientMutation.mutate(updateData)
  }

  const handleCancelLeqvio = () => {
    setIsEditingLeqvio(false)
    setEditedData({})
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
    }
  }

  const handleUpload = () => {
    if (!selectedFile) return
    
    const formData = new FormData()
    formData.append('file', selectedFile)
    formData.append('documentType', documentType)
    
    uploadDocumentMutation.mutate(formData)
  }

  const handleAddClinicalNote = async () => {
    if (!clinicalNotes.trim()) return
    
    const blob = new Blob([clinicalNotes], { type: 'text/plain' })
    const file = new File([blob], 'clinical_note.txt', { type: 'text/plain' })
    
    const formData = new FormData()
    formData.append('file', file)
    formData.append('documentType', 'clinical_note')
    
    uploadDocumentMutation.mutate(formData)
    setClinicalNotes('')
  }

  const handleViewDocument = (doc: PatientDocument) => {
    setViewedDocument(doc)
  }

  const handleDeleteDocument = (documentId: number) => {
    if (confirm('Are you sure you want to delete this document?')) {
      deleteDocumentMutation.mutate(documentId)
    }
  }

  const handleCreateAppointment = () => {
    if (!appointmentForm.appointmentDate) return
    createAppointmentMutation.mutate({
      appointmentDate: appointmentForm.appointmentDate,
      doseNumber: appointmentForm.doseNumber
    })
  }

  const handleUpdateAppointmentStatus = (appointmentId: number, status: string) => {
    updateAppointmentMutation.mutate({
      appointmentId,
      updates: { status }
    })
  }

  const handleDeleteAppointment = (appointmentId: number) => {
    if (confirm('Are you sure you want to delete this appointment?')) {
      deleteAppointmentMutation.mutate(appointmentId)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'started':
        return 'bg-blue-100 text-blue-800'
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (patientLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Card>
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Loading patient information...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">Patient not found</p>
            <Link href="/patients">
              <Button variant="outline" className="mt-4">
                Back to Patients
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <Link href="/patients">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Patients
          </Button>
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {patient.lastName}, {patient.firstName}
            </h1>
            <p className="text-gray-600 mt-1">Patient ID: {patient.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(patient.status)}>
              {patient.status}
            </Badge>
            <select
              value={patient.status}
              onChange={(e) => updateStatusMutation.mutate(e.target.value)}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="started">Started</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>
      <div className="grid gap-6">
        {/* Patient Information */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Patient Information</CardTitle>
              {!isEditing ? (
                <Button onClick={handleEdit} variant="outline" size="sm">
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button 
                    onClick={handleSave} 
                    size="sm"
                    disabled={updatePatientMutation.isPending}
                  >
                    {updatePatientMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save
                  </Button>
                  <Button onClick={handleCancel} variant="outline" size="sm">
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label className="flex items-center gap-2 text-gray-600">
                    <User className="h-4 w-4" />
                    Personal Information
                  </Label>
                  <div className="mt-2 space-y-2">
                    <div className="flex justify-between">
                      <span className="font-medium">Name:</span>
                      <span>{patient.firstName} {patient.lastName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">DOB:</span>
                      <span>{patient.dateOfBirth}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">MRN:</span>
                      {isEditing ? (
                        <Input
                          value={editedData.mrn || ''}
                          onChange={(e) => setEditedData({...editedData, mrn: e.target.value})}
                          className="w-48"
                          placeholder="Medical Record Number"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <span>{patient.mrn || 'Not provided'}</span>
                          {patient.mrn && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (patient.mrn) {
                                  navigator.clipboard.writeText(patient.mrn)
                                  toast({
                                    title: "Copied to clipboard",
                                    description: `MRN: ${patient.mrn}`,
                                  })
                                }
                              }}
                              className="h-6 w-6 p-1 hover:bg-gray-100"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="flex items-center gap-2 text-gray-600">
                    <Stethoscope className="h-4 w-4" />
                    Medical Information
                  </Label>
                  <div className="mt-2 space-y-2">
                    <div className="flex justify-between">
                      <span className="font-medium">Ordering MD:</span>
                      {isEditing ? (
                        <Input
                          value={editedData.orderingMD || ''}
                          onChange={(e) => setEditedData({...editedData, orderingMD: e.target.value})}
                          className="w-48"
                        />
                      ) : (
                        <span>{patient.orderingMD}</span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Diagnosis:</span>
                      {isEditing ? (
                        <Input
                          value={editedData.diagnosis || ''}
                          onChange={(e) => setEditedData({...editedData, diagnosis: e.target.value})}
                          className="w-48"
                        />
                      ) : (
                        <span>{patient.diagnosis}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="flex items-center gap-2 text-gray-600">
                    <CheckCircle className="h-4 w-4" />
                    Authorization Information
                  </Label>
                  <div className="mt-2 space-y-2">
                    <div className="flex justify-between">
                      <span className="font-medium">Auth Number:</span>
                      {isEditing ? (
                        <Input
                          value={editedData.authNumber || ''}
                          onChange={(e) => setEditedData({...editedData, authNumber: e.target.value})}
                          className="w-48"
                          placeholder="Authorization Number"
                        />
                      ) : (
                        <span>{patient.authNumber || 'Not provided'}</span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Ref Number:</span>
                      {isEditing ? (
                        <Input
                          value={editedData.refNumber || ''}
                          onChange={(e) => setEditedData({...editedData, refNumber: e.target.value})}
                          className="w-48"
                          placeholder="Reference Number"
                        />
                      ) : (
                        <span>{patient.refNumber || 'Not provided'}</span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Start Date:</span>
                      {isEditing ? (
                        <Input
                          value={editedData.startDate || ''}
                          onChange={(e) => setEditedData({...editedData, startDate: e.target.value})}
                          className="w-48"
                          placeholder="MM/DD/YYYY"
                        />
                      ) : (
                        <span>{patient.startDate || 'Not provided'}</span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">End Date:</span>
                      {isEditing ? (
                        <Input
                          value={editedData.endDate || ''}
                          onChange={(e) => setEditedData({...editedData, endDate: e.target.value})}
                          className="w-48"
                          placeholder="MM/DD/YYYY"
                        />
                      ) : (
                        <span>{patient.endDate || 'Not provided'}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="flex items-center gap-2 text-gray-600">
                    <FileText className="h-4 w-4" />
                    Notes
                  </Label>
                  <div className="mt-2">
                    {isEditing ? (
                      <Textarea
                        value={editedData.notes || ''}
                        onChange={(e) => setEditedData({...editedData, notes: e.target.value})}
                        className="w-full min-h-24"
                        placeholder="Patient notes..."
                      />
                    ) : (
                      <div className="text-sm text-gray-700 min-h-8 p-2 bg-gray-50 rounded border">
                        <OrganizedNotesDisplay notes={patient.notes} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="flex items-center gap-2 text-gray-600">
                    <Phone className="h-4 w-4" />
                    Contact Information
                  </Label>
                  <div className="mt-2 space-y-2">
                    <div className="flex justify-between">
                      <span className="font-medium">Phone:</span>
                      {isEditing ? (
                        <Input
                          value={editedData.phone || ''}
                          onChange={(e) => setEditedData({...editedData, phone: e.target.value})}
                          className="w-48"
                        />
                      ) : (
                        <span>{patient.phone || 'Not provided'}</span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Email:</span>
                      {isEditing ? (
                        <Input
                          value={editedData.email || ''}
                          onChange={(e) => setEditedData({...editedData, email: e.target.value})}
                          className="w-48"
                        />
                      ) : (
                        <span>{patient.email || 'Not provided'}</span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Address:</span>
                      {isEditing ? (
                        <Input
                          value={editedData.address || ''}
                          onChange={(e) => setEditedData({...editedData, address: e.target.value})}
                          className="w-48"
                        />
                      ) : (
                        <span>{patient.address || 'Not provided'}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Insurance Information */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Insurance Information
              </CardTitle>
              {!isEditingInsurance ? (
                <Button onClick={handleEditInsurance} variant="outline" size="sm">
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button 
                    onClick={handleSaveInsurance} 
                    size="sm"
                    disabled={updatePatientMutation.isPending}
                  >
                    {updatePatientMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save
                  </Button>
                  <Button onClick={handleCancelInsurance} variant="outline" size="sm">
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">Primary Insurance</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Provider:</span>
                    {isEditingInsurance ? (
                      <Input
                        value={editedData.primaryInsurance || ''}
                        onChange={(e) => setEditedData({...editedData, primaryInsurance: e.target.value})}
                        className="w-48"
                      />
                    ) : (
                      <span>{patient.primaryInsurance || 'Not provided'}</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span>Plan:</span>
                    {isEditingInsurance ? (
                      <Input
                        value={editedData.primaryPlan || ''}
                        onChange={(e) => setEditedData({...editedData, primaryPlan: e.target.value})}
                        className="w-48"
                      />
                    ) : (
                      <span>{patient.primaryPlan || 'Not provided'}</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span>Member ID:</span>
                    {isEditingInsurance ? (
                      <Input
                        value={editedData.primaryInsuranceNumber || ''}
                        onChange={(e) => setEditedData({...editedData, primaryInsuranceNumber: e.target.value})}
                        className="w-48"
                      />
                    ) : (
                      <span>{patient.primaryInsuranceNumber || 'Not provided'}</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span>Group ID:</span>
                    {isEditingInsurance ? (
                      <Input
                        value={editedData.primaryGroupId || ''}
                        onChange={(e) => setEditedData({...editedData, primaryGroupId: e.target.value})}
                        className="w-48"
                      />
                    ) : (
                      <span>{patient.primaryGroupId || 'Not provided'}</span>
                    )}
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Secondary Insurance</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Provider:</span>
                    {isEditingInsurance ? (
                      <Input
                        value={editedData.secondaryInsurance || ''}
                        onChange={(e) => setEditedData({...editedData, secondaryInsurance: e.target.value})}
                        className="w-48"
                      />
                    ) : (
                      <span>{patient.secondaryInsurance || 'Not provided'}</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span>Plan:</span>
                    {isEditingInsurance ? (
                      <Input
                        value={editedData.secondaryPlan || ''}
                        onChange={(e) => setEditedData({...editedData, secondaryPlan: e.target.value})}
                        className="w-48"
                      />
                    ) : (
                      <span>{patient.secondaryPlan || 'Not provided'}</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span>Member ID:</span>
                    {isEditingInsurance ? (
                      <Input
                        value={editedData.secondaryInsuranceNumber || ''}
                        onChange={(e) => setEditedData({...editedData, secondaryInsuranceNumber: e.target.value})}
                        className="w-48"
                      />
                    ) : (
                      <span>{patient.secondaryInsuranceNumber || 'Not provided'}</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span>Group ID:</span>
                    {isEditing ? (
                      <Input
                        value={editedData.secondaryGroupId || ''}
                        onChange={(e) => setEditedData({...editedData, secondaryGroupId: e.target.value})}
                        className="w-48"
                      />
                    ) : (
                      <span>{patient.secondaryGroupId || 'Not provided'}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* LEQVIO Copay Program Information */}
        {patient.leqvioCopayProgram && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  LEQVIO Copay Program
                </CardTitle>
                {!isEditingLeqvio ? (
                  <Button onClick={handleEditLeqvio} variant="outline" size="sm">
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleSaveLeqvio} 
                      size="sm"
                      disabled={updatePatientMutation.isPending}
                    >
                      {updatePatientMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save
                    </Button>
                    <Button onClick={handleCancelLeqvio} variant="outline" size="sm">
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">Coverage Status:</span>
                    {isEditingLeqvio ? (
                      <Input
                        value={editedData.leqvioCvgStatus || ''}
                        onChange={(e) => setEditedData({...editedData, leqvioCvgStatus: e.target.value})}
                        className="w-48"
                        placeholder="e.g., Active, Pending"
                      />
                    ) : (
                      <span>{patient.leqvioCvgStatus || 'Not provided'}</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Effective From:</span>
                    {isEditingLeqvio ? (
                      <Input
                        type="date"
                        value={editedData.leqvioEffectiveFrom || ''}
                        onChange={(e) => setEditedData({...editedData, leqvioEffectiveFrom: e.target.value})}
                        className="w-48"
                      />
                    ) : (
                      <span>{patient.leqvioEffectiveFrom || 'Not provided'}</span>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">Subscriber:</span>
                    {isEditingLeqvio ? (
                      <Input
                        value={editedData.leqvioSubscriber || ''}
                        onChange={(e) => setEditedData({...editedData, leqvioSubscriber: e.target.value})}
                        className="w-48"
                        placeholder="Subscriber name"
                      />
                    ) : (
                      <span>{patient.leqvioSubscriber || 'Not provided'}</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Subscriber ID:</span>
                    {isEditingLeqvio ? (
                      <Input
                        value={editedData.leqvioSubscriberId || ''}
                        onChange={(e) => setEditedData({...editedData, leqvioSubscriberId: e.target.value})}
                        className="w-48"
                        placeholder="Subscriber ID number"
                      />
                    ) : (
                      <span>{patient.leqvioSubscriberId || 'Not provided'}</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Appointments Section */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Appointments</CardTitle>
                <CardDescription>Track patient appointments and doses</CardDescription>
              </div>
              <Button
                onClick={() => setShowAddAppointment(true)}
                size="sm"
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Appointment
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {appointmentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Loading appointments...</span>
              </div>
            ) : appointments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No appointments scheduled yet</p>
                <p className="text-sm">Click "Add Appointment" to schedule the first appointment</p>
              </div>
            ) : (
              <div className="space-y-3">
                {appointments.map((appointment) => (
                  <div key={appointment.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <Calendar className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium">
                          {format(new Date(appointment.appointmentDate), 'MMM d, yyyy')}
                        </p>
                        <p className="text-sm text-gray-500">
                          Dose #{appointment.doseNumber}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Only show status dropdown for past appointments */}
                      {new Date(appointment.appointmentDate) < new Date() ? (
                        <select
                          value={appointment.status}
                          onChange={(e) => handleUpdateAppointmentStatus(appointment.id, e.target.value)}
                          className="px-3 py-1 border rounded text-sm"
                          disabled={updateAppointmentMutation.isPending}
                        >
                          <option value="Completed">Completed</option>
                          <option value="Cancelled">Cancelled</option>
                          <option value="No Show">No Show</option>
                        </select>
                      ) : (
                        <span className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded">
                          Scheduled
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteAppointment(appointment.id)}
                        className="text-red-600 hover:text-red-700"
                        disabled={deleteAppointmentMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* LEQVIO Approval Analysis */}
        {latestAnalysis && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                LEQVIO Approval Analysis
              </CardTitle>
              <CardDescription>
                Latest analysis from AIGENTS based on patient data and insurance criteria
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Approval Likelihood */}
                {latestAnalysis.approvalLikelihood && (
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="h-4 w-4" />
                      <h4 className="font-medium">Approval Likelihood</h4>
                    </div>
                    <div className="text-lg font-semibold">
                      {latestAnalysis.approvalLikelihood.includes('Low') && (
                        <Badge variant="destructive" className="text-base px-3 py-1">
                          {latestAnalysis.approvalLikelihood}
                        </Badge>
                      )}
                      {latestAnalysis.approvalLikelihood.includes('Medium') && (
                        <Badge variant="secondary" className="text-base px-3 py-1 bg-yellow-100 text-yellow-800">
                          {latestAnalysis.approvalLikelihood}
                        </Badge>
                      )}
                      {latestAnalysis.approvalLikelihood.includes('High') && (
                        <Badge variant="default" className="text-base px-3 py-1 bg-green-100 text-green-800">
                          {latestAnalysis.approvalLikelihood}
                        </Badge>
                      )}
                      {!latestAnalysis.approvalLikelihood.includes('Low') && 
                       !latestAnalysis.approvalLikelihood.includes('Medium') && 
                       !latestAnalysis.approvalLikelihood.includes('High') && (
                        <Badge variant="outline" className="text-base px-3 py-1">
                          {latestAnalysis.approvalLikelihood}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Criteria Assessment */}
                {latestAnalysis.criteriaItems.length > 0 && (
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="h-4 w-4" />
                      <h4 className="font-medium">Criteria Assessment</h4>
                    </div>
                    <div className="space-y-2">
                      {latestAnalysis.criteriaItems.map((item, index) => (
                        <div key={index} className="flex items-start gap-2">
                          {item.status === 'passed' && (
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          )}
                          {item.status === 'failed' && (
                            <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                          )}
                          {item.status === 'unknown' && (
                            <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                          )}
                          <span className="text-sm">{item.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Documentation Gaps */}
                {latestAnalysis.documentationGaps.length > 0 && (
                  <div className="p-4 border rounded-lg bg-yellow-50 border-yellow-200">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <h4 className="font-medium text-yellow-800">Documentation Gaps</h4>
                    </div>
                    <div className="space-y-2">
                      {latestAnalysis.documentationGaps.map((gap, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-yellow-600 rounded-full mt-2 flex-shrink-0"></div>
                          <span className="text-sm text-yellow-800">{gap}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {latestAnalysis.recommendations.length > 0 && (
                  <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <h4 className="font-medium text-blue-800">Recommendations</h4>
                    </div>
                    <div className="space-y-2">
                      {latestAnalysis.recommendations.map((rec, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <span className="text-sm font-medium text-blue-600 mt-0.5 flex-shrink-0">
                            {index + 1}.
                          </span>
                          <span className="text-sm text-blue-800">{rec}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Analysis Timestamp */}
                {automationLogs.length > 0 && (
                  <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t">
                    <span>
                      Analysis completed: {new Date(automationLogs[0].timestamp || automationLogs[0].createdat).toLocaleString()}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAigentsData(true)}
                      className="text-xs"
                    >
                      View Full Analysis
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Further Analysis */}
        {furtherAnalysis && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSearch className="h-5 w-5" />
                Further Analysis
              </CardTitle>
              <CardDescription>
                Additional research and findings from web search
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap bg-gray-50 p-4 rounded-lg text-sm">
                  {furtherAnalysis}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Letter of Medical Necessity */}
        {letterOfMedicalNecessity && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Letter of Medical Necessity
              </CardTitle>
              <CardDescription>
                Generated letter for insurance authorization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap bg-blue-50 p-4 rounded-lg text-sm font-mono">
                  {letterOfMedicalNecessity}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Document Upload */}
        <Card>
          <CardHeader>
            <CardTitle>Add Documents</CardTitle>
            <CardDescription>Upload screenshots or add clinical notes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Document Type</Label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="w-full border rounded px-3 py-2 mt-1"
              >
                <option value="epic_insurance_text">Epic Insurance Text (Copy & Paste)</option>
                <option value="epic_insurance_screenshot">Epic Insurance Coverage Screenshot</option>
                <option value="epic_screenshot">Epic Patient Screenshot</option>
                <option value="insurance_screenshot">Insurance Card Screenshot</option>
                <option value="clinical_note">Clinical Note</option>
                <option value="leqvio_form">LEQVIO Form</option>
              </select>
            </div>

            {documentType === 'epic_insurance_text' ? (
              <EpicInsuranceExtractor
                patientId={patient?.id}
                onDataExtracted={(data) => {
                  // Refresh patient data after extraction
                  queryClient.invalidateQueries({ queryKey: [`/api/patients/${patient?.id}`] });
                }}
              />
            ) : documentType !== 'clinical_note' ? (
              <div>
                <Label>Upload File</Label>
                <div className="mt-1 flex items-center gap-4">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                  />
                  <Button 
                    onClick={handleUpload}
                    disabled={!selectedFile || uploadDocumentMutation.isPending}
                  >
                    {uploadDocumentMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <Label>Clinical Notes</Label>
                <Textarea
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="Enter clinical notes..."
                  className="mt-1 min-h-[120px]"
                />
                <Button 
                  onClick={handleAddClinicalNote}
                  disabled={!clinicalNotes.trim() || uploadDocumentMutation.isPending}
                  className="mt-2"
                >
                  {uploadDocumentMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Add Clinical Note
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Documents List */}
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>All uploaded documents for this patient</CardDescription>
          </CardHeader>
          <CardContent>
            {documentsLoading ? (
              <p className="text-gray-500">Loading documents...</p>
            ) : documents.length === 0 ? (
              <p className="text-gray-500">No documents uploaded yet</p>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {doc.documentType === 'clinical_note' ? (
                        <FileText className="h-5 w-5 text-gray-400" />
                      ) : (
                        <Camera className="h-5 w-5 text-gray-400" />
                      )}
                      <div>
                        <p className="font-medium">{doc.fileName}</p>
                        <p className="text-sm text-gray-500">
                          {doc.documentType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} • 
                          {' '}{format(new Date(doc.createdAt), 'MMM d, yyyy h:mm a')}
                        </p>
                        {doc.metadata && Object.keys(doc.metadata).length > 0 && (
                          <p className="text-sm text-green-600 mt-1">
                            ✓ Data extracted
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewDocument(doc)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Process Data */}
        <Card>
          <CardHeader>
            <CardTitle>LEQVIO AI agent</CardTitle>
            <CardDescription>Send insurance and clinical information to  see if LEQVIO can be approved</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Process History */}
              {automationLogs.length > 0 && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <History className="mr-2 h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">Last Processed</span>
                    </div>
                    <span className="text-sm text-blue-700">
                      {new Date(automationLogs[0].timestamp || automationLogs[0].createdat).toLocaleString()}
                    </span>
                  </div>
                  {automationLogs[0].iscompleted && (
                    <p className="text-sm text-blue-700 mt-1">
                      Status: Completed {automationLogs[0].agentresponse ? '✓' : '- Processing'}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    {automationLogs.length > 1 && (
                      <p className="text-xs text-blue-600">
                        Total processes: {automationLogs.length}
                      </p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAigentsData(true)}
                      className="text-xs"
                    >
                      View AIGENTS Data
                    </Button>
                  </div>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Ready to Process</p>
                  <p className="text-sm text-gray-500">
                    {documents.filter(d => d.documentType === 'epic_insurance_screenshot' || d.documentType === 'insurance_screenshot').length} insurance documents, {' '}
                    {documents.filter(d => d.documentType === 'epic_screenshot' || d.documentType === 'clinical_note').length} clinical documents
                  </p>
                </div>
                <Button 
                  onClick={() => processDataMutation.mutate()}
                  disabled={processDataMutation.isPending || documents.length === 0}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {processDataMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Process Data
                    </>
                  )}
                </Button>
              </div>
              
              {processResult && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center">
                    <Shield className="mr-2 h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">
                      Data Processed Successfully
                    </span>
                  </div>
                  <p className="text-sm text-green-700 mt-1">
                    Unique ID: {processResult.uniqueId}
                  </p>
                  <p className="text-sm text-green-700">
                    {processResult.documentsProcessed.insurance} insurance and {processResult.documentsProcessed.clinical} clinical documents sent to AIGENTS
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      {/* AIGENTS Data Modal */}
      {showAigentsData && automationLogs.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Last AIGENTS Message</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAigentsData(false)}
                >
                  Close
                </Button>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Sent: {new Date(automationLogs[0].timestamp || automationLogs[0].createdat).toLocaleString()}
              </p>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {automationLogs[0].requestdata ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Request Data Sent to AIGENTS:</h3>
                    <pre className="bg-gray-100 p-4 rounded overflow-x-auto text-sm">
                      {JSON.stringify(automationLogs[0].requestdata, null, 2)}
                    </pre>
                  </div>
                  {automationLogs[0].agentresponse && (
                    <div>
                      <h3 className="font-semibold mb-2">AIGENTS Response:</h3>
                      <div className="bg-blue-50 p-4 rounded">
                        <p className="text-sm">{automationLogs[0].agentresponse}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">No request data available</p>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Document View Modal */}
      {viewedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">{viewedDocument.fileName}</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewedDocument(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {viewedDocument.documentType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} • 
                {' '}{format(new Date(viewedDocument.createdAt), 'MMM d, yyyy h:mm a')}
              </p>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {viewedDocument.documentType === 'clinical_note' && viewedDocument.metadata?.content ? (
                <div className="whitespace-pre-wrap text-sm">{viewedDocument.metadata.content}</div>
              ) : viewedDocument.extractedData ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Extracted Data:</h3>
                    <pre className="bg-gray-100 p-4 rounded overflow-x-auto text-sm">
                      {(() => {
                        try {
                          return JSON.stringify(JSON.parse(viewedDocument.extractedData), null, 2)
                        } catch (e) {
                          // If it's not valid JSON, display as plain text
                          return viewedDocument.extractedData
                        }
                      })()}
                    </pre>
                  </div>
                  {viewedDocument.metadata && Object.keys(viewedDocument.metadata).length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2">Additional Metadata:</h3>
                      <pre className="bg-gray-100 p-4 rounded overflow-x-auto text-sm">
                        {JSON.stringify(viewedDocument.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">No extracted data available for this document.</p>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Add Appointment Modal */}
      {showAddAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Add New Appointment</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowAddAppointment(false)
                    setAppointmentForm({ appointmentDate: '', doseNumber: 1 })
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <Label htmlFor="appointmentDate">Date of Appointment</Label>
                <Input
                  id="appointmentDate"
                  type="date"
                  value={appointmentForm.appointmentDate}
                  onChange={(e) => setAppointmentForm(prev => ({
                    ...prev,
                    appointmentDate: e.target.value
                  }))}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="doseNumber">Dose #</Label>
                <Input
                  id="doseNumber"
                  type="number"
                  min="1"
                  value={appointmentForm.doseNumber}
                  onChange={(e) => setAppointmentForm(prev => ({
                    ...prev,
                    doseNumber: parseInt(e.target.value) || 1
                  }))}
                  className="mt-1"
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddAppointment(false)
                    setAppointmentForm({ appointmentDate: '', doseNumber: 1 })
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateAppointment}
                  disabled={!appointmentForm.appointmentDate || createAppointmentMutation.isPending}
                >
                  {createAppointmentMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Appointment
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}