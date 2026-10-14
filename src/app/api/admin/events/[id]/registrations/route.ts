import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

function parseAmount(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null
  return Number(value)
}

// POST register an existing member (memberId) or a non-member (fullName)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id: eventId } = await params
    const { getFreshDb } = await import('@/lib/fresh-db')
    const db = getFreshDb()

    const body = await request.json()
    const { memberId, fullName, consent } = body
    const amountPaid = parseAmount(body.amountPaid)

    if (consent !== true) {
      await db.$disconnect()
      return NextResponse.json(
        { error: 'Consent must be given before registering' },
        { status: 400 }
      )
    }
    if (amountPaid !== null && (Number.isNaN(amountPaid) || amountPaid < 0)) {
      await db.$disconnect()
      return NextResponse.json({ error: 'Payment amount is invalid' }, { status: 400 })
    }

    const event = await db.event.findUnique({ where: { id: eventId } })
    if (!event) {
      await db.$disconnect()
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    let name: string = typeof fullName === 'string' ? fullName.trim() : ''
    if (memberId) {
      const member = await db.member.findUnique({ where: { id: memberId } })
      if (!member) {
        await db.$disconnect()
        return NextResponse.json({ error: 'Member not found' }, { status: 404 })
      }
      const existing = await db.eventRegistration.findUnique({
        where: { eventId_memberId: { eventId, memberId } },
      })
      if (existing) {
        await db.$disconnect()
        return NextResponse.json(
          { error: `${member.name} is already registered for this event` },
          { status: 409 }
        )
      }
      name = member.name
    }

    if (!name) {
      await db.$disconnect()
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 })
    }

    const registration = await db.eventRegistration.create({
      data: {
        eventId,
        memberId: memberId || null,
        fullName: name,
        consent: true,
        consentAt: new Date(),
        amountPaid,
      },
    })

    await db.$disconnect()
    return NextResponse.json(registration, { status: 201 })
  } catch (error) {
    console.error('Error creating event registration:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
