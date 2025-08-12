import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { apiRequest } from '@/lib/queryClient'
import { FileText, Send, Loader2, Pen, Upload, CheckCircle, ArrowRight, Camera, Image } from 'lucide-react'
import { useLocation } from 'wouter'

// ICD-10 Diagnosis Codes for LEQVIO
const PRIMARY_DIAGNOSIS_CODES = [
  { code: 'E78.0', description: 'Pure hypercholesterolemia (often used for familial hypercholesterolemia)' },
  { code: 'E78.01', description: 'Familial hypercholesterolemia (very relevant for Leqvio)' },
  { code: 'E78.2', description: 'Mixed hyperlipidemia' },
  { code: 'E78.4', description: 'Other hyperlipidemia' },
  { code: 'E78.5', description: 'Hyperlipidemia, unspecified' }
]

const SECONDARY_DIAGNOSIS_CODES = [
  { code: 'I20.0-I25.9', description: 'Ischemic heart disease (includes angina, MI history, coronary artery disease)' },
  { code: 'I63.9', description: 'Cerebral infarction, unspecified (stroke history)' },
  { code: 'I70.2-I70.9', description: 'Atherosclerosis (e.g., of coronary, carotid, peripheral arteries)' },
  { code: 'Z95.1', description: 'Presence of aortocoronary bypass graft' },
  { code: 'Z95.5', description: 'Presence of coronary angioplasty implant and graft' },
  { code: 'Z86.79', description: 'Personal history of other diseases of the circulatory system (e.g. prior stroke or MI)' },
  { code: 'T46.6X5A', description: 'Adverse effect of antihyperlipidemic drugs (e.g., statins), initial encounter' },
  { code: 'Z91.89', description: 'Other specified personal risk factors, not elsewhere classified (can support statin intolerance)' },
  { code: 'Z79.899', description: 'Other long-term (current) drug therapy (if on ezetimibe or other non-statin therapy)' }
]

export default function ESignatureForm() {
  const { toast } = useToast()
  const [, setLocation] = useLocation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [submissionState, setSubmissionState] = useState<'form' | 'success' | 'uploading'>('form')
  const [createdPatient, setCreatedPatient] = useState<any>(null)

  // Form fields
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    orderingMD: '',
    diagnosis: [] as string[], // Changed to array for multiple selections
    phone: '',
    cellPhone: '',
    email: '',
    address: '',
    mrn: '', // Medical Record Number
    campus: 'Mount Sinai West', // Default campus
    primaryInsurance: '',
    primaryPlan: '',
    primaryInsuranceNumber: '',
    primaryGroupId: '',
    secondaryInsurance: '',
    secondaryPlan: '',
    secondaryInsuranceNumber: '',
    secondaryGroupId: '',
    recipientEmail: '',
    copayProgram: false,
    ongoingSupport: false,

  })

  const createPatientMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/patients', data)
      return res.json()
    },
    onSuccess: (patient) => {
      setCreatedPatient(patient)
      setSubmissionState('success')
      toast({
        title: "Success",
        description: "Patient created and PDF sent successfully!"
      })
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create patient",
        variant: "destructive"
      })
    }
  })

  const uploadDocumentMutation = useMutation({
    mutationFn: async ({ file, documentType }: { file: File; documentType: string }) => {
      const formData = new FormData()
      formData.append('document', file)
      formData.append('documentType', documentType)
      
      const response = await fetch(`/api/patients/${createdPatient.id}/documents`, {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) throw new Error('Upload failed')
      return response.json()
    },
    onSuccess: () => {
      setSubmissionState('success') // Return to success state after upload
      toast({
        title: "Document uploaded successfully!",
        description: "The document has been added to the patient record."
      })
    },
    onError: () => {
      setSubmissionState('success') // Return to success state even if upload fails
      toast({
        title: "Upload failed",
        description: "Failed to upload document. Please try again.",
        variant: "destructive"
      })
    }
  })

  // File upload handlers
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, documentType: string) => {
    const file = event.target.files?.[0]
    if (file) {
      setSubmissionState('uploading')
      uploadDocumentMutation.mutate({ file, documentType })
    }
  }

  const goToPatientDetail = () => {
    if (createdPatient) {
      setLocation(`/patient/${createdPatient.id}`)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleDiagnosisChange = (diagnosisCode: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      diagnosis: checked 
        ? [...prev.diagnosis, diagnosisCode]
        : prev.diagnosis.filter(code => code !== diagnosisCode)
    }))
  }

  const handleCheckboxChange = (field: 'copayProgram' | 'ongoingSupport', checked: boolean) => {
    setFormData(prev => ({ ...prev, [field]: checked }))
  }

  // Signature handling - supporting both mouse and touch events
  const getCoordinates = (e: any, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    if (e.touches && e.touches[0]) {
      // Touch event
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      }
    } else {
      // Mouse event
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      }
    }
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    setIsDrawing(true)
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const coords = getCoordinates(e, canvas)
    ctx.beginPath()
    ctx.moveTo(coords.x, coords.y)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.globalCompositeOperation = 'source-over'
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    e.preventDefault()
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const coords = getCoordinates(e, canvas)
    ctx.lineTo(coords.x, coords.y)
    ctx.stroke()
    setHasSignature(true)
  }

  const stopDrawing = (e?: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (e) e.preventDefault()
    setIsDrawing(false)
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Comprehensive validation with specific error messages
    const errors: string[] = []
    
    if (!formData.firstName.trim()) errors.push("First Name")
    if (!formData.lastName.trim()) errors.push("Last Name")
    if (!formData.dateOfBirth.trim()) errors.push("Date of Birth")
    if (!formData.orderingMD.trim()) errors.push("Ordering MD")
    if (!formData.cellPhone.trim()) errors.push("Cell Phone")
    if (formData.diagnosis.length === 0) errors.push("Diagnosis (select at least one)")
    if (!formData.recipientEmail.trim()) errors.push("Email to send PDF")
    if (!hasSignature) errors.push("Patient signature")
    
    if (errors.length > 0) {
      toast({
        title: "Required Fields Missing",
        description: `Please complete the following: ${errors.join(", ")}`,
        variant: "destructive"
      })
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return
    
    const signatureData = canvas.toDataURL()
    
    createPatientMutation.mutate({
      ...formData,
      diagnosis: formData.diagnosis.join(', '), // Convert array to comma-separated string for backend
      signatureData,
      status: 'started',
      leqvioCopayProgram: formData.copayProgram
    })
  }

  // Success state - show document upload options
  if (submissionState === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-2xl mx-auto px-4">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle className="text-2xl text-gray-900">Patient Successfully Created!</CardTitle>
              <CardDescription>
                {createdPatient?.firstName} {createdPatient?.lastName} has been added to the system and the LEQVIO PDF has been sent.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-4">
                  Would you like to upload additional documents for this patient?
                </p>
              </div>
              
              {/* Document Upload Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <Image className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                      <h3 className="font-medium mb-2">Insurance Card</h3>
                      <p className="text-sm text-gray-600 mb-4">Upload front/back of insurance card</p>
                      <Label htmlFor="insurance-upload" className="cursor-pointer">
                        <Button variant="outline" className="w-full" asChild>
                          <span>
                            <Upload className="h-4 w-4 mr-2" />
                            Choose File
                          </span>
                        </Button>
                      </Label>
                      <Input
                        id="insurance-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, 'insurance_screenshot')}
                      />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <Camera className="h-8 w-8 mx-auto mb-2 text-green-600" />
                      <h3 className="font-medium mb-2">Epic Screenshot</h3>
                      <p className="text-sm text-gray-600 mb-4">Upload Epic system screenshot</p>
                      <Label htmlFor="epic-upload" className="cursor-pointer">
                        <Button variant="outline" className="w-full" asChild>
                          <span>
                            <Upload className="h-4 w-4 mr-2" />
                            Choose File
                          </span>
                        </Button>
                      </Label>
                      <Input
                        id="epic-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, 'epic_insurance_screenshot')}
                      />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <FileText className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                      <h3 className="font-medium mb-2">Clinical Document</h3>
                      <p className="text-sm text-gray-600 mb-4">Upload medical records or notes</p>
                      <Label htmlFor="clinical-upload" className="cursor-pointer">
                        <Button variant="outline" className="w-full" asChild>
                          <span>
                            <Upload className="h-4 w-4 mr-2" />
                            Choose File
                          </span>
                        </Button>
                      </Label>
                      <Input
                        id="clinical-upload"
                        type="file"
                        accept=".pdf,.doc,.docx,.txt,image/*"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, 'clinical_note')}
                      />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <FileText className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                      <h3 className="font-medium mb-2">Other Document</h3>
                      <p className="text-sm text-gray-600 mb-4">Upload any other related document</p>
                      <Label htmlFor="other-upload" className="cursor-pointer">
                        <Button variant="outline" className="w-full" asChild>
                          <span>
                            <Upload className="h-4 w-4 mr-2" />
                            Choose File
                          </span>
                        </Button>
                      </Label>
                      <Input
                        id="other-upload"
                        type="file"
                        accept="*/*"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, 'other')}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Upload Status */}
              {submissionState === 'uploading' && (
                <div className="text-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Uploading document...</p>
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button onClick={goToPatientDetail} className="flex-1">
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Go to Patient Detail
                </Button>
                <Button variant="outline" onClick={() => setLocation('/patients')} className="flex-1">
                  Back to Patient List
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">LEQVIO Patient Registration</h1>
        <p className="text-gray-600">Complete the form and provide your e-signature</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Patient Information</CardTitle>
            <CardDescription>Basic patient demographics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  required
                  className={!formData.firstName.trim() ? 'border-red-300 focus:border-red-500' : ''}
                />
                {!formData.firstName.trim() && (
                  <p className="text-sm text-red-600 mt-1">First name is required</p>
                )}
              </div>
              <div>
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  required
                  className={!formData.lastName.trim() ? 'border-red-300 focus:border-red-500' : ''}
                />
                {!formData.lastName.trim() && (
                  <p className="text-sm text-red-600 mt-1">Last name is required</p>
                )}
              </div>
              <div>
                <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                <Input
                  id="dateOfBirth"
                  name="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={handleInputChange}
                  required
                  className={!formData.dateOfBirth.trim() ? 'border-red-300 focus:border-red-500' : ''}
                />
                {!formData.dateOfBirth.trim() && (
                  <p className="text-sm text-red-600 mt-1">Date of birth is required</p>
                )}
              </div>

              <div>
                <Label htmlFor="phone">Home Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <Label htmlFor="cellPhone">Cell Phone *</Label>
                <Input
                  id="cellPhone"
                  name="cellPhone"
                  type="tel"
                  value={formData.cellPhone}
                  onChange={handleInputChange}
                  required
                  className={!formData.cellPhone.trim() ? 'border-red-300 focus:border-red-500' : ''}
                />
                {!formData.cellPhone.trim() && (
                  <p className="text-sm text-red-600 mt-1">Cell phone is required</p>
                )}
              </div>
              <div>
                <Label htmlFor="email">Email (Optional)</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <Label htmlFor="mrn">MRN (Medical Record Number)</Label>
                <Input
                  id="mrn"
                  name="mrn"
                  value={formData.mrn}
                  onChange={handleInputChange}
                  placeholder="Optional"
                />
              </div>
              <div>
                <Label htmlFor="campus">Hospital Campus</Label>
                <select
                  id="campus"
                  name="campus"
                  value={formData.campus}
                  onChange={handleInputChange}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="Mount Sinai West">Mount Sinai West</option>
                  <option value="Mount Sinai East">Mount Sinai East</option>
                  <option value="Mount Sinai Morningside">Mount Sinai Morningside</option>
                </select>
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Medical Information</CardTitle>
            <CardDescription>Provider and diagnosis details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="orderingMD">Ordering MD *</Label>
                <Input
                  id="orderingMD"
                  name="orderingMD"
                  value={formData.orderingMD}
                  onChange={handleInputChange}
                  required
                  className={!formData.orderingMD.trim() ? 'border-red-300 focus:border-red-500' : ''}
                />
                {!formData.orderingMD.trim() && (
                  <p className="text-sm text-red-600 mt-1">Ordering MD is required</p>
                )}
              </div>
              <div className="col-span-2">
                <Label>Diagnosis Codes *</Label>
                <p className="text-sm text-gray-500 mb-3">Select one or more ICD-10 codes that apply to this patient</p>
                {formData.diagnosis.length === 0 && (
                  <p className="text-sm text-red-600 mb-2">At least one diagnosis code is required</p>
                )}
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-sm mb-2">Primary Diagnosis Codes</h4>
                    <div className="space-y-2">
                      {PRIMARY_DIAGNOSIS_CODES.map((diagnosis) => (
                        <div key={diagnosis.code} className="flex items-start space-x-2">
                          <Checkbox
                            id={diagnosis.code}
                            checked={formData.diagnosis.includes(diagnosis.code)}
                            onCheckedChange={(checked) => 
                              handleDiagnosisChange(diagnosis.code, checked as boolean)
                            }
                          />
                          <div className="grid gap-1.5 leading-none">
                            <label
                              htmlFor={diagnosis.code}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {diagnosis.code}
                            </label>
                            <p className="text-xs text-muted-foreground">
                              {diagnosis.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-sm mb-2">Secondary Diagnosis Codes (for Cardiovascular Risk)</h4>
                    <div className="space-y-2">
                      {SECONDARY_DIAGNOSIS_CODES.map((diagnosis) => (
                        <div key={diagnosis.code} className="flex items-start space-x-2">
                          <Checkbox
                            id={diagnosis.code}
                            checked={formData.diagnosis.includes(diagnosis.code)}
                            onCheckedChange={(checked) => 
                              handleDiagnosisChange(diagnosis.code, checked as boolean)
                            }
                          />
                          <div className="grid gap-1.5 leading-none">
                            <label
                              htmlFor={diagnosis.code}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {diagnosis.code}
                            </label>
                            <p className="text-xs text-muted-foreground">
                              {diagnosis.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                {formData.diagnosis.length === 0 && (
                  <p className="text-red-500 text-sm mt-2">Please select at least one diagnosis code</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Primary Insurance (Optional)</CardTitle>
            <CardDescription>Enter primary insurance information if available</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="primaryInsurance">Insurance Provider</Label>
                <Input
                  id="primaryInsurance"
                  name="primaryInsurance"
                  value={formData.primaryInsurance}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <Label htmlFor="primaryPlan">Plan Name</Label>
                <Input
                  id="primaryPlan"
                  name="primaryPlan"
                  value={formData.primaryPlan}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <Label htmlFor="primaryInsuranceNumber">Member/Policy Number</Label>
                <Input
                  id="primaryInsuranceNumber"
                  name="primaryInsuranceNumber"
                  value={formData.primaryInsuranceNumber}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <Label htmlFor="primaryGroupId">Group ID</Label>
                <Input
                  id="primaryGroupId"
                  name="primaryGroupId"
                  value={formData.primaryGroupId}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Patient Consent & E-Signature</CardTitle>
            <CardDescription>Please read and sign below</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm leading-relaxed">
                Your doctor has initiated enrollment into Novartis Pharmaceuticals Patient Support Services for your newly prescribed medication. In order to provide services on your behalf such as confirming your coverage for the medication and assessing any financial assistance you may be eligible for; we will need you to complete the below authorization. This allows us to utilize your health information (called "Protected Health Information" or "PHI") and share it with your health plan and/or pharmacy that will receive your doctor's prescription. This authorization will allow your healthcare providers, health plans and health insurers that maintain PHI about you to disclose your PHI to Novartis Pharmaceuticals Corporation so that the Service Center may provide services to you or on your behalf.
              </p>
            </div>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              <canvas
                ref={canvasRef}
                width={600}
                height={200}
                className="border border-gray-400 w-full cursor-crosshair touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                style={{ touchAction: 'none' }}
              />
              <div className="mt-2 flex justify-between">
                <p className="text-sm text-gray-500">Sign above</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearSignature}
                >
                  Clear
                </Button>
              </div>
              {!hasSignature && (
                <p className="text-sm text-red-600 mt-1">Patient signature is required</p>
              )}
            </div>

            <div>
              <Label htmlFor="recipientEmail">Send PDF to Email *</Label>
              <Input
                id="recipientEmail"
                name="recipientEmail"
                type="email"
                value={formData.recipientEmail}
                onChange={handleInputChange}
                placeholder="recipient@example.com"
                required
                className={!formData.recipientEmail.trim() ? 'border-red-300 focus:border-red-500' : ''}
              />
              {!formData.recipientEmail.trim() && (
                <p className="text-sm text-red-600 mt-1">Email address is required</p>
              )}
              <p className="text-sm text-gray-500 mt-1">
                The signed form will be sent to this email address
              </p>
            </div>

            <div className="space-y-4 mt-6">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="copayProgram"
                  checked={formData.copayProgram}
                  onCheckedChange={(checked) => handleCheckboxChange('copayProgram', checked as boolean)}
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="copayProgram"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    LEQVIO Co-pay Program
                  </label>
                  <p className="text-xs text-muted-foreground">
                    I have read and agree to the Co-pay Program Terms & Conditions on page
                  </p>
                </div>
              </div>



              <div className="flex items-start space-x-2">
                <Checkbox
                  id="ongoingSupport"
                  checked={formData.ongoingSupport}
                  onCheckedChange={(checked) => handleCheckboxChange('ongoingSupport', checked as boolean)}
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="ongoingSupport"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Ongoing Support from the LEQVIO Care Program
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Enroll in dedicated phone support from the LEQVIO Care Program—an optional program to help
                    me stay on track with my treatment plan, and receive medication reminders, healthy living tips, and
                    tools. By checking the box, I agree to receive calls and texts at the phone number provided.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setLocation('/patients')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createPatientMutation.isPending}
          >
            {createPatientMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Patient...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Submit & Send PDF
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}