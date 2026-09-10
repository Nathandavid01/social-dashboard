import { notFound } from 'next/navigation'
import { readIdeaClientProposal } from '@/lib/actions/idea-client-proposals'
import { ClientIdeaApproval } from '@/components/ideas/client-idea-approval'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Revisar ideas | Nate Media', robots: { index: false, follow: false } }
export default async function ApproveIdeasPage({ params }: { params: { token: string } }) {
  const proposal = await readIdeaClientProposal(params.token)
  if (!proposal) notFound()
  return <ClientIdeaApproval token={params.token} clientName={proposal.client_name} date={proposal.session_date} ideas={proposal.ideas} responses={proposal.responses} />
}
