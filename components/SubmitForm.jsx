import React, { useState } from 'react';

const SubmitForm = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: '',
    tagline: '',
    description: '',
    builder: '',
    builderFid: '',
    category: 'main',
    miniapp: '',
    website: '',
    github: '',
    submissionType: 'queue', // 'queue' (free) or 'featured' (paid)
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  
  // Featured submission pricing (configurable)
  const FEATURED_PRICE = 0.01; // ETH or tokens - adjust as needed

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    // If featured submission, payment would be handled here
    // For now, just submit with payment amount
    const paymentAmount = formData.submissionType === 'featured' ? FEATURED_PRICE : 0;

    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          submissionType: formData.submissionType,
          paymentAmount: paymentAmount,
          links: {
            miniapp: formData.miniapp,
            website: formData.website,
            github: formData.github,
          }
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (formData.submissionType === 'featured') {
          setMessage(`SUBMITTED! PAYMENT REQUIRED: ${FEATURED_PRICE} ETH. YOU WILL BE REDIRECTED TO PAY.`);
          // TODO: Handle payment flow here
          // - Connect wallet
          // - Send transaction
          // - Verify payment
        } else {
          setMessage('SUBMITTED! YOUR PROJECT WILL BE ADDED TO THE QUEUE.');
        }
        setTimeout(() => {
          onSubmit?.();
          onClose();
        }, 3000);
      } else {
        setMessage(data.error || 'SUBMISSION FAILED');
      }
    } catch (error) {
      setMessage('ERROR SUBMITTING PROJECT');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-black border-2 border-white max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="border-b border-white p-4 flex items-center justify-between">
          <h2 className="text-xl font-black tracking-tight">SUBMIT YOUR PROJECT</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-400 text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {message && (
            <div className={`p-4 border border-white ${message.includes('SUBMITTED') ? 'bg-white text-black' : 'bg-red-900 text-white'}`}>
              {message}
            </div>
          )}

          <div>
            <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
              PROJECT NAME *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
              placeholder="YOUR PROJECT NAME"
            />
          </div>

          <div>
            <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
              TAGLINE *
            </label>
            <input
              type="text"
              name="tagline"
              value={formData.tagline}
              onChange={handleChange}
              required
              className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
              placeholder="SHORT TAGLINE"
            />
          </div>

          <div>
            <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
              DESCRIPTION *
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows="4"
              className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
              placeholder="DESCRIBE YOUR PROJECT"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                BUILDER NAME *
              </label>
              <input
                type="text"
                name="builder"
                value={formData.builder}
                onChange={handleChange}
                required
                className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                placeholder="YOUR.ETH"
              />
            </div>
            <div>
              <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                FID (OPTIONAL)
              </label>
              <input
                type="number"
                name="builderFid"
                value={formData.builderFid}
                onChange={handleChange}
                className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                placeholder="12345"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
              SUBMISSION TYPE *
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border border-white cursor-pointer hover:bg-white/10">
                <input
                  type="radio"
                  name="submissionType"
                  value="queue"
                  checked={formData.submissionType === 'queue'}
                  onChange={handleChange}
                  className="accent-white"
                />
                <div className="flex-1">
                  <div className="text-sm font-bold">FREE QUEUE</div>
                  <div className="text-[10px] text-gray-500">Added to queue, no payment required</div>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 border border-white cursor-pointer hover:bg-white/10">
                <input
                  type="radio"
                  name="submissionType"
                  value="featured"
                  checked={formData.submissionType === 'featured'}
                  onChange={handleChange}
                  className="accent-white"
                />
                <div className="flex-1">
                  <div className="text-sm font-bold">FEATURED SLOT</div>
                  <div className="text-[10px] text-gray-500">{FEATURED_PRICE} ETH - Priority placement</div>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
              CATEGORY *
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
              className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
            >
              <option value="main">MAIN</option>
              <option value="defi">DEFI</option>
              <option value="social">SOCIAL</option>
              <option value="games">GAMES</option>
              <option value="tools">TOOLS</option>
              <option value="nft">NFT</option>
            </select>
          </div>

          <div>
            <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
              MINI APP URL
            </label>
            <input
              type="url"
              name="miniapp"
              value={formData.miniapp}
              onChange={handleChange}
              className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
              placeholder="https://warpcast.com/~/mini-app/your-app"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                WEBSITE
              </label>
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={handleChange}
                className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                placeholder="https://yourproject.com"
              />
            </div>
            <div>
              <label className="block text-xs tracking-[0.2em] text-gray-500 mb-2">
                GITHUB
              </label>
              <input
                type="url"
                name="github"
                value={formData.github}
                onChange={handleChange}
                className="w-full bg-black border border-white px-4 py-2 text-sm focus:outline-none focus:bg-white focus:text-black"
                placeholder="https://github.com/yourproject"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="py-3 border border-white font-bold text-sm tracking-[0.2em] hover:bg-white hover:text-black transition-all"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="py-3 bg-white text-black font-black text-sm tracking-[0.2em] hover:bg-gray-200 transition-all disabled:opacity-50"
            >
              {submitting ? 'SUBMITTING...' : 'SUBMIT'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SubmitForm;

