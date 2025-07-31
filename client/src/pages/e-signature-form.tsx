import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { apiRequest } from '@/lib/queryClient'
import { FileText, Send, Loader2, Pen } from 'lucide-react'
import { useLocation } from 'wouter'

export default function ESignatureForm() {
  const { toast } = useToast()
  const [, setLocation] = useLocation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)

  // Form fields
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    orderingMD: '',
    diagnosis: '',
    phone: '',
    email: '',
    address: '',
    primaryInsurance: '',
    primaryPlan: '',
    primaryInsuranceNumber: '',
    primaryGroupId: '',
    secondaryInsurance: '',
    secondaryPlan: '',
    secondaryInsuranceNumber: '',
    secondaryGroupId: '',
    recipientEmail: ''
  })

  const createPatientMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/patients', data)
      return res.json()
    },
    onSuccess: (patient) => {
      toast({
        title: "Success",
        description: "Patient created and PDF sent successfully!"
      })
      setLocation(`/patient/${patient.id}`)
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create patient",
        variant: "destructive"
      })
    }
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Signature handling
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const rect = canvas.getBoundingClientRect()
    ctx.beginPath()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const rect = canvas.getBoundingClientRect()
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
    ctx.stroke()
    setHasSignature(true)
  }

  const stopDrawing = () => {
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
    
    if (!hasSignature) {
      toast({
        title: "Signature Required",
        description: "Please provide your signature before submitting",
        variant: "destructive"
      })
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return
    
    const signatureData = canvas.toDataURL()
    
    createPatientMutation.mutate({
      ...formData,
      signatureData,
      status: 'started'
    })
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
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  required
                />
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
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                />
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
                />
              </div>
              <div>
                <Label htmlFor="diagnosis">Diagnosis *</Label>
                <Input
                  id="diagnosis"
                  name="diagnosis"
                  value={formData.diagnosis}
                  onChange={handleInputChange}
                  required
                />
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
            <CardTitle>E-Signature</CardTitle>
            <CardDescription>Please sign in the box below</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              <canvas
                ref={canvasRef}
                width={600}
                height={200}
                className="border border-gray-400 w-full cursor-crosshair"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
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
              />
              <p className="text-sm text-gray-500 mt-1">
                The signed form will be sent to this email address
              </p>
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
            disabled={createPatientMutation.isPending || !hasSignature}
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