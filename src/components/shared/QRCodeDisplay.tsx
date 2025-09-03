import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { QrCode, Copy, Download, Share, Eye } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface QRCodeDisplayProps {
  formId: string
  formName: string
  publicUrl: string
  onClose?: () => void
}

export function QRCodeDisplay({ formId, formName, publicUrl, onClose }: QRCodeDisplayProps) {
  const [qrCodeData, setQrCodeData] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (showDialog && !qrCodeData) {
      generateQRCode()
    }
  }, [showDialog])

  const generateQRCode = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const { data, error } = await supabase.functions.invoke('forms-advanced', {
        body: {
          action: 'generate_qr_code',
          form_id: formId,
          public_url: publicUrl
        }
      })

      if (error) throw error
      
      if (data?.data?.qr_code_data) {
        setQrCodeData(data.data.qr_code_data)
        
        // Show warning if QR generation failed and fallback was used
        if (data.warning) {
          setError(data.warning)
          toast.error('QR code generation failed, showing fallback')
        } else {
          toast.success('QR code generated successfully!')
        }
      }
    } catch (error: any) {
      console.error('Error generating QR code:', error)
      setError(error.message || 'Failed to generate QR code')
      toast.error('Failed to generate QR code')
    } finally {
      setLoading(false)
    }
  }

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      toast.success('URL copied to clipboard!')
    } catch (error) {
      console.error('Failed to copy URL:', error)
      toast.error('Failed to copy URL')
    }
  }

  const downloadQRCode = () => {
    if (!qrCodeData) {
      toast.error('No QR code to download')
      return
    }
    
    try {
      const link = document.createElement('a')
      link.href = qrCodeData
      
      // Determine file extension based on data type
      const fileExtension = qrCodeData.startsWith('data:image/png') ? 'png' : 
                          qrCodeData.startsWith('data:image/svg') ? 'svg' : 'png'
      
      link.download = `${formName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_qr_code.${fileExtension}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast.success('QR code downloaded successfully!')
    } catch (error) {
      console.error('Download failed:', error)
      toast.error('Failed to download QR code')
    }
  }

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <QrCode className="h-4 w-4 mr-2" />
          QR Code
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            QR Code for {formName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* QR Code Display */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                {loading ? (
                  <div className="flex items-center justify-center h-48">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : qrCodeData ? (
                  <div className="space-y-4">
                    <div className="flex justify-center p-4 bg-white border-2 border-gray-200 rounded-lg">
                      <img 
                        src={qrCodeData} 
                        alt="QR Code for form" 
                        className="max-w-full h-48 object-contain"
                      />
                    </div>
                    
                    {error && (
                      <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                        <span className="font-medium">Warning:</span> {error}
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <Badge variant="outline" className="text-xs">
                        Scan with phone camera
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        Users can scan this code to access your form directly
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <QrCode className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>QR code will appear here</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* URL Display */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Public Form URL</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded text-xs font-mono break-all">
                <span className="flex-1">{publicUrl}</span>
                <Button variant="ghost" size="sm" onClick={copyUrl}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Actions */}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={downloadQRCode}
              disabled={!qrCodeData}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => window.open(publicUrl, '_blank')}
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
          </div>
          
          {/* Mobile Optimization Note */}
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="flex items-start gap-2">
              <Badge variant="secondary" className="text-xs">
                Mobile Ready
              </Badge>
              <div className="text-xs text-blue-800">
                <p className="font-medium mb-1">Optimized for mobile devices</p>
                <p>Form automatically adapts to phone screens for the best user experience</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}