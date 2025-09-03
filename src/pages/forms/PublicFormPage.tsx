import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { PublicFormRenderer } from '@/components/forms/PublicFormRenderer'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AlertCircle, ArrowLeft } from 'lucide-react'

export function PublicFormPage() {
  const { formId, publicToken } = useParams<{ formId?: string; publicToken?: string }>()
  const [error, setError] = useState<string | null>(null)

  // Determine what parameter we have - either formId or publicToken
  const identifier = publicToken || formId
  const isTokenBased = !!publicToken

  if (!identifier) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Invalid Form Link</h3>
              <p className="text-muted-foreground mb-4">
                The form link you're trying to access is invalid.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicFormRenderer 
        formId={isTokenBased ? undefined : identifier} 
        publicToken={isTokenBased ? identifier : undefined}
        onSubmissionComplete={(submissionId) => {
          console.log('Form submitted:', submissionId)
          // Could add analytics or additional handling here
        }}
      />
    </div>
  )
}