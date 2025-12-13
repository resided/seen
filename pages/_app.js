import '../styles/globals.css'
import { useEffect } from 'react'

export default function App({ Component, pageProps }) {
  useEffect(() => {
    // Farcaster SDK is injected by the Farcaster client
    // Call ready() to dismiss the splash screen
    const initFarcaster = () => {
      if (typeof window !== 'undefined' && window.farcaster?.actions) {
        window.farcaster.actions.ready()
      } else {
        // Retry if SDK not loaded yet (should be available immediately in Farcaster context)
        setTimeout(initFarcaster, 50)
      }
    }
    initFarcaster()
  }, [])

  return <Component {...pageProps} />
}

