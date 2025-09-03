import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/context/AuthContext'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

export function LoginForm() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !password) {
      toast.error('Please enter both email and password')
      return
    }

    setLoading(true)
    console.log('Login form: Attempting to sign in with:', email)
    
    try {
      const { data, error } = await signIn(email, password)
      
      if (error) {
        console.error('Login form: Sign in error:', error)
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Invalid email or password. Please try again or use the demo credentials.')
        } else if (error.message.includes('Email not confirmed')) {
          toast.error('Please check your email and confirm your account before signing in.')
        } else {
          toast.error(`Sign in failed: ${error.message}`)
        }
      } else {
        console.log('Login form: Sign in successful')
        toast.success('Successfully signed in! Welcome to Infomration Hub.')
        // Redirect to dashboard after successful login
        navigate('/')
      }
    } catch (error: any) {
      console.error('Login form: Sign in exception:', error)
      toast.error(error.message || 'An unexpected error occurred during sign in')
    } finally {
      setLoading(false)
    }
  }

  // Auto-fill demo credentials when demo button is clicked
  const fillDemoCredentials = () => {
    setEmail('olgtgjjp@minimax.com')
    setPassword('nRqIAG688T')
    toast.info('Demo credentials filled. Click Sign In to continue.')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Infomration Hub</CardTitle>
          <CardDescription className="text-center">
            Advanced Spreadsheet Application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Enter your email"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Enter your password"
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border">
            <h4 className="font-medium text-blue-900 mb-2">Demo Credentials:</h4>
            <p className="text-sm text-blue-700 mb-3">
              Email: <strong>olgtgjjp@minimax.com</strong><br />
              Password: <strong>nRqIAG688T</strong>
            </p>
            <Button 
              type="button"
              variant="outline"
              size="sm"
              onClick={fillDemoCredentials}
              className="w-full text-blue-700 border-blue-300 hover:bg-blue-100"
              disabled={loading}
            >
              Use Demo Credentials
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
