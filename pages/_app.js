import '../styles/globals.css'
import { useEffect } from 'react'

export default function App({ Component, pageProps }) {
  useEffect(() => {
    // Call ready() to dismiss the splash screen
    // Farcaster Mini Apps run in an iframe, SDK is injected by parent
    if (typeof window === 'undefined') return

    const callReady = () => {
      // Method 1: Check window.farcaster (SDK might be injected directly)
      if (window.farcaster?.actions?.ready) {
        try {
          window.farcaster.actions.ready()
          console.log('Called ready() via window.farcaster')
          return true
        } catch (e) {
          console.error('Error calling ready via window.farcaster:', e)
        }
      }

      // Method 2: Check parent window (Farcaster frame)
      if (window.parent && window.parent !== window) {
        try {
          if (window.parent.farcaster?.actions?.ready) {
            window.parent.farcaster.actions.ready()
            console.log('Called ready() via parent.farcaster')
            return true
          }
        } catch (e) {
          // Cross-origin error is expected, try postMessage
        }
      }

      // Method 3: Use postMessage (Farcaster SDK communication method)
      try {
        window.parent.postMessage(
          { type: 'farcaster:ready' },
          '*' // Farcaster will handle the origin
        )
        console.log('Sent ready() via postMessage')
        return true
      } catch (e) {
        console.error('Error sending ready via postMessage:', e)
      }

      return false
    }

    // Try immediately
    if (!callReady()) {
      // Retry a few times in case SDK loads after page
      let attempts = 0
      const maxAttempts = 50 // More attempts for slower loads
      const interval = setInterval(() => {
        attempts++
        if (callReady() || attempts >= maxAttempts) {
          clearInterval(interval)
          if (attempts >= maxAttempts) {
            console.warn('Farcaster SDK ready() not called after max attempts')
          }
        }
      }, 100)
      
      return () => clearInterval(interval)
    }
  }, [])

  return <Component {...pageProps} />
}

