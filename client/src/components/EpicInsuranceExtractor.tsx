import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Clipboard, Loader2, FileText } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useMutation } from '@tanstack/react-query'

interface EpicInsuranceData {
  primaryInsurance?: string
  primaryMemberId?: string
  primaryGroupNumber?: string
  secondaryInsurance?: string
  secondaryMemberId?: string
  secondaryGroupNumber?: string
  copay?: string
  deductible?: string
}

interface EpicInsuranceExtractorProps {
  patientId?: number
  onDataExtracted: (data: EpicInsuranceData) => void
}

export const EpicInsuranceExtractor = ({ patientId, onDataExtracted }: EpicInsuranceExtractorProps) => {
  const [epicText, setEpicText] = useState('')
  const [extractedData, setExtractedData] = useState<EpicInsuranceData | null>(null)
  
  const { toast } = useToast()

  const extractMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await fetch('/api/extract-epic-insurance-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ epicText: text })
      })
      if (!response.ok) throw new Error('Extraction failed')
      return response.json()
    },
    onSuccess: (data) => {
      setExtractedData(data.extractedData)
      onDataExtracted(data.extractedData)
      toast({
        title: "Insurance information extracted!",
        description: "Review the extracted data and apply changes as needed."
      })
    },
    onError: () => {
      toast({
        title: "Extraction failed",
        description: "Unable to extract insurance information from the text.",
        variant: "destructive"
      })
    }
  })

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!extractedData || !patientId) throw new Error('No data to apply')
      
      // Map the extracted data to match the database schema field names
      const mappedData = {
        primaryInsurance: extractedData.primaryInsurance,
        primaryInsuranceNumber: extractedData.primaryMemberId,
        primaryGroupId: extractedData.primaryGroupNumber,
        secondaryInsurance: extractedData.secondaryInsurance,
        secondaryInsuranceNumber: extractedData.secondaryMemberId,
        secondaryGroupId: extractedData.secondaryGroupNumber,
        // Note: copay and deductible don't have direct schema fields, would need to be added if needed
      }
      
      const response = await fetch(`/api/patients/${patientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mappedData)
      })
      if (!response.ok) throw new Error('Update failed')
      return response.json()
    },
    onSuccess: () => {
      toast({
        title: "Insurance information updated!",
        description: "Patient insurance details have been saved."
      })
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Unable to save insurance information. Please try again.",
        variant: "destructive"
      })
    }
  })

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setEpicText(text)
      if (text.trim()) {
        extractMutation.mutate(text)
      }
    } catch (error) {
      toast({
        title: "Clipboard access failed",
        description: "Unable to read from clipboard. Please paste manually.",
        variant: "destructive"
      })
    }
  }

  const handleExtractText = () => {
    if (!epicText.trim()) {
      toast({
        title: "No text provided",
        description: "Please paste Epic insurance information first.",
        variant: "destructive"
      })
      return
    }
    extractMutation.mutate(epicText)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Extract Insurance from Epic
        </CardTitle>
        <CardDescription>
          Copy and paste insurance information from Epic to automatically extract patient details
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="epic-text">Epic Insurance Information</Label>
          <Textarea
            id="epic-text"
            placeholder="Paste Epic insurance screen text here (Coverage, Member ID, Group Number, etc.)"
            value={epicText}
            onChange={(e) => setEpicText(e.target.value)}
            className="min-h-[120px] mt-1"
            disabled={extractMutation.isPending}
          />
          <p className="text-sm text-gray-500 mt-1">
            Select and copy text from Epic's insurance/coverage tab, then paste it here
          </p>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={handlePasteFromClipboard}
            disabled={extractMutation.isPending}
            variant="outline"
            className="flex-1"
          >
            <Clipboard className="mr-2 h-4 w-4" />
            Paste from Clipboard
          </Button>
          <Button 
            onClick={handleExtractText}
            disabled={extractMutation.isPending || !epicText.trim()}
            className="flex-1"
          >
            {extractMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Extracting...
              </>
            ) : (
              'Extract Information'
            )}
          </Button>
        </div>

        {extractedData && (
          <div className="mt-6 p-4 border rounded-lg bg-gray-50">
            <h4 className="font-medium mb-3">Extracted Insurance Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {extractedData.primaryInsurance && (
                <div>
                  <Label className="text-xs text-gray-600">Primary Insurance</Label>
                  <p className="font-medium">{extractedData.primaryInsurance}</p>
                </div>
              )}
              {extractedData.primaryMemberId && (
                <div>
                  <Label className="text-xs text-gray-600">Primary Member ID</Label>
                  <p className="font-medium">{extractedData.primaryMemberId}</p>
                </div>
              )}
              {extractedData.primaryGroupNumber && (
                <div>
                  <Label className="text-xs text-gray-600">Primary Group Number</Label>
                  <p className="font-medium">{extractedData.primaryGroupNumber}</p>
                </div>
              )}
              {extractedData.secondaryInsurance && (
                <div>
                  <Label className="text-xs text-gray-600">Secondary Insurance</Label>
                  <p className="font-medium">{extractedData.secondaryInsurance}</p>
                </div>
              )}
              {extractedData.secondaryMemberId && (
                <div>
                  <Label className="text-xs text-gray-600">Secondary Member ID</Label>
                  <p className="font-medium">{extractedData.secondaryMemberId}</p>
                </div>
              )}
              {extractedData.secondaryGroupNumber && (
                <div>
                  <Label className="text-xs text-gray-600">Secondary Group Number</Label>
                  <p className="font-medium">{extractedData.secondaryGroupNumber}</p>
                </div>
              )}
              {extractedData.copay && (
                <div>
                  <Label className="text-xs text-gray-600">Copay</Label>
                  <p className="font-medium">{extractedData.copay}</p>
                </div>
              )}
              {extractedData.deductible && (
                <div>
                  <Label className="text-xs text-gray-600">Deductible</Label>
                  <p className="font-medium">{extractedData.deductible}</p>
                </div>
              )}
            </div>
            
            {patientId && (
              <Button 
                onClick={() => applyMutation.mutate()}
                disabled={applyMutation.isPending}
                className="mt-4 w-full"
              >
                {applyMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Applying...
                  </>
                ) : (
                  'Apply to Patient Record'
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}