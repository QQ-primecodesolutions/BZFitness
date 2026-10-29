import { NextResponse } from 'next/server'

// South Africa is UTC+2 all year (no daylight saving)
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000
const MAX_PAST_EVENTS = 6

const PUBLIC_FIELDS = {
  id: true,
  title: true,
  date: true,
  location: true,
  description: true,
  fee: true,
} as const

// Public GET - events switched on for the website, split into upcoming and
// recent past. Never expose registrations: they hold people's names and payments.
export async function GET() {
  try {
    const { getFreshDb } = await import('@/lib/fresh-db')
    const db = getFreshDb()

    // Start of today in SAST, so an event stays "upcoming" for the whole day it happens
    const startOfToday = new Date(Date.now() + SAST_OFFSET_MS)
    startOfToday.setUTCHours(0, 0, 0, 0)
    startOfToday.setTime(startOfToday.getTime() - SAST_OFFSET_MS)

    const [upcoming, past] = await Promise.all([
      db.event.findMany({
        where: { isPublic: true, date: { gte: startOfToday } },
        orderBy: { date: 'asc' },
        select: PUBLIC_FIELDS,
      }),
      db.event.findMany({
        where: { isPublic: true, date: { lt: startOfToday } },
        orderBy: { date: 'desc' },
        take: MAX_PAST_EVENTS,
        select: PUBLIC_FIELDS,
      }),
    ])

    await db.$disconnect()
    return NextResponse.json({ upcoming, past })
  } catch (error) {
    console.error('Error fetching public events:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
