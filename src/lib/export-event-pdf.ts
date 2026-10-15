// Printable event register (A4 PDF) with BZ branding.
//
// Registered people are listed first, followed by blank rows for walk-ins who
// register and pay on the day. The Notes column is left empty for handwriting.

import { format } from 'date-fns'
import { CONSENT_TEXT } from '@/lib/event-consent'

export interface EventRegisterData {
  title: string
  date: string
  location: string | null
  fee: number | null
  registrations: {
    fullName: string
    memberId: string | null
    consent: boolean
    amountPaid: number | null
  }[]
}

const BLANK_ROWS = 15
const BRAND_GREEN: [number, number, number] = [22, 163, 74] // Tailwind green-600, as on the site
const GREY: [number, number, number] = [107, 114, 128]
const MARGIN = 14

const formatRand = (amount: number) => `R${amount.toFixed(2).replace(/\.00$/, '')}`

async function loadLogo(): Promise<string | null> {
  try {
    const blob = await (await fetch('/BZ.png')).blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null // a register without the logo is still useful
  }
}

export async function exportEventRegisterPdf(event: EventRegisterData) {
  // Loaded on demand so the libraries stay out of the initial page bundle
  const [{ jsPDF }, { default: autoTable }, logo] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    loadLogo(),
  ])

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const contentWidth = pageWidth - MARGIN * 2

  // ---- Brand header ----
  if (logo) doc.addImage(logo, 'PNG', MARGIN, 10, 22, 22, undefined, 'FAST')
  const textX = logo ? MARGIN + 27 : MARGIN
  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(0)
  doc.text('BZ Fitness and Wellness', textX, 19)
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...GREY)
  doc.text('Event register', textX, 25)
  doc.setFontSize(8)
  doc.text(`Generated ${format(new Date(), 'd MMM yyyy, HH:mm')}`, pageWidth - MARGIN, 19, { align: 'right' })

  doc.setDrawColor(...BRAND_GREEN).setLineWidth(0.8)
  doc.line(MARGIN, 36, pageWidth - MARGIN, 36)

  // ---- Event details ----
  let y = 45
  doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(0)
  doc.text(event.title, MARGIN, y)
  y += 6
  doc.setFont('helvetica', 'normal').setFontSize(10)
  const details = [
    format(new Date(event.date), 'EEEE, d MMMM yyyy · HH:mm'),
    event.location,
    event.fee ? `Fee: ${formatRand(event.fee)}` : 'Free event',
  ].filter(Boolean)
  doc.text(details.join('   |   '), MARGIN, y)
  y += 6

  const collected = event.registrations.reduce((sum, r) => sum + (r.amountPaid ?? 0), 0)
  doc.setFont('helvetica', 'bold')
  doc.text(
    `Registered: ${event.registrations.length}     Paid so far: ${formatRand(collected)}`,
    MARGIN,
    y
  )
  y += 6

  doc.setFont('helvetica', 'italic').setFontSize(8).setTextColor(...GREY)
  const consentLines = doc.splitTextToSize(
    `Consent: ${CONSENT_TEXT} Walk-ins must tick the consent box before taking part.`,
    contentWidth
  )
  doc.text(consentLines, MARGIN, y)
  y += consentLines.length * 3.5 + 3

  // ---- Register table ----
  const registeredCount = event.registrations.length
  const body = [
    ...event.registrations.map((r, i) => [
      String(i + 1),
      r.fullName,
      r.memberId ? 'Member' : 'Non-member',
      r.consent ? 'Yes' : '',
      r.amountPaid !== null ? formatRand(r.amountPaid) : '',
      '',
    ]),
    ...Array.from({ length: BLANK_ROWS }, (_, i) => [String(registeredCount + i + 1), '', '', '', '', '']),
  ]

  const CONSENT_COL = 3
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN, bottom: 18 },
    head: [['#', 'Full name', 'Type', 'Consent', 'Paid', 'Notes']],
    body,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      minCellHeight: 8,
      valign: 'middle',
      lineColor: [209, 213, 219],
      lineWidth: 0.2,
      textColor: 0,
    },
    headStyles: { fillColor: BRAND_GREEN, textColor: 255, fontStyle: 'bold', minCellHeight: 8 },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center', textColor: GREY },
      1: { cellWidth: 52 },
      2: { cellWidth: 24 },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 'auto' }, // Notes - deliberately left empty
    },
    didParseCell: (data) => {
      // Line each heading up with its column's values
      const HEAD_ALIGN: Record<number, 'center' | 'right'> = { 0: 'center', [CONSENT_COL]: 'center', 4: 'right' }
      if (data.section === 'head' && HEAD_ALIGN[data.column.index]) {
        data.cell.styles.halign = HEAD_ALIGN[data.column.index]
      }
    },
    didDrawCell: (data) => {
      // Empty tick box for walk-ins in the blank rows
      if (data.section === 'body' && data.column.index === CONSENT_COL && data.row.index >= registeredCount) {
        const size = 4
        doc.setDrawColor(0).setLineWidth(0.3)
        doc.rect(data.cell.x + (data.cell.width - size) / 2, data.cell.y + (data.cell.height - size) / 2, size, size)
      }
    },
  })

  // ---- Sign-off line, under the table (new page if it doesn't fit) ----
  let endY = (doc as any).lastAutoTable.finalY + 12
  if (endY > pageHeight - 24) {
    doc.addPage()
    endY = 24
  }
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(0)
  doc.text('Collected on the day:  R ____________', MARGIN, endY)
  doc.text('Checked by:  ______________________', pageWidth - MARGIN, endY, { align: 'right' })

  // ---- Footer on every page ----
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GREY)
    doc.text(`BZ Fitness and Wellness · ${event.title}`, MARGIN, pageHeight - 8)
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - MARGIN, pageHeight - 8, { align: 'right' })
  }

  const slug = event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  doc.save(`${slug || 'event'}-register-${format(new Date(event.date), 'yyyy-MM-dd')}.pdf`)
}
