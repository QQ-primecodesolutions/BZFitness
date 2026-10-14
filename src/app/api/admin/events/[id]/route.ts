import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

function parseAmount(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null
  return Number(value)
}

// GET one event with its registrations
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const { getFreshDb } = await import('@/lib/fresh-db')
    const db = getFreshDb()

    const event = await db.event.findUnique({
      where: { id },
      include: {
        registrations: { orderBy: { createdAt: 'asc' } },
      },
    })

    await db.$disconnect()
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    return NextResponse.json(event)
  } catch (error) {
    console.error('Error fetching event:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT update event
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
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

    const event = await db.event.update({
      where: { id },
      data: {
        title: title.trim(),
        date: new Date(date),
        location: location?.trim() || null,
        description: description?.trim() || null,
        fee,
      },
    })

    await db.$disconnect()
    return NextResponse.json(event)
  } catch (error) {
    console.error('Error updating event:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE event (its registrations are deleted with it)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const { getFreshDb } = await import('@/lib/fresh-db')
    const db = getFreshDb()

    await db.event.delete({ where: { id } })

    await db.$disconnect()
    return NextResponse.json({ message: 'Event deleted successfully' })
  } catch (error) {
    console.error('Error deleting event:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
