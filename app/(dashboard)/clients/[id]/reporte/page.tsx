import { redirect } from 'next/navigation'

// The report now lives in the dedicated Reportes section.
export default async function ClientReportRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/reportes?type=cliente&clientId=${id}`)
}
