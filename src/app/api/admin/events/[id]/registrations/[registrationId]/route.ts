import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

function parseAmount(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null
  return Number(value)
}

// PATCH update the payment on a registration (e.g. paid on the day)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; registrationId: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id: eventId, registrationId } = await params
    const { getFreshDb } = await import('@/lib/fresh-db')
    const db = getFreshDb()

    const body = await request.json()
    const amountPaid = parseAmount(body.amountPaid)
    if (amountPaid !== null && (Number.isNaN(amountPaid) || amountPaid < 0)) {
      await db.$disconnect()
      return NextResponse.json({ error: 'Payment amount is invalid' }, { status: 400 })
    }

    const result = await db.eventRegistration.updateMany({
      where: { id: registrationId, eventId },
      data: { amountPaid },
    })

    await db.$disconnect()
    if (result.count === 0) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
    }
    return NextResponse.json({ message: 'Payment updated' })
  } catch (error) {
    console.error('Error updating event registration:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE remove a registration
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; registrationId: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id: eventId, registrationId } = await params
    const { getFreshDb } = await import('@/lib/fresh-db')
    const db = getFreshDb()

    const result = await db.eventRegistration.deleteMany({
      where: { id: registrationId, eventId },
    })

    await db.$disconnect()
    if (result.count === 0) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
    }
    return NextResponse.json({ message: 'Registration removed' })
  } catch (error) {
    console.error('Error deleting event registration:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
