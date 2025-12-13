import Seen from '../TheBoardDiscovery'
import Head from 'next/head'

export default function Home() {
  // Farcaster Mini App embed metadata
  const frame = {
    version: "1", // Must be "1", not "next"
    imageUrl: "https://seen-red.vercel.app/og-image.png", // 3:2 aspect ratio
    button: {
      title: "Open Seen", // Max 32 characters
      action: {
        type: "launch_frame",
        name: "Seen.",
        url: "https://seen-red.vercel.app", // Optional, defaults to current URL
        splashImageUrl: "https://seen-red.vercel.app/icon.png", // 200x200px
        splashBackgroundColor: "#000000"
      }
    }
  }

  return (
    <>
      <Head>
        <title>Seen. - Mini App Discovery</title>
        <meta name="description" content="Helping Farcaster builders get seen" />
        <meta name="fc:miniapp" content={JSON.stringify(frame)} />
        <meta property="og:title" content="Seen. - Mini App Discovery" />
        <meta property="og:description" content="Helping Farcaster builders get seen" />
        <meta property="og:image" content="https://seen-red.vercel.app/og-image.png" />
      </Head>
      <Seen />
    </>
  )
}

