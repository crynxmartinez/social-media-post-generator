import React, { useState, useEffect } from 'react'
import jsPDF from 'jspdf'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

const THEMES = [
  { name: 'Clean White', bg: '#ffffff', text: '#1a1a1a', accent: '#0a66c2' },
  { name: 'Dark Mode', bg: '#1a1a1a', text: '#ffffff', accent: '#70b5f9' },
  { name: 'Soft Cream', bg: '#faf8f5', text: '#2d2d2d', accent: '#d4a574' },
  { name: 'Ocean Blue', bg: '#0a66c2', text: '#ffffff', accent: '#ffffff' },
  { name: 'Mint Fresh', bg: '#e8f5e9', text: '#1b5e20', accent: '#2e7d32' },
  { name: 'Sunset', bg: '#fff3e0', text: '#e65100', accent: '#ff6d00' },
]

function App() {
  // Load saved profile from localStorage
  const getSavedProfile = () => {
    try {
      const saved = localStorage.getItem('linkedin-carousel-profile')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  }

  const savedProfile = getSavedProfile()

  const [name, setName] = useState(savedProfile?.name || 'Your Name')
  const [handle, setHandle] = useState(savedProfile?.handle || '@yourhandle')
  const [quotes, setQuotes] = useState('')
  const [profileImage, setProfileImage] = useState(savedProfile?.profileImage || null)
  const [selectedTheme, setSelectedTheme] = useState(
    savedProfile?.theme ? THEMES.find(t => t.name === savedProfile.theme) || THEMES[0] : THEMES[0]
  )
  const [generating, setGenerating] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)

  // Save profile to localStorage whenever it changes
  useEffect(() => {
    const profile = {
      name,
      handle,
      profileImage,
      theme: selectedTheme.name
    }
    localStorage.setItem('linkedin-carousel-profile', JSON.stringify(profile))
  }, [name, handle, profileImage, selectedTheme])

  const quoteList = quotes.split('\n').filter(q => q.trim() !== '')

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setProfileImage(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  // Helper to convert hex to RGB
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 }
  }

  // Word wrap helper
  const wrapText = (pdf, text, maxWidth) => {
    const words = text.split(' ')
    const lines = []
    let currentLine = ''

    words.forEach(word => {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const testWidth = pdf.getTextWidth(testLine)
      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    })
    if (currentLine) lines.push(currentLine)
    return lines
  }

  const generatePDF = async () => {
    if (quoteList.length === 0) {
      alert('Please add at least one quote!')
      return
    }

    setGenerating(true)

    try {
      const size = 1080
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [size, size],
        compress: true
      })

      const bgColor = hexToRgb(selectedTheme.bg)
      const textColor = hexToRgb(selectedTheme.text)
      const accentColor = hexToRgb(selectedTheme.accent)

      for (let i = 0; i < quoteList.length; i++) {
        if (i > 0) {
          pdf.addPage([size, size])
        }

        // Background
        pdf.setFillColor(bgColor.r, bgColor.g, bgColor.b)
        pdf.rect(0, 0, size, size, 'F')

        // Profile image (circle placeholder if no image)
        const margin = 150  // Extra margin to avoid LinkedIn arrows
        const avatarX = margin
        const avatarY = 420
        const avatarSize = 70
        
        if (profileImage) {
          // Draw circular clip for profile image
          pdf.addImage(profileImage, 'PNG', avatarX, avatarY, avatarSize, avatarSize)
        } else {
          pdf.setFillColor(180, 180, 180)
          pdf.circle(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 'F')
        }

        // Name
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(24)
        pdf.setTextColor(textColor.r, textColor.g, textColor.b)
        pdf.text(name, avatarX + avatarSize + 20, avatarY + 30)

        // Handle
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(20)
        pdf.setTextColor(accentColor.r, accentColor.g, accentColor.b)
        pdf.text(handle, avatarX + avatarSize + 20, avatarY + 55)

        // Quote text
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(48)
        pdf.setTextColor(textColor.r, textColor.g, textColor.b)
        
        const maxWidth = size - (margin * 2)
        const lines = wrapText(pdf, quoteList[i], maxWidth)
        const lineHeight = 62
        const startY = 550
        
        lines.forEach((line, lineIndex) => {
          pdf.text(line, margin, startY + (lineIndex * lineHeight))
        })

        // Page number
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(18)
        pdf.setTextColor(textColor.r, textColor.g, textColor.b)
        pdf.text(`${i + 1} / ${quoteList.length}`, size - 100, size - 40)
      }

      // Use first quote as filename (sanitized)
      const title = quoteList[0]
        .replace(/[^a-zA-Z0-9\s]/g, '')  // Remove special chars
        .trim()
        .substring(0, 50)  // Limit length
        .replace(/\s+/g, '-')  // Replace spaces with dashes
        .toLowerCase() || 'linkedin-carousel'
      
      pdf.save(`${title}.pdf`)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Error generating PDF. Please try again.')
    }

    setGenerating(false)
  }

  // Generate images as ZIP for Facebook
  const generateImages = async () => {
    if (quoteList.length === 0) {
      alert('Please add at least one quote!')
      return
    }

    setGenerating(true)

    try {
      const size = 1080
      const zip = new JSZip()
      
      const bgColor = hexToRgb(selectedTheme.bg)
      const textColor = hexToRgb(selectedTheme.text)
      const accentColor = hexToRgb(selectedTheme.accent)

      for (let i = 0; i < quoteList.length; i++) {
        // Create canvas for each slide
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')

        // Background
        ctx.fillStyle = selectedTheme.bg
        ctx.fillRect(0, 0, size, size)

        // Profile image
        const margin = 150
        const avatarX = margin
        const avatarY = 420
        const avatarSize = 70

        if (profileImage) {
          const img = new Image()
          img.src = profileImage
          await new Promise((resolve) => {
            img.onload = resolve
          })
          
          // Draw circular avatar
          ctx.save()
          ctx.beginPath()
          ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2)
          ctx.closePath()
          ctx.clip()
          ctx.drawImage(img, avatarX, avatarY, avatarSize, avatarSize)
          ctx.restore()
        } else {
          ctx.fillStyle = '#b4b4b4'
          ctx.beginPath()
          ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2)
          ctx.fill()
        }

        // Name
        ctx.font = 'bold 24px Helvetica, Arial, sans-serif'
        ctx.fillStyle = selectedTheme.text
        ctx.fillText(name, avatarX + avatarSize + 20, avatarY + 35)

        // Handle
        ctx.font = '20px Helvetica, Arial, sans-serif'
        ctx.fillStyle = selectedTheme.accent
        ctx.fillText(handle, avatarX + avatarSize + 20, avatarY + 60)

        // Quote text with word wrap
        ctx.font = 'bold 48px Helvetica, Arial, sans-serif'
        ctx.fillStyle = selectedTheme.text
        
        const maxWidth = size - (margin * 2)
        const words = quoteList[i].split(' ')
        const lines = []
        let currentLine = ''

        words.forEach(word => {
          const testLine = currentLine ? `${currentLine} ${word}` : word
          const metrics = ctx.measureText(testLine)
          if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine)
            currentLine = word
          } else {
            currentLine = testLine
          }
        })
        if (currentLine) lines.push(currentLine)

        const lineHeight = 62
        const startY = 550
        lines.forEach((line, lineIndex) => {
          ctx.fillText(line, margin, startY + (lineIndex * lineHeight))
        })

        // Page number
        ctx.font = '18px Helvetica, Arial, sans-serif'
        ctx.fillStyle = selectedTheme.text
        ctx.globalAlpha = 0.5
        ctx.fillText(`${i + 1} / ${quoteList.length}`, size - 80, size - 40)
        ctx.globalAlpha = 1

        // Convert to blob and add to zip
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
        zip.file(`slide-${String(i + 1).padStart(2, '0')}.png`, blob)
      }

      // Generate and download zip
      const title = quoteList[0]
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .trim()
        .substring(0, 50)
        .replace(/\s+/g, '-')
        .toLowerCase() || 'carousel-images'

      const content = await zip.generateAsync({ type: 'blob' })
      saveAs(content, `${title}-images.zip`)
    } catch (error) {
      console.error('Error generating images:', error)
      alert('Error generating images. Please try again.')
    }

    setGenerating(false)
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">LinkedIn Carousel Generator</h1>
          <p className="text-gray-500 text-sm">Create swipeable PDF carousels for LinkedIn</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel - Controls */}
          <div className="space-y-6">
            {/* Profile Section */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Profile</h2>
              
              <div className="flex items-center gap-4 mb-4">
                <div className="relative">
                  <div 
                    className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden cursor-pointer border-2 border-dashed border-gray-300 hover:border-blue-500 transition-colors"
                    onClick={() => document.getElementById('profile-upload').click()}
                  >
                    {profileImage ? (
                      <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    )}
                  </div>
                  <input
                    id="profile-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your Name"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  <input
                    type="text"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder="@yourhandle"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-blue-600"
                  />
                </div>
              </div>
            </div>

            {/* Theme Selection */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4">Theme</h2>
              <div className="grid grid-cols-3 gap-3">
                {THEMES.map((theme) => (
                  <button
                    key={theme.name}
                    onClick={() => setSelectedTheme(theme)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedTheme.name === theme.name 
                        ? 'border-blue-500 ring-2 ring-blue-200' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div 
                      className="w-full h-8 rounded mb-2"
                      style={{ backgroundColor: theme.bg, border: '1px solid #e5e7eb' }}
                    />
                    <span className="text-xs font-medium text-gray-700">{theme.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quotes Input */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-2">Quotes / Content</h2>
              <p className="text-sm text-gray-500 mb-4">Enter one quote per line. Each line becomes a slide.</p>
              <textarea
                value={quotes}
                onChange={(e) => setQuotes(e.target.value)}
                placeholder="The opportunity you're looking for is in the hard work you're avoiding.

Success is not about luck, it's about consistency.

Your future is created by what you do today, not tomorrow."
                className="w-full h-48 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
              />
              <p className="text-sm text-gray-500 mt-2">
                {quoteList.length} slide{quoteList.length !== 1 ? 's' : ''} will be generated
              </p>
            </div>

            {/* Generate Buttons */}
            <div className="space-y-3">
              {/* PDF for LinkedIn */}
              <button
                onClick={generatePDF}
                disabled={generating || quoteList.length === 0}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download PDF (LinkedIn)
                  </>
                )}
              </button>

              {/* Images for Facebook */}
              <button
                onClick={generateImages}
                disabled={generating || quoteList.length === 0}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Download Images ZIP (Facebook)
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Panel - Preview */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Preview</h2>
                {quoteList.length > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPreviewIndex(Math.max(0, previewIndex - 1))}
                      disabled={previewIndex === 0}
                      className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="text-sm text-gray-600">
                      {previewIndex + 1} / {quoteList.length}
                    </span>
                    <button
                      onClick={() => setPreviewIndex(Math.min(quoteList.length - 1, previewIndex + 1))}
                      disabled={previewIndex === quoteList.length - 1}
                      className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Slide Preview */}
              <div className="flex justify-center">
                <div 
                  className="w-full max-w-md aspect-square rounded-lg shadow-lg overflow-hidden"
                  style={{ backgroundColor: selectedTheme.bg }}
                >
                  {quoteList.length > 0 ? (
                    <div className="w-full h-full flex flex-col justify-center p-8">
                      {/* Profile Header */}
                      <div className="flex items-center gap-3 mb-8">
                        <div className="w-12 h-12 rounded-full bg-gray-300 overflow-hidden flex-shrink-0">
                          {profileImage ? (
                            <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-gray-300 to-gray-400" />
                          )}
                        </div>
                        <div>
                          <div className="font-semibold flex items-center gap-1" style={{ color: selectedTheme.text }}>
                            {name}
                            <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="text-sm" style={{ color: selectedTheme.accent }}>
                            {handle}
                          </div>
                        </div>
                      </div>
                      
                      {/* Quote */}
                      <p 
                        className="text-2xl font-bold leading-relaxed"
                        style={{ color: selectedTheme.text }}
                      >
                        {quoteList[previewIndex]}
                      </p>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <p>Add quotes to see preview</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Page indicators */}
            {quoteList.length > 1 && (
              <div className="flex justify-center gap-2">
                {quoteList.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setPreviewIndex(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === previewIndex ? 'bg-blue-600 w-6' : 'bg-gray-300 hover:bg-gray-400'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}

export default App
