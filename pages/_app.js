import '../styles/globals.css'
import { useEffect } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config as wagmiConfig } from '../lib/wagmi'

const queryClient = new QueryClient()

// MAINTENANCE MODE - Set to false to disable
const MAINTENANCE_MODE = true
const MAINTENANCE_MESSAGE = "We're currently performing scheduled maintenance to improve your experience. Please check back soon!"

function MaintenancePage() {
  useEffect(() => {
    const initSDK = async () => {
      try {
        await sdk.actions.ready()
      } catch (error) {
        console.error('Error calling sdk.actions.ready():', error)
      }
    }
    initSDK()
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
      padding: '20px',
      textAlign: 'center',
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '20px',
        padding: '40px',
        maxWidth: '500px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}>
        <div style={{
          fontSize: '64px',
          marginBottom: '20px',
        }}>
          🔧
        </div>
        <h1 style={{
          color: '#ffffff',
          fontSize: '28px',
          fontWeight: 'bold',
          marginBottom: '16px',
        }}>
          Under Maintenance
        </h1>
        <p style={{
          color: 'rgba(255, 255, 255, 0.7)',
          fontSize: '16px',
          lineHeight: '1.6',
        }}>
          {MAINTENANCE_MESSAGE}
        </p>
      </div>
    </div>
  )
}

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if (MAINTENANCE_MODE) return

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

  // Block all access when in maintenance mode
  if (MAINTENANCE_MODE) {
    return <MaintenancePage />
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <Component {...pageProps} />
      </QueryClientProvider>
    </WagmiProvider>
  )
}

