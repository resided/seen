import '../styles/globals.css'
import { useEffect } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config as wagmiConfig } from '../lib/wagmi'

const queryClient = new QueryClient()

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

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <Component {...pageProps} />
      </QueryClientProvider>
    </WagmiProvider>
  )
}

