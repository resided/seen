import '../styles/globals.css'
import { useEffect } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'

export default function App({ Component, pageProps }) {
  useEffect(() => {
    // Call ready() to dismiss the splash screen
    // After your app is fully loaded and ready to display
    const initSDK = async () => {
      try {
        await sdk.actions.ready()
        console.log('Farcaster SDK ready() called successfully')
      } catch (error) {
        console.error('Error calling sdk.actions.ready():', error)
      }
    }

    initSDK()
  }, [])

  return <Component {...pageProps} />
}

