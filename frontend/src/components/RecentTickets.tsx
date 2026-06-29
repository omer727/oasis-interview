import { ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRecentTickets } from '../hooks/useRecentTickets';

interface Props {

  projectKey: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function RecentTickets({ projectKey }: Props) {
  const { data: tickets, isLoading, error } = useRecentTickets(projectKey);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Recent Findings
          <Badge variant="outline">{projectKey}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-slate-500">Loading tickets...</p>}
        {error && <p className="text-sm text-red-500">Failed to load recent tickets</p>}
        {tickets && tickets.length === 0 && (
          <p className="text-sm text-slate-500">No findings created yet for this project</p>
        )}
        {tickets && tickets.length > 0 && (
          <ul className="divide-y">
            {tickets.map((ticket) => (
              <li key={ticket.id} className="py-3 first:pt-0 last:pb-0">
                <a
                  href={ticket.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start justify-between gap-2 group hover:text-blue-600"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-400">{ticket.key}</span>
                      <span className="text-sm font-medium truncate group-hover:text-blue-600">
                        {ticket.title}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{timeAgo(ticket.createdAt)}</p>
                  </div>
                  <ExternalLink className="w-4 h-4 flex-shrink-0 text-slate-400 group-hover:text-blue-600 mt-0.5" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
