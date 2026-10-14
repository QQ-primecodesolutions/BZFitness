import { NextResponse } from 'next/server'

// South Africa is UTC+2 all year (no daylight saving)
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000

// Public GET - upcoming public events only. Never expose registrations: they hold
// people's names and payments.
export async function GET() {
  try {
    const { getFreshDb } = await import('@/lib/fresh-db')
    const db = getFreshDb()

    // Start of today in SAST, so an event stays listed for the whole day it happens
    const startOfToday = new Date(Date.now() + SAST_OFFSET_MS)
    startOfToday.setUTCHours(0, 0, 0, 0)
    startOfToday.setTime(startOfToday.getTime() - SAST_OFFSET_MS)

    const events = await db.event.findMany({
      where: { isPublic: true, date: { gte: startOfToday } },
      orderBy: { date: 'asc' },
      select: {
        id: true,
        title: true,
        date: true,
        location: true,
        description: true,
        fee: true,
      },
    })

    await db.$disconnect()
    return NextResponse.json(events)
  } catch (error) {
    console.error('Error fetching public events:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
