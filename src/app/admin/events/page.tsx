'use client'

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { AdminLayout } from '@/components/admin-layout'
import { ArrowLeft, CalendarDays, Edit, MapPin, Plus, Search, Trash2, UserPlus, Users } from 'lucide-react'

interface EventSummary {
  id: string
  title: string
  date: string
  location: string | null
  description: string | null
  fee: number | null
  registrationCount: number
  totalCollected: number
}

interface Registration {
  id: string
  memberId: string | null
  fullName: string
  consent: boolean
  consentAt: string | null
  amountPaid: number | null
  createdAt: string
}

interface EventDetail extends Omit<EventSummary, 'registrationCount' | 'totalCollected'> {
  registrations: Registration[]
}

interface Member {
  id: string
  name: string
  phone: string
  status: string
}

const CONSENT_TEXT =
  'The participant consents to taking part in this event, confirms they are fit to participate, ' +
  'and understands that participation is at their own risk.'

const emptyEventForm = { title: '', date: '', location: '', description: '', fee: '' }
const emptyRegisterForm = {
  type: 'member' as 'member' | 'non-member',
  memberId: '',
  fullName: '',
  amountPaid: '',
  consent: false,
}

const formatRand = (amount: number) => `R${amount.toFixed(2).replace(/\.00$/, '')}`

export default function EventsPage() {
  const { toast } = useToast()
  const [events, setEvents] = useState<EventSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<EventDetail | null>(null)
  const [members, setMembers] = useState<Member[]>([])

  const [isEventModalOpen, setIsEventModalOpen] = useState(false)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [eventForm, setEventForm] = useState(emptyEventForm)

  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false)
  const [registerForm, setRegisterForm] = useState(emptyRegisterForm)
  const [memberSearch, setMemberSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [paymentEditing, setPaymentEditing] = useState<Registration | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')

  useEffect(() => {
    fetchEvents()
    fetch('/api/admin/members')
      .then(r => (r.ok ? r.json() : []))
      .then(setMembers)
      .catch(() => {})
  }, [])

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/admin/events')
      if (res.ok) setEvents(await res.json())
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchEventDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/events/${id}`)
      if (res.ok) {
        setSelectedEvent(await res.json())
      } else {
        toast({ title: 'Error', description: 'Failed to load event', variant: 'destructive' })
      }
    } catch (error) {
      console.error('Error fetching event:', error)
    }
  }

  const refresh = () => {
    fetchEvents()
    if (selectedEvent) fetchEventDetail(selectedEvent.id)
  }

  // Generic JSON request with toast feedback; returns true on success
  const send = async (url: string, method: string, body: unknown, successMessage: string) => {
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      if (res.ok) {
        toast({ title: 'Success', description: successMessage })
        return true
      }
      const error = await res.json().catch(() => ({}))
      toast({ title: 'Error', description: error.error || 'Something went wrong', variant: 'destructive' })
    } catch (error) {
      console.error(error)
      toast({ title: 'Error', description: 'Something went wrong', variant: 'destructive' })
    }
    return false
  }

  // ---- Events ----

  const openAddEvent = () => {
    setEditingEventId(null)
    setEventForm(emptyEventForm)
    setIsEventModalOpen(true)
  }

  const openEditEvent = (event: EventDetail) => {
    setEditingEventId(event.id)
    setEventForm({
      title: event.title,
      date: format(new Date(event.date), "yyyy-MM-dd'T'HH:mm"),
      location: event.location ?? '',
      description: event.description ?? '',
      fee: event.fee !== null ? String(event.fee) : '',
    })
    setIsEventModalOpen(true)
  }

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    // Convert the local date-time to an ISO instant here, in the browser's timezone
    const body = { ...eventForm, date: new Date(eventForm.date).toISOString() }
    const ok = editingEventId
      ? await send(`/api/admin/events/${editingEventId}`, 'PUT', body, 'Event updated')
      : await send('/api/admin/events', 'POST', body, 'Event created')
    setSubmitting(false)
    if (ok) {
      setIsEventModalOpen(false)
      refresh()
    }
  }

  const handleDeleteEvent = async (event: EventDetail) => {
    const count = event.registrations.length
    const warning = count > 0 ? ` This will also remove ${count} registration${count !== 1 ? 's' : ''}.` : ''
    if (!confirm(`Delete "${event.title}"?${warning}`)) return
    if (await send(`/api/admin/events/${event.id}`, 'DELETE', undefined, 'Event deleted')) {
      setSelectedEvent(null)
      fetchEvents()
    }
  }

  // ---- Registrations ----

  const openRegister = () => {
    setRegisterForm(emptyRegisterForm)
    setMemberSearch('')
    setIsRegisterModalOpen(true)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEvent) return
    if (registerForm.type === 'member' && !registerForm.memberId) {
      toast({ title: 'Error', description: 'Select a member to register', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    const ok = await send(
      `/api/admin/events/${selectedEvent.id}/registrations`,
      'POST',
      {
        memberId: registerForm.type === 'member' ? registerForm.memberId : null,
        fullName: registerForm.type === 'non-member' ? registerForm.fullName : null,
        amountPaid: registerForm.amountPaid,
        consent: registerForm.consent,
      },
      'Person registered'
    )
    setSubmitting(false)
    if (ok) {
      setIsRegisterModalOpen(false)
      refresh()
    }
  }

  const handleRemoveRegistration = async (registration: Registration) => {
    if (!selectedEvent) return
    if (!confirm(`Remove ${registration.fullName} from this event?`)) return
    if (
      await send(
        `/api/admin/events/${selectedEvent.id}/registrations/${registration.id}`,
        'DELETE',
        undefined,
        'Registration removed'
      )
    ) {
      refresh()
    }
  }

  const openEditPayment = (registration: Registration) => {
    setPaymentEditing(registration)
    setPaymentAmount(registration.amountPaid !== null ? String(registration.amountPaid) : '')
  }

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEvent || !paymentEditing) return
    if (
      await send(
        `/api/admin/events/${selectedEvent.id}/registrations/${paymentEditing.id}`,
        'PATCH',
        { amountPaid: paymentAmount },
        'Payment updated'
      )
    ) {
      setPaymentEditing(null)
      refresh()
    }
  }

  const registeredMemberIds = useMemo(
    () => new Set(selectedEvent?.registrations.map(r => r.memberId).filter(Boolean)),
    [selectedEvent]
  )

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase()
    return members
      .filter(m => !q || m.name.toLowerCase().includes(q) || m.phone.includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [members, memberSearch])

  const totalCollected = selectedEvent?.registrations.reduce((sum, r) => sum + (r.amountPaid ?? 0), 0) ?? 0

  const feeBadge = (fee: number | null) =>
    fee ? <Badge className="bg-green-600">{formatRand(fee)}</Badge> : <Badge variant="secondary">Free</Badge>

  return (
    <AdminLayout title="Events">
      {selectedEvent ? (
        <>
          <Button variant="ghost" className="mb-4 -ml-2 flex items-center gap-2" onClick={() => setSelectedEvent(null)}>
            <ArrowLeft className="h-4 w-4" />
            All events
          </Button>

          <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-3xl font-bold">{selectedEvent.title}</h2>
                {feeBadge(selectedEvent.fee)}
              </div>
              <div className="text-muted-foreground mt-2 space-y-1 text-sm">
                <p className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  {format(new Date(selectedEvent.date), 'EEEE, d MMMM yyyy, HH:mm')}
                </p>
                {selectedEvent.location && (
                  <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {selectedEvent.location}
                  </p>
                )}
              </div>
              {selectedEvent.description && (
                <p className="mt-3 max-w-2xl whitespace-pre-line">{selectedEvent.description}</p>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={openRegister} className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Register person
              </Button>
              <Button variant="outline" size="icon" onClick={() => openEditEvent(selectedEvent)} aria-label="Edit event">
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => handleDeleteEvent(selectedEvent)} aria-label="Delete event">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Registrations</CardTitle>
              <CardDescription>
                {selectedEvent.registrations.length} registered
                {totalCollected > 0 && <> · {formatRand(totalCollected)} collected</>}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedEvent.registrations.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No one has registered yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Full name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Consent</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedEvent.registrations.map(registration => (
                        <TableRow key={registration.id}>
                          <TableCell className="font-medium">{registration.fullName}</TableCell>
                          <TableCell>
                            {registration.memberId ? (
                              <Badge>Member</Badge>
                            ) : (
                              <Badge variant="outline">Non-member</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {registration.consent && registration.consentAt
                              ? `Given ${format(new Date(registration.consentAt), 'd MMM yyyy, HH:mm')}`
                              : '—'}
                          </TableCell>
                          <TableCell>
                            {registration.amountPaid !== null ? (
                              <span className="font-semibold text-green-600">{formatRand(registration.amountPaid)}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <Button size="sm" variant="ghost" onClick={() => openEditPayment(registration)} aria-label="Edit payment">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleRemoveRegistration(registration)} aria-label="Remove registration">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold">Events</h2>
              <p className="text-muted-foreground mt-1">Manage events and register members and non-members</p>
            </div>
            <Button className="flex items-center gap-2" onClick={openAddEvent}>
              <Plus className="h-4 w-4" />
              Add Event
            </Button>
          </div>

          {loading ? (
            <Card>
              <CardHeader>
                <CardTitle>Loading...</CardTitle>
              </CardHeader>
            </Card>
          ) : events.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No Events Yet</CardTitle>
                <CardDescription>Add your first event to start taking registrations</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {events.map(event => {
                const isPast = new Date(event.date) < new Date()
                return (
                  <Card
                    key={event.id}
                    className={`cursor-pointer transition-shadow hover:shadow-md ${isPast ? 'opacity-70' : ''}`}
                    onClick={() => fetchEventDetail(event.id)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle>{event.title}</CardTitle>
                        {feeBadge(event.fee)}
                      </div>
                      <CardDescription className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        {format(new Date(event.date), 'EEE, d MMM yyyy, HH:mm')}
                        {isPast && <Badge variant="outline">Past</Badge>}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {event.location && (
                        <p className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          {event.location}
                        </p>
                      )}
                      <p className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {event.registrationCount} registered
                        {event.totalCollected > 0 && (
                          <span className="text-green-600 font-semibold">· {formatRand(event.totalCollected)}</span>
                        )}
                      </p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Add / edit event */}
      <Dialog open={isEventModalOpen} onOpenChange={setIsEventModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEventId ? 'Edit Event' : 'Add New Event'}</DialogTitle>
            <DialogDescription>Leave the fee empty for a free event</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEvent}>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="event-title">Title *</Label>
                <Input
                  id="event-title"
                  value={eventForm.title}
                  onChange={e => setEventForm({ ...eventForm, title: e.target.value })}
                  placeholder="e.g., Fun Run, Bootcamp Saturday"
                  required
                />
              </div>
              <div>
                <Label htmlFor="event-date">Date & time *</Label>
                <Input
                  id="event-date"
                  type="datetime-local"
                  value={eventForm.date}
                  onChange={e => setEventForm({ ...eventForm, date: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="event-location">Location</Label>
                <Input
                  id="event-location"
                  value={eventForm.location}
                  onChange={e => setEventForm({ ...eventForm, location: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="event-fee">Fee (R)</Label>
                <Input
                  id="event-fee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={eventForm.fee}
                  onChange={e => setEventForm({ ...eventForm, fee: e.target.value })}
                  placeholder="Free"
                />
              </div>
              <div>
                <Label htmlFor="event-description">Description</Label>
                <Textarea
                  id="event-description"
                  value={eventForm.description}
                  onChange={e => setEventForm({ ...eventForm, description: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {editingEventId ? 'Update Event' : 'Add Event'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Register person */}
      <Dialog open={isRegisterModalOpen} onOpenChange={setIsRegisterModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register for {selectedEvent?.title}</DialogTitle>
            <DialogDescription>Register an existing member or someone who isn&apos;t a member</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRegister}>
            <div className="space-y-4 py-4">
              <Tabs
                value={registerForm.type}
                onValueChange={value =>
                  setRegisterForm({ ...registerForm, type: value as 'member' | 'non-member' })
                }
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="member">Existing member</TabsTrigger>
                  <TabsTrigger value="non-member">Non-member</TabsTrigger>
                </TabsList>
              </Tabs>

              {registerForm.type === 'member' ? (
                <div className="space-y-2">
                  <Label htmlFor="member-search">Member *</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="member-search"
                      className="pl-9"
                      value={memberSearch}
                      onChange={e => setMemberSearch(e.target.value)}
                      placeholder="Search by name or phone"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-md border">
                    {filteredMembers.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">No members found</p>
                    ) : (
                      filteredMembers.map(member => {
                        const alreadyRegistered = registeredMemberIds.has(member.id)
                        const selected = registerForm.memberId === member.id
                        return (
                          <button
                            key={member.id}
                            type="button"
                            disabled={alreadyRegistered}
                            onClick={() => setRegisterForm({ ...registerForm, memberId: member.id })}
                            className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm border-b last:border-b-0 disabled:opacity-50 disabled:cursor-not-allowed ${
                              selected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                            }`}
                          >
                            <span>
                              {member.name}
                              <span className={`ml-2 text-xs ${selected ? '' : 'text-muted-foreground'}`}>{member.phone}</span>
                            </span>
                            {alreadyRegistered && <span className="text-xs">Registered</span>}
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <Label htmlFor="full-name">Full name *</Label>
                  <Input
                    id="full-name"
                    value={registerForm.fullName}
                    onChange={e => setRegisterForm({ ...registerForm, fullName: e.target.value })}
                    placeholder="Name and surname"
                    required
                  />
                </div>
              )}

              <div>
                <Label htmlFor="amount-paid">Payment (R) — optional</Label>
                <Input
                  id="amount-paid"
                  type="number"
                  min="0"
                  step="0.01"
                  value={registerForm.amountPaid}
                  onChange={e => setRegisterForm({ ...registerForm, amountPaid: e.target.value })}
                  placeholder="Not paid"
                />
                {selectedEvent?.fee ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Event fee is {formatRand(selectedEvent.fee)}.{' '}
                    <button
                      type="button"
                      className="underline"
                      onClick={() => setRegisterForm({ ...registerForm, amountPaid: String(selectedEvent.fee) })}
                    >
                      Use fee
                    </button>
                  </p>
                ) : null}
              </div>

              <div className="flex items-start gap-3 rounded-md border p-3">
                <Checkbox
                  id="consent"
                  checked={registerForm.consent}
                  onCheckedChange={checked => setRegisterForm({ ...registerForm, consent: checked === true })}
                  className="mt-0.5"
                />
                <Label htmlFor="consent" className="text-sm font-normal leading-snug">
                  {CONSENT_TEXT}
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!registerForm.consent || submitting}>
                Register
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit payment */}
      <Dialog open={paymentEditing !== null} onOpenChange={open => !open && setPaymentEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment for {paymentEditing?.fullName}</DialogTitle>
            <DialogDescription>Clear the amount to mark as not paid</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSavePayment}>
            <div className="py-4">
              <Label htmlFor="edit-amount">Amount (R)</Label>
              <Input
                id="edit-amount"
                type="number"
                min="0"
                step="0.01"
                value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
                placeholder="Not paid"
              />
            </div>
            <DialogFooter>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
