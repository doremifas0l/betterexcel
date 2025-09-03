import React, { createContext, useContext, useState } from 'react'

interface FullscreenContextType {
  isFullscreen: boolean
  toggleFullscreen: () => void
  enterFullscreen: () => void
  exitFullscreen: () => void
}

const FullscreenContext = createContext<FullscreenContextType | undefined>(undefined)

export function FullscreenProvider({ children }: { children: React.ReactNode }) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  const toggleFullscreen = () => {
    setIsFullscreen(prev => !prev)
  }

  const enterFullscreen = () => {
    setIsFullscreen(true)
  }

  const exitFullscreen = () => {
    setIsFullscreen(false)
  }

  return (
    <FullscreenContext.Provider value={{
      isFullscreen,
      toggleFullscreen,
      enterFullscreen,
      exitFullscreen
    }}>
      {children}
    </FullscreenContext.Provider>
  )
}

export function useFullscreen() {
  const context = useContext(FullscreenContext)
  if (context === undefined) {
    throw new Error('useFullscreen must be used within a FullscreenProvider')
  }
  return context
}
