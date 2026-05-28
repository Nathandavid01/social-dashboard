import { StatusBadge } from '@/components/clients/status-badge'
import { PlatformBadges } from '@/components/clients/platform-badges'
import { ClientLogoUpload } from './client-logo-upload'
import { PaymentStatusPill } from './payment-status-pill'
import { ContractCountdown } from './contract-countdown'
import { LastMeetingPill } from './last-meeting-pill'
import { Mail, Phone, User } from 'lucide-react'
import type { Client, ClientPayment } from '@/lib/supabase/types'

interface ClientHeroProps {
  client: Client
  lastPayment: ClientPayment | null
}

export function ClientHero({ client, lastPayment }: ClientHeroProps) {
  return (
    <header
      className="
        relative overflow-hidden rounded-xl border bg-card
        animate-in fade-in slide-in-from-top-2 duration-500
      "
    >
      {/* brand color tint background — uses CSS vars when available */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-30 blur-2xl"
        style={
          client.brand_colors?.primary
            ? { background: `linear-gradient(135deg, ${client.brand_colors.primary}, transparent 70%)` }
            : undefined
        }
      />

      <div className="relative flex flex-col gap-5 p-5 sm:p-6 md:flex-row md:items-center md:gap-6">
        {/* Logo */}
        <div className="shrink-0 self-start md:self-auto">
          <ClientLogoUpload
            clientId={client.id}
            currentLogoUrl={client.logo_url}
            currentLogoDarkUrl={client.logo_dark_url}
            clientName={client.name}
          />
        </div>

        {/* Identity */}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{client.name}</h1>
            <StatusBadge status={client.status} />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
            {client.industry && (
              <span className="text-muted-foreground">{client.industry}</span>
            )}
            {client.platforms?.length > 0 && (
              <PlatformBadges platforms={client.platforms} />
            )}
          </div>

          {/* Owner contact */}
          {(client.owner_name || client.owner_email || client.owner_phone) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
              {client.owner_name && (
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> {client.owner_name}
                </span>
              )}
              {client.owner_email && (
                <a href={`mailto:${client.owner_email}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
                  <Mail className="h-3.5 w-3.5" /> {client.owner_email}
                </a>
              )}
              {client.owner_phone && (
                <a href={`tel:${client.owner_phone}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
                  <Phone className="h-3.5 w-3.5" /> {client.owner_phone}
                </a>
              )}
            </div>
          )}
        </div>

        {/* Mini stats — wraps cleanly on small screens */}
        <div className="grid w-full grid-cols-3 gap-2 md:w-auto md:flex md:flex-col md:items-end md:gap-2">
          <PaymentStatusPill monthlyFee={client.monthly_fee} lastPayment={lastPayment} />
          <ContractCountdown expiresAt={client.contract_expires_at} />
          <LastMeetingPill lastMeetingAt={client.last_meeting_at} />
        </div>
      </div>
    </header>
  )
}
