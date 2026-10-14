import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

function parseAmount(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null
  return Number(value)
}

// GET all events, newest first, with registration counts and money collected
export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { getFreshDb } = await import('@/lib/fresh-db')
    const db = getFreshDb()

    const events = await db.event.findMany({
      orderBy: { date: 'desc' },
      include: {
        registrations: { select: { amountPaid: true } },
      },
    })

    await db.$disconnect()
    return NextResponse.json(
      events.map(({ registrations, ...event }) => ({
        ...event,
        registrationCount: registrations.length,
        totalCollected: registrations.reduce((sum, r) => sum + (r.amountPaid ?? 0), 0),
      }))
    )
  } catch (error) {
    console.error('Error fetching events:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST create event
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { getFreshDb } = await import('@/lib/fresh-db')
    const db = getFreshDb()

    const body = await request.json()
    const { title, date, location, description } = body
    const fee = parseAmount(body.fee)

    if (!title?.trim() || !date) {
      await db.$disconnect()
      return NextResponse.json({ error: 'Title and date are required' }, { status: 400 })
    }
    if (fee !== null && (Number.isNaN(fee) || fee < 0)) {
      await db.$disconnect()
      return NextResponse.json({ error: 'Fee is invalid' }, { status: 400 })
    }

    const event = await db.event.create({
      data: {
        title: title.trim(),
        date: new Date(date),
        location: location?.trim() || null,
        description: description?.trim() || null,
        fee,
        isPublic: body.isPublic !== false,
      },
    })

    await db.$disconnect()
    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    console.error('Error creating event:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
