import Head from 'next/head'
import Link from 'next/link'

export default function FAQ() {
  return (
    <>
      <Head>
        <title>FAQ - Seen.</title>
        <meta name="description" content="Frequently asked questions about Seen. - Mini App Discovery" />
      </Head>
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Link href="/" className="text-[10px] tracking-[0.3em] text-gray-500 hover:text-white transition-colors mb-4 inline-block">
              ← BACK TO HOME
            </Link>
            <h1 className="text-5xl font-black tracking-tight mb-2">FAQ</h1>
            <p className="text-sm text-gray-500">Frequently Asked Questions</p>
          </div>

          {/* FAQ Content */}
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-black mb-4 tracking-tight">ABOUT SEEN.</h2>
              <p className="text-gray-400 leading-relaxed text-sm">
                SEEN. is a discovery platform for Farcaster Mini Apps. We help builders get their projects seen by the Farcaster community. 
                Featured projects are highlighted for 24 hours, and users can discover, interact with, and tip builders directly.
              </p>
            </div>
            
            <div>
              <h2 className="text-2xl font-black mb-4 tracking-tight">HOW IT WORKS</h2>
              <ul className="text-gray-400 space-y-3 list-disc list-inside leading-relaxed text-sm">
                <li>Browse featured Mini Apps and category rankings</li>
                <li>Click "OPEN" to interact with Mini Apps</li>
                <li>Tip builders directly (tips go to their verified Farcaster wallet)</li>
                <li>Claim $GS tokens for checking out featured apps</li>
                <li>Submit your own project for free or pay for a featured slot</li>
              </ul>
            </div>

            <div className="p-6 border-2 border-red-500/50 bg-red-500/10">
              <h2 className="text-xl font-black mb-4 text-red-400 tracking-tight">⚠ IMPORTANT DISCLAIMER</h2>
              <p className="text-sm text-red-300 leading-relaxed mb-3">
                <strong>USE AT YOUR OWN RISK:</strong> SEEN. is a discovery platform only. We do not endorse, verify, or guarantee any Mini Apps listed on this platform.
              </p>
              <p className="text-sm text-red-300 leading-relaxed mb-3">
                <strong>DO YOUR OWN RESEARCH:</strong> Before interacting with any Mini App, you should:
              </p>
              <ul className="text-sm text-red-300 space-y-2 list-disc list-inside ml-2 mb-3">
                <li>Research the project and its creators independently</li>
                <li>Verify smart contract addresses and security audits</li>
                <li>Understand the risks associated with blockchain interactions</li>
                <li>Never share private keys or seed phrases</li>
                <li>Be cautious with transactions and token approvals</li>
              </ul>
              <p className="text-sm text-red-300 leading-relaxed">
                <strong>NO LIABILITY:</strong> SEEN. and its operators are not responsible for any losses, damages, or issues arising from your use of any Mini Apps discovered through this platform. 
                You are solely responsible for your interactions with third-party Mini Apps. Always exercise due diligence and use caution when engaging with blockchain applications.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-12 pt-8 border-t border-white/20">
            <Link href="/" className="text-[10px] tracking-[0.3em] text-gray-500 hover:text-white transition-colors">
              ← BACK TO HOME
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}

