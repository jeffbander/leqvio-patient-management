import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
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
  Copy,
  ChevronDown,
  ChevronUp,
  Clipboard
} from 'lucide-react'
import { format } from 'date-fns'
import { EpicInsuranceExtractor } from '@/components/EpicInsuranceExtractor'
import { DragDropFileUpload } from '@/components/DragDropFileUpload'

// Component for expandable text fields
const ExpandableText = ({ 
  text, 
  fieldKey, 
  maxLength = 200, 
  expandedFields, 
  setExpandedFields, 
  className = "text-sm" 
}: { 
  text: string, 
  fieldKey: string, 
  maxLength?: number, 
  expandedFields: {[key: string]: boolean}, 
  setExpandedFields: (fields: {[key: string]: boolean}) => void,
  className?: string 
}) => {
  const isExpanded = expandedFields[fieldKey]
  const shouldTruncate = text.length > maxLength

  const toggleExpanded = () => {
    setExpandedFields({
      ...expandedFields,
      [fieldKey]: !isExpanded
    })
  }

  if (!shouldTruncate) {
    return <div className={`${className} whitespace-pre-wrap`}>{text}</div>
  }

  return (
    <div className="relative">
      <div className={`${className} whitespace-pre-wrap`}>
        {isExpanded ? text : `${text.substring(0, maxLength)}...`}
      </div>
      <button
        onClick={toggleExpanded}
        className="absolute bottom-0 right-0 bg-white/90 hover:bg-white border rounded-full p-1 shadow-sm transition-colors"
        title={isExpanded ? "Collapse" : "Expand"}
      >
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-gray-600" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-600" />
        )}
      </button>
    </div>
  )
}

// Component to display organized notes with sections
const OrganizedNotesDisplay = ({ notes }: { notes?: string | null }) => {
  if (!notes) {
    return <div className="text-gray-400 italic">No notes</div>
  }

  // Parse notes into sections
  const sections = {
    userNotes: [] as string[],
    voicemails: [] as string[],
    insuranceUpdates: [] as string[]
  }

  const lines = notes.split('\n')
  let currentSection = 'userNotes' // Default section for legacy notes

  for (const line of lines) {
    if (line === '=== USER NOTES ===') {
      currentSection = 'userNotes'
      continue
    } else if (line === '=== VOICEMAILS ===') {
      currentSection = 'voicemails'
      continue
    } else if (line === '=== INSURANCE & AUTH UPDATES ===') {
      currentSection = 'insuranceUpdates'
      continue
    }

    if (line.trim()) {
      if (currentSection === 'userNotes') {
        sections.userNotes.push(line)
      } else if (currentSection === 'voicemails') {
        sections.voicemails.push(line)
      } else if (currentSection === 'insuranceUpdates') {
        sections.insuranceUpdates.push(line)
      }
    }
  }

  // If no sections found, treat as legacy unorganized notes
  const hasOrganizedSections = notes.includes('=== USER NOTES ===') || notes.includes('=== VOICEMAILS ===') || notes.includes('=== INSURANCE & AUTH UPDATES ===')
  
  if (!hasOrganizedSections) {
    return <div className="whitespace-pre-line">{notes}</div>
  }

  return (
    <div className="space-y-4">
      {sections.userNotes.length > 0 && (
        <div>
          <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-2">
            <FileText className="h-4 w-4" />
            User Notes
          </h4>
          <div className="pl-6 space-y-1">
            {sections.userNotes.map((note, idx) => (
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
  campus?: string
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
  
  const [activeTab, setActiveTab] = useState<'patient-info' | 'ai-analysis'>('patient-info')
  const [isEditing, setIsEditing] = useState(false)
  const [isEditingInsurance, setIsEditingInsurance] = useState(false)
  const [isEditingLeqvio, setIsEditingLeqvio] = useState(false)
  const [editedData, setEditedData] = useState<any>({})
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [documentType, setDocumentType] = useState<string>('insurance_screenshot')
  const [clinicalNotes, setClinicalNotes] = useState('')
  const [showTextExtractor, setShowTextExtractor] = useState(false)
  const [showClinicalNote, setShowClinicalNote] = useState(false)
  const [userNotes, setUserNotes] = useState('')
  const [processResult, setProcessResult] = useState<any>(null)
  const [showAigentsData, setShowAigentsData] = useState(false)
  const [viewedDocument, setViewedDocument] = useState<PatientDocument | null>(null)
  const [showAddAppointment, setShowAddAppointment] = useState(false)
  const [appointmentForm, setAppointmentForm] = useState({
    appointmentDate: '',
    doseNumber: 1
  })
  const [expandedFields, setExpandedFields] = useState<{[key: string]: boolean}>({
    furtherAnalysis: false,
    letterOfMedicalNecessity: false,
    approvalLikelihood: false,
    denialAppealLetter: false
  })
  
  // Rejection letter states
  const [rejectionLetterText, setRejectionLetterText] = useState('')
  const [rejectionLetterExtracted, setRejectionLetterExtracted] = useState('')
  const [isUploadingRejection, setIsUploadingRejection] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Helper function to extract user notes from organized notes
  const extractUserNotes = (notes?: string | null): string => {
    if (!notes) return ''
    
    if (!notes.includes('=== USER NOTES ===')) {
      // If no organized sections, treat as legacy user notes
      const hasOtherSections = notes.includes('=== VOICEMAILS ===') || notes.includes('=== INSURANCE & AUTH UPDATES ===')
      if (!hasOtherSections) {
        return notes
      }
      return ''
    }
    
    const lines = notes.split('\n')
    const userNotesLines: string[] = []
    let inUserNotesSection = false
    
    for (const line of lines) {
      if (line === '=== USER NOTES ===') {
        inUserNotesSection = true
        continue
      } else if (line.startsWith('=== ') && line.endsWith(' ===')) {
        inUserNotesSection = false
        continue
      }
      
      if (inUserNotesSection) {
        userNotesLines.push(line)
      }
    }
    
    return userNotesLines.join('\n').trim()
  }

  // Helper function to update user notes in organized notes structure
  const updateUserNotesInOrganized = (currentNotes?: string | null, newUserNotes?: string): string => {
    if (!currentNotes) {
      return newUserNotes ? `=== USER NOTES ===\n${newUserNotes}` : ''
    }
    
    const lines = currentNotes.split('\n')
    const resultLines: string[] = []
    let inUserNotesSection = false
    let hasUserNotesSection = false
    
    // Process existing notes, replacing user notes section
    for (const line of lines) {
      if (line === '=== USER NOTES ===') {
        hasUserNotesSection = true
        inUserNotesSection = true
        if (newUserNotes?.trim()) {
          resultLines.push('=== USER NOTES ===')
          resultLines.push(newUserNotes)
        }
        continue
      } else if (line.startsWith('=== ') && line.endsWith(' ===')) {
        inUserNotesSection = false
        resultLines.push(line)
        continue
      }
      
      if (!inUserNotesSection) {
        resultLines.push(line)
      }
    }
    
    // If no user notes section existed and we have new user notes, add it at the beginning
    if (!hasUserNotesSection && newUserNotes?.trim()) {
      return `=== USER NOTES ===\n${newUserNotes}\n\n${currentNotes}`
    }
    
    return resultLines.join('\n').replace(/\n\n+/g, '\n\n').trim()
  }

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

  // Get Denial AI analysis from automation logs
  const denialAnalysisLog = automationLogs.find(log => log.chainname === 'Denial_AI')
  const denialAppealLetter = (patient as any)?.denialAppealLetter || 
                            denialAnalysisLog?.webhookpayload?.formalAppealLetter || 
                            denialAnalysisLog?.webhookpayload?.formal_appeal_letter ||
                            denialAnalysisLog?.webhookpayload?.appealLetter ||
                            null

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

  const deletePatientMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('DELETE', `/api/patients/${patientId}`)
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success", 
        description: "Patient deleted successfully!"
      })
      // Redirect to patient list after successful deletion
      window.location.href = '/patients'
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete patient",
        variant: "destructive"
      })
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
        description: "Document uploaded successfully. Processing data in the background..."
      })
      
      // Start polling for processing status
      const documentId = data.document?.id
      if (documentId) {
        pollDocumentStatus(documentId)
      }
      
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/documents`] })
      setSelectedFile(null)
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload document",
        variant: "destructive"
      })
    }
  })

  // Function to poll document processing status
  const pollDocumentStatus = async (documentId: number, attempts = 0, maxAttempts = 30) => {
    if (attempts >= maxAttempts) {
      console.log(`Stopped polling document ${documentId} after ${maxAttempts} attempts`)
      return
    }

    try {
      const response = await fetch(`/api/patients/${patientId}/documents/${documentId}/status`)
      if (!response.ok) {
        console.error('Failed to check document status')
        return
      }
      
      const status = await response.json()
      
      if (status.processingStatus === 'completed') {
        // Processing completed successfully
        queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/documents`] })
        queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}`] })
        
        if (status.extractedData) {
          toast({
            title: "Processing Complete",
            description: "Document processed and patient information updated automatically"
          })
        }
      } else if (status.processingStatus === 'failed') {
        // Processing failed
        toast({
          title: "Processing Failed",
          description: status.processingError || "Document processing encountered an error",
          variant: "destructive"
        })
      } else if (status.processingStatus === 'processing' || status.processingStatus === 'pending') {
        // Still processing, check again in 2 seconds
        setTimeout(() => pollDocumentStatus(documentId, attempts + 1, maxAttempts), 2000)
      }
    } catch (error) {
      console.error('Error checking document status:', error)
    }
  }

  const saveRejectionLetterMutation = useMutation({
    mutationFn: async (rejectionText: string) => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const formData = new FormData();
      
      // Create a fake file-like object for the document endpoint
      const blob = new Blob([rejectionText], { type: 'text/plain' });
      formData.append('document', blob, `Rejection_Letter_${timestamp}.txt`);
      formData.append('documentType', 'rejection_letter');
      formData.append('extractionType', 'rejection_letter');
      
      const response = await fetch(`/api/patients/${patientId}/documents`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error('Failed to save rejection letter');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Rejection letter saved to documents"
      })
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/documents`] })
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save rejection letter",
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

  const runDenialAIMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/patients/${patientId}/denial-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rejectionLetterText: rejectionLetterExtracted || rejectionLetterText || ''
        })
      })
      if (!response.ok) throw new Error('Failed to run Denial AI analysis')
      return response.json()
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Denial AI analysis completed successfully. The formal appeal letter has been generated."
      })
      // Refresh automation logs to show the new denial AI event
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/automation-logs`] })
      // Refresh patient data to show the appeal letter
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}`] })
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to run Denial AI analysis",
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
      campus: patient.campus || 'Mount Sinai West',
      authNumber: patient.authNumber || '',
      refNumber: patient.refNumber || '',
      startDate: patient.startDate || '',
      endDate: patient.endDate || '',
      notes: patient.notes || ''
    })
    // Initialize user notes separately
    setUserNotes(extractUserNotes(patient.notes))
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
      secondaryGroupId: patient.secondaryGroupId || '',
      authNumber: patient.authNumber || '',
      refNumber: patient.refNumber || '',
      startDate: patient.startDate || '',
      endDate: patient.endDate || ''
    })
    setIsEditingInsurance(true)
  }

  const handleSave = () => {
    // Update the notes with the new user notes while preserving other sections
    const updatedNotes = updateUserNotesInOrganized(patient?.notes, userNotes)
    
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
      campus: editedData.campus,
      notes: updatedNotes,
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
    setUserNotes('')
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
      secondaryGroupId: editedData.secondaryGroupId,
      authNumber: editedData.authNumber,
      refNumber: editedData.refNumber,
      startDate: editedData.startDate,
      endDate: editedData.endDate
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
      leqvioPatientId: patient.leqvioPatientId || '',
      leqvioEnrollmentDate: patient.leqvioEnrollmentDate || '',
      leqvioCopayIdNumber: patient.leqvioCopayIdNumber || '',
      leqvioGroupNumber: patient.leqvioGroupNumber || '',
      leqvioBin: patient.leqvioBin || '',
      leqvioPcn: patient.leqvioPcn || ''
    })
    setIsEditingLeqvio(true)
  }

  const handleSaveLeqvio = () => {
    const updateData: any = {
      leqvioPatientId: editedData.leqvioPatientId,
      leqvioEnrollmentDate: editedData.leqvioEnrollmentDate,
      leqvioCopayIdNumber: editedData.leqvioCopayIdNumber,
      leqvioGroupNumber: editedData.leqvioGroupNumber,
      leqvioBin: editedData.leqvioBin,
      leqvioPcn: editedData.leqvioPcn
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

  // Handle rejection letter image upload
  const handleRejectionImageUpload = async (file: File) => {
    setIsUploadingRejection(true)
    try {
      // First upload and save the document
      const formData = new FormData()
      formData.append('document', file)
      formData.append('documentType', 'rejection_letter')
      formData.append('extractionType', 'rejection_letter')

      const response = await fetch(`/api/patients/${patientId}/documents`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Failed to save rejection letter document')
      }

      const result = await response.json()
      
      // Refresh documents list
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/documents`] })

      // Try to extract text for immediate display
      try {
        const extractFormData = new FormData()
        extractFormData.append('photo', file)
        extractFormData.append('extractionType', 'rejection_letter')

        const extractResponse = await fetch('/api/extract-patient-info', {
          method: 'POST',
          body: extractFormData
        })

        if (extractResponse.ok) {
          const extractResult = await extractResponse.json()
          if (extractResult.extractedText) {
            setRejectionLetterExtracted(extractResult.extractedText)
          }
        }
      } catch (extractError) {
        console.error('Text extraction failed (document was still saved):', extractError)
      }

      toast({
        title: "Rejection Letter Saved",
        description: "The rejection letter has been saved to documents and text extracted.",
      })
    } catch (error) {
      console.error('Error processing rejection letter:', error)
      toast({
        title: "Upload Failed",
        description: "Failed to save the rejection letter. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsUploadingRejection(false)
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
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Patient</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete {patient.firstName} {patient.lastName}? 
                    This action cannot be undone. All patient data, documents, and appointments will be permanently deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deletePatientMutation.mutate()}
                    disabled={deletePatientMutation.isPending}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {deletePatientMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Delete Patient
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
      
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('patient-info')}
            className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'patient-info'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Patient Information
          </button>
          <button
            onClick={() => setActiveTab('ai-analysis')}
            className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'ai-analysis'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            AI Analysis
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'patient-info' && (
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
                    <div className="flex justify-between">
                      <span className="font-medium">Campus:</span>
                      {isEditing ? (
                        <Select
                          value={editedData.campus || 'Mount Sinai West'}
                          onValueChange={(value) => setEditedData({...editedData, campus: value})}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Select campus" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Mount Sinai West">Mount Sinai West</SelectItem>
                            <SelectItem value="Mount Sinai East">Mount Sinai East</SelectItem>
                            <SelectItem value="Mount Sinai Morningside">Mount Sinai Morningside</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span>{patient.campus || 'Mount Sinai West'}</span>
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
                    {isEditingInsurance ? (
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

              {/* Authorization Information - Under Secondary Insurance in 4 equal blocks */}
              <div className="border-t pt-6 mt-6">
                <Label className="flex items-center gap-2 text-gray-700 mb-4">
                  <CheckCircle className="h-4 w-4" />
                  Authorization Information
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1 text-sm">
                    <span className="font-medium block">Auth Number:</span>
                    {isEditingInsurance ? (
                      <Input
                        value={editedData.authNumber || ''}
                        onChange={(e) => setEditedData({...editedData, authNumber: e.target.value})}
                        className="w-full"
                        placeholder="Authorization Number"
                      />
                    ) : (
                      <span className="block text-gray-600">{patient.authNumber || 'Not provided'}</span>
                    )}
                  </div>
                  <div className="space-y-1 text-sm">
                    <span className="font-medium block">Ref Number:</span>
                    {isEditingInsurance ? (
                      <Input
                        value={editedData.refNumber || ''}
                        onChange={(e) => setEditedData({...editedData, refNumber: e.target.value})}
                        className="w-full"
                        placeholder="Reference Number"
                      />
                    ) : (
                      <span className="block text-gray-600">{patient.refNumber || 'Not provided'}</span>
                    )}
                  </div>
                  <div className="space-y-1 text-sm">
                    <span className="font-medium block">Start Date:</span>
                    {isEditingInsurance ? (
                      <Input
                        value={editedData.startDate || ''}
                        onChange={(e) => setEditedData({...editedData, startDate: e.target.value})}
                        className="w-full"
                        placeholder="MM/DD/YYYY"
                      />
                    ) : (
                      <span className="block text-gray-600">{patient.startDate || 'Not provided'}</span>
                    )}
                  </div>
                  <div className="space-y-1 text-sm">
                    <span className="font-medium block">End Date:</span>
                    {isEditingInsurance ? (
                      <Input
                        value={editedData.endDate || ''}
                        onChange={(e) => setEditedData({...editedData, endDate: e.target.value})}
                        className="w-full"
                        placeholder="MM/DD/YYYY"
                      />
                    ) : (
                      <span className="block text-gray-600">{patient.endDate || 'Not provided'}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* LEQVIO Copay Program - Bottom Section */}
              {patient.leqvioCopayProgram && (
                <div className="border-t pt-6 mt-6">
                  <Label className="flex items-center gap-2 text-gray-700 mb-4">
                    <Shield className="h-4 w-4" />
                    LEQVIO Copay Program
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-3 text-sm">
                      <div className="space-y-1">
                        <span className="font-medium block">LEQVIO Patient ID:</span>
                        {isEditingInsurance ? (
                          <Input
                            value={editedData.leqvioPatientId || ''}
                            onChange={(e) => setEditedData({...editedData, leqvioPatientId: e.target.value})}
                            className="w-full"
                            placeholder="LEQVIO Patient ID"
                          />
                        ) : (
                          <span className="block text-gray-600">{patient.leqvioPatientId || 'Not provided'}</span>
                        )}
                      </div>
                      <div className="space-y-1">
                        <span className="font-medium block">Enrollment Date:</span>
                        {isEditingInsurance ? (
                          <Input
                            type="date"
                            value={editedData.leqvioEnrollmentDate || ''}
                            onChange={(e) => setEditedData({...editedData, leqvioEnrollmentDate: e.target.value})}
                            className="w-full"
                          />
                        ) : (
                          <span className="block text-gray-600">{patient.leqvioEnrollmentDate || 'Not provided'}</span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="space-y-1">
                        <span className="font-medium block">Co-pay ID Number:</span>
                        {isEditingInsurance ? (
                          <Input
                            value={editedData.leqvioCopayIdNumber || ''}
                            onChange={(e) => setEditedData({...editedData, leqvioCopayIdNumber: e.target.value})}
                            className="w-full"
                            placeholder="Co-pay ID Number"
                          />
                        ) : (
                          <span className="block text-gray-600">{patient.leqvioCopayIdNumber || 'Not provided'}</span>
                        )}
                      </div>
                      <div className="space-y-1">
                        <span className="font-medium block">Group Number:</span>
                        {isEditingInsurance ? (
                          <Input
                            value={editedData.leqvioGroupNumber || ''}
                            onChange={(e) => setEditedData({...editedData, leqvioGroupNumber: e.target.value})}
                            className="w-full"
                            placeholder="Group Number"
                          />
                        ) : (
                          <span className="block text-gray-600">{patient.leqvioGroupNumber || 'Not provided'}</span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="space-y-1">
                        <span className="font-medium block">BIN:</span>
                        {isEditingInsurance ? (
                          <Input
                            value={editedData.leqvioBin || ''}
                            onChange={(e) => setEditedData({...editedData, leqvioBin: e.target.value})}
                            className="w-full"
                            placeholder="BIN"
                          />
                        ) : (
                          <span className="block text-gray-600">{patient.leqvioBin || 'Not provided'}</span>
                        )}
                      </div>
                      <div className="space-y-1">
                        <span className="font-medium block">PCN:</span>
                        {isEditingInsurance ? (
                          <Input
                            value={editedData.leqvioPcn || ''}
                            onChange={(e) => setEditedData({...editedData, leqvioPcn: e.target.value})}
                            className="w-full"
                            placeholder="PCN"
                          />
                        ) : (
                          <span className="block text-gray-600">{patient.leqvioPcn || 'Not provided'}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

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





        {/* Notes Section */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Notes
              </CardTitle>
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
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">User Notes</Label>
                  <Textarea
                    value={userNotes}
                    onChange={(e) => setUserNotes(e.target.value)}
                    className="w-full min-h-32"
                    placeholder="Add your notes about this patient..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Only the user notes section will be updated. Voicemails and insurance updates are managed automatically.
                  </p>
                </div>
                
                {/* Show read-only view of other sections while editing */}
                <div className="text-sm text-gray-700 p-4 bg-gray-50 rounded border">
                  <OrganizedNotesDisplay notes={patient.notes} />
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-700 min-h-8 p-4 bg-gray-50 rounded border">
                <OrganizedNotesDisplay notes={patient.notes} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Document Upload */}
        <Card>
          <CardHeader>
            <CardTitle>Add Documents</CardTitle>
            <CardDescription>Upload screenshots or add clinical notes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-4">
                    <div className="text-center">
                      <Clipboard className="h-8 w-8 mx-auto mb-2 text-indigo-600" />
                      <h3 className="font-medium mb-2">Insurance Copy and Paste</h3>
                      <p className="text-sm text-gray-600">Copy & paste insurance information from Epic or other systems</p>
                    </div>
                    <Button
                      onClick={() => setShowTextExtractor(true)}
                      variant="outline"
                      className="w-full"
                    >
                      <Clipboard className="h-4 w-4 mr-2" />
                      Open Text Extractor
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="space-y-4">
                    <div className="text-center">
                      <Camera className="h-8 w-8 mx-auto mb-2 text-green-600" />
                      <h3 className="font-medium mb-2">Insurance Upload Screenshot</h3>
                      <p className="text-sm text-gray-600">Upload screenshots of insurance cards or Epic insurance screens</p>
                    </div>
                    <DragDropFileUpload
                      onFileSelect={(file) => {
                        setSelectedFile(file);
                        setDocumentType('insurance_screenshot');
                      }}
                      accept="image/*"
                      maxSizeMB={10}
                      placeholder="Drag and drop image here"
                      className="[&>div:last-child]:p-2"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="space-y-4">
                    <div className="text-center">
                      <FileText className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                      <h3 className="font-medium mb-2">Clinical Notes and Labs</h3>
                      <p className="text-sm text-gray-600">Enter clinical notes, lab results, or other medical documentation</p>
                    </div>
                    <Button
                      onClick={() => setShowClinicalNote(true)}
                      variant="outline"
                      className="w-full"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Add Clinical Notes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Upload Status */}
            {selectedFile && (
              <div className="text-center py-4">
                <Button 
                  onClick={handleUpload}
                  disabled={!selectedFile || uploadDocumentMutation.isPending}
                  className="w-full"
                >
                  {uploadDocumentMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload {selectedFile.name}
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Text Extractor Modal */}
            {showTextExtractor && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Epic Insurance Text Extractor</h3>
                    <Button
                      onClick={() => setShowTextExtractor(false)}
                      variant="ghost"
                      size="sm"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <EpicInsuranceExtractor
                    patientId={patient?.id}
                    onDataExtracted={(data) => {
                      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patient?.id}`] });
                      setShowTextExtractor(false);
                    }}
                  />
                </div>
              </div>
            )}

            {/* Clinical Notes Modal */}
            {showClinicalNote && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Add Clinical Notes</h3>
                    <Button
                      onClick={() => setShowClinicalNote(false)}
                      variant="ghost"
                      size="sm"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-4">
                    <Label>Clinical Notes</Label>
                    <Textarea
                      value={clinicalNotes}
                      onChange={(e) => setClinicalNotes(e.target.value)}
                      placeholder="Enter clinical notes..."
                      className="min-h-[120px]"
                    />
                    <Button 
                      onClick={async () => {
                        await handleAddClinicalNote();
                        setShowClinicalNote(false);
                        setClinicalNotes('');
                      }}
                      disabled={!clinicalNotes.trim() || uploadDocumentMutation.isPending}
                      className="w-full"
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
                </div>
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
                      ) : doc.documentType === 'rejection_letter' ? (
                        <AlertTriangle className="h-5 w-5 text-red-400" />
                      ) : doc.documentType === 'appeal_letter' ? (
                        <FileSearch className="h-5 w-5 text-green-400" />
                      ) : (
                        <Camera className="h-5 w-5 text-gray-400" />
                      )}
                      <div>
                        <p className="font-medium">{doc.fileName}</p>
                        <p className="text-sm text-gray-500">
                          {doc.documentType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} • 
                          {' '}{format(new Date(doc.createdAt), 'MMM d, yyyy h:mm a')}
                        </p>
                        {/* Processing Status Indicator */}
                        {doc.processingStatus === 'pending' && (
                          <p className="text-sm text-blue-600 mt-1 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Processing...
                          </p>
                        )}
                        {doc.processingStatus === 'processing' && (
                          <p className="text-sm text-blue-600 mt-1 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Extracting data...
                          </p>
                        )}
                        {doc.processingStatus === 'completed' && doc.extractedData && (
                          <p className="text-sm text-green-600 mt-1">
                            ✓ Data extracted and processed
                          </p>
                        )}
                        {doc.processingStatus === 'failed' && (
                          <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Processing failed
                          </p>
                        )}
                        {(!doc.processingStatus || doc.processingStatus === 'completed') && doc.metadata && Object.keys(doc.metadata).length > 0 && (
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


          </div>
        )}

        {activeTab === 'ai-analysis' && (
          <div className="space-y-6">
            {/* Authorization AI and Denial AI */}
            <div className={`grid gap-6 ${(patient as any)?.authStatus === 'Denied' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
              {/* Authorization AI */}
              <Card className="border-l-4 border-l-blue-500 shadow-sm">
                <CardHeader className="bg-gradient-to-r from-blue-50/50 to-white pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full">
                      <Shield className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold text-gray-900">Authorization AI</CardTitle>
                      <CardDescription className="text-sm text-gray-600 mt-1">
                        Intelligent analysis of insurance and clinical data for LEQVIO authorization
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-6">
                    {/* Process History */}
                    {automationLogs.length > 0 && (
                      <div className="bg-blue-50/50 border border-blue-200/50 rounded-xl p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <History className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-900">Processing History</span>
                          </div>
                          <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">
                            {automationLogs[0].iscompleted ? 'Completed' : 'In Progress'}
                          </Badge>
                        </div>
                        <div className="text-sm text-blue-700 space-y-1">
                          <div>Last processed: {new Date(automationLogs[0].timestamp || automationLogs[0].createdat).toLocaleString()}</div>
                          {automationLogs.length > 1 && (
                            <div className="text-xs text-blue-600">Total processes: {automationLogs.length}</div>
                          )}
                        </div>
                        <div className="flex justify-end mt-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAigentsData(true)}
                            className="text-xs text-blue-700 hover:text-blue-900 hover:bg-blue-100/50 h-7"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View Details
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {/* Documents Summary */}
                    <div className="bg-gray-50/50 border border-gray-200/50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-900">Document Summary</span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div className="flex justify-between">
                          <span>Insurance Documents:</span>
                          <Badge variant="secondary" className="h-5 text-xs">
                            {documents.filter(d => d.documentType === 'epic_insurance_screenshot' || d.documentType === 'insurance_screenshot').length}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Clinical Documents:</span>
                          <Badge variant="secondary" className="h-5 text-xs">
                            {documents.filter(d => d.documentType === 'epic_screenshot' || d.documentType === 'clinical_note').length}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Button */}
                    <div className="flex justify-center pt-2">
                      <Button 
                        onClick={() => processDataMutation.mutate()}
                        disabled={processDataMutation.isPending || documents.length === 0}
                        className="bg-blue-600 hover:bg-blue-700 shadow-sm min-w-[160px]"
                        size="lg"
                      >
                        {processDataMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Process Authorization
                          </>
                        )}
                      </Button>
                    </div>
                    
                    {/* Success Result */}
                    {processResult && (
                      <div className="bg-green-50/50 border border-green-200/50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-green-900">Processing Complete</span>
                        </div>
                        <div className="text-sm text-green-700 space-y-1">
                          <div>Reference ID: <code className="text-xs bg-green-100 px-1 py-0.5 rounded">{processResult.uniqueId}</code></div>
                          <div>Documents processed: {processResult.documentsProcessed.insurance + processResult.documentsProcessed.clinical} total</div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Denial AI Section - only show when auth status is Denied */}
              {(patient as any)?.authStatus === 'Denied' && (
                <Card className="border-l-4 border-l-red-500 shadow-sm">
                  <CardHeader className="bg-gradient-to-r from-red-50/50 to-white pb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 bg-red-100 rounded-full">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-semibold text-gray-900">Denial AI</CardTitle>
                        <CardDescription className="text-sm text-gray-600 mt-1">
                          Generate professional appeal letters for denied authorizations
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-6">
                      {/* Step 1: Rejection Letter Upload */}
                      <div className="bg-red-50/30 border border-red-200/50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-semibold">1</div>
                          <h3 className="font-semibold text-sm text-red-900">Add Rejection Letter</h3>
                          <Badge variant="secondary" className="text-xs ml-auto">Optional</Badge>
                        </div>
                        
                        <div className="space-y-4">
                          <p className="text-xs text-red-700/80 mb-3">
                            Upload or paste the rejection letter to enhance the appeal analysis
                          </p>
                          
                          {/* Upload Options */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Image Upload */}
                            <div className="space-y-2">
                              <Label className="text-xs font-medium text-gray-700">Upload Image</Label>
                              <div
                                onClick={() => document.getElementById('rejection-file-input')?.click()}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  e.currentTarget.classList.add('border-blue-500', 'bg-blue-50');
                                }}
                                onDragLeave={(e) => {
                                  e.preventDefault();
                                  e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                                  const files = e.dataTransfer.files;
                                  if (files.length > 0) {
                                    handleRejectionImageUpload(files[0]);
                                  }
                                }}
                                className="h-16 w-full rounded-md border border-red-200 bg-background px-3 py-2 text-xs ring-offset-background hover:border-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer transition-colors flex items-center justify-center"
                              >
                                <input
                                  id="rejection-file-input"
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleRejectionImageUpload(file);
                                  }}
                                  disabled={isUploadingRejection}
                                />
                                <div className="flex flex-col items-center justify-center space-y-1">
                                  <Upload className="h-4 w-4 text-gray-400" />
                                  <p className="text-xs text-gray-600">Drop image here or click</p>
                                </div>
                              </div>
                              {isUploadingRejection && (
                                <div className="flex items-center gap-2 text-xs text-red-600">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  <span>Processing...</span>
                                </div>
                              )}
                            </div>

                            {/* Text Input */}
                            <div className="space-y-2">
                              <Label className="text-xs font-medium text-gray-700">Paste Text</Label>
                              <Textarea
                                value={rejectionLetterText}
                                onChange={(e) => setRejectionLetterText(e.target.value)}
                                placeholder="Paste rejection letter text..."
                                className="h-16 resize-none text-xs border-red-200 focus:border-red-400"
                              />
                              {rejectionLetterText.trim() && (
                                <Button
                                  onClick={() => saveRejectionLetterMutation.mutate(rejectionLetterText)}
                                  disabled={saveRejectionLetterMutation.isPending}
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-xs border-red-300 text-red-700 hover:bg-red-50"
                                >
                                  {saveRejectionLetterMutation.isPending ? (
                                    <>
                                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                      Saving...
                                    </>
                                  ) : (
                                    <>
                                      <Save className="h-3 w-3 mr-1" />
                                      Save
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                          
                          {/* Preview */}
                          {(rejectionLetterExtracted || rejectionLetterText) && (
                            <div className="bg-white/60 border border-red-200/50 rounded-lg p-3 mt-3">
                              <div className="flex items-center gap-2 mb-2">
                                <FileText className="h-3 w-3 text-red-500" />
                                <span className="text-xs font-medium text-red-800">Letter Preview</span>
                              </div>
                              <div className="text-xs text-red-700/80 max-h-20 overflow-y-auto whitespace-pre-wrap bg-red-50/30 p-2 rounded border border-red-100">
                                {rejectionLetterExtracted || rejectionLetterText}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Step 2: Generate Appeal */}
                      <div className="bg-green-50/30 border border-green-200/50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-semibold">2</div>
                          <h3 className="font-semibold text-sm text-green-900">Generate Appeal Letter</h3>
                        </div>
                        
                        <p className="text-xs text-green-700/80 mb-4">
                          Create a professional appeal letter using patient data and clinical evidence
                        </p>
                        
                        <div className="flex justify-center">
                          <Button 
                            onClick={() => runDenialAIMutation.mutate()}
                            disabled={runDenialAIMutation.isPending}
                            className="bg-red-600 hover:bg-red-700 text-white shadow-sm min-w-[140px]"
                            size="lg"
                          >
                            {runDenialAIMutation.isPending ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <FileSearch className="h-4 w-4 mr-2" />
                                Generate Appeal
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* AI Analysis Content */}
            <Card>
              <CardHeader>
                <CardTitle>LEQVIO AI Analysis</CardTitle>
                <CardDescription>AI-powered analysis of patient eligibility and approval likelihood</CardDescription>
              </CardHeader>
              <CardContent>
                {automationLogs.length > 0 ? (
                  <div className="space-y-6">
                    {/* Latest Analysis Summary */}
                    {(() => {
                      const latestAnalysis = automationLogs[0]?.agentresponse 
                        ? parseAigentsResponse(automationLogs[0].agentresponse)
                        : null;
                      
                      if (latestAnalysis) {
                        return (
                          <div className="space-y-4">
                            {/* Approval Likelihood */}
                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                              <h3 className="font-semibold text-blue-800 mb-2">Approval Likelihood</h3>
                              <ExpandableText
                                text={latestAnalysis.approvalLikelihood}
                                fieldKey="approvalLikelihood"
                                maxLength={150}
                                expandedFields={expandedFields}
                                setExpandedFields={setExpandedFields}
                                className="text-blue-700"
                              />
                            </div>
                            
                            {/* Criteria Assessment */}
                            {latestAnalysis.criteriaItems.length > 0 && (
                              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                                <h3 className="font-semibold text-gray-800 mb-3">Criteria Assessment</h3>
                                <div className="space-y-2">
                                  {latestAnalysis.criteriaItems.map((item, idx) => (
                                    <div key={idx} className="flex items-start gap-2">
                                      <span className={`text-sm font-medium ${
                                        item.status === 'passed' ? 'text-green-600' : 
                                        item.status === 'failed' ? 'text-red-600' : 'text-yellow-600'
                                      }`}>
                                        {item.status === 'passed' ? '✓' : item.status === 'failed' ? '✗' : '?'}
                                      </span>
                                      <span className="text-sm text-gray-700">{item.text}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Documentation Gaps */}
                            {latestAnalysis.documentationGaps.length > 0 && (
                              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <h3 className="font-semibold text-yellow-800 mb-3">Documentation Gaps</h3>
                                <ul className="space-y-1">
                                  {latestAnalysis.documentationGaps.map((gap, idx) => (
                                    <li key={idx} className="text-sm text-yellow-700">• {gap}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {/* Recommendations */}
                            {latestAnalysis.recommendations.length > 0 && (
                              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                <h3 className="font-semibold text-green-800 mb-3">Recommendations</h3>
                                <ul className="space-y-1">
                                  {latestAnalysis.recommendations.map((rec, idx) => (
                                    <li key={idx} className="text-sm text-green-700">• {rec}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        );
                      }
                      
                      return (
                        <div className="text-center py-8">
                          <p className="text-gray-500">No detailed analysis available yet</p>
                        </div>
                      );
                    })()}
                    
                    {/* Further Analysis */}
                    {furtherAnalysis && (
                      <div className="border-t pt-6">
                        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                          <FileSearch className="h-5 w-5" />
                          Further Analysis
                        </h3>
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <ExpandableText
                            text={furtherAnalysis}
                            fieldKey="furtherAnalysis"
                            maxLength={300}
                            expandedFields={expandedFields}
                            setExpandedFields={setExpandedFields}
                            className="text-sm text-blue-800"
                          />
                        </div>
                      </div>
                    )}

                    {/* Denial Appeal Letter - show if available */}
                    {denialAppealLetter && (
                      <div className="border-t pt-6">
                        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-red-600" />
                          Denial Appeal Letter
                        </h3>
                        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                          <ExpandableText
                            text={denialAppealLetter}
                            fieldKey="denialAppealLetterResults"
                            maxLength={400}
                            expandedFields={expandedFields}
                            setExpandedFields={setExpandedFields}
                            className="text-sm text-red-800"
                          />
                        </div>
                      </div>
                    )}

                    {/* Letter of Medical Necessity */}
                    {letterOfMedicalNecessity && (
                      <div className="border-t pt-6">
                        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          Letter of Medical Necessity
                        </h3>
                        <div className="bg-green-50 p-4 rounded-lg">
                          <ExpandableText
                            text={letterOfMedicalNecessity}
                            fieldKey="letterOfMedicalNecessity"
                            maxLength={400}
                            expandedFields={expandedFields}
                            setExpandedFields={setExpandedFields}
                            className="text-sm text-green-800"
                          />
                        </div>
                      </div>
                    )}

                    {/* Analysis History */}
                    <div className="border-t pt-6">
                      <h3 className="font-semibold text-gray-800 mb-4">Analysis History</h3>
                      <div className="space-y-3">
                        {automationLogs.map((log, idx) => (
                          <div key={log.id} className="p-3 border rounded-lg">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">Chain: {log.chainname}</span>
                                {log.iscompleted && (
                                  <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                                    Completed
                                  </span>
                                )}
                              </div>
                              <span className="text-sm text-gray-500">
                                {new Date(log.timestamp || log.createdat).toLocaleString()}
                              </span>
                            </div>
                            {log.agentresponse && log.agentresponse !== 'No response content' && log.agentresponse.length > 100 && (
                              <div className="mt-3">
                                <ExpandableText
                                  text={log.agentresponse}
                                  fieldKey={`analysis-history-${log.id}`}
                                  maxLength={200}
                                  expandedFields={expandedFields}
                                  setExpandedFields={setExpandedFields}
                                  className="text-sm text-gray-700"
                                />
                              </div>
                            )}
                            {log.agentresponse && log.agentresponse !== 'No response content' && log.agentresponse.length <= 100 && (
                              <div className="mt-2 text-sm text-gray-700">
                                {log.agentresponse}
                              </div>
                            )}
                            {log.agentresponse && log.agentresponse !== 'No response content' && (
                              <div className="mt-2">
                                <button
                                  onClick={() => setShowAigentsData(true)}
                                  className="text-sm text-blue-600 hover:text-blue-800"
                                >
                                  View Full Response
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No AI analysis available yet</p>
                    <p className="text-sm text-gray-400 mt-2">Upload documents and process data to see AI analysis</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
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
              ) : (viewedDocument.documentType === 'rejection_letter' || viewedDocument.documentType === 'appeal_letter') && viewedDocument.extractedData ? (
                <div className="whitespace-pre-wrap text-sm p-4 bg-gray-50 border rounded-lg">
                  {viewedDocument.extractedData}
                </div>
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