import { ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRecentTickets } from '../hooks/useRecentTickets';
import type { Severity } from '../../../shared/src/types';

interface Props {
  projectKey: string;
  newTicketKey?: string;
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

const SEVERITY_STYLES: Record<Severity, { dot: string; badge: string; label: string }> = {
  critical: { dot: 'bg-red-500', badge: 'bg-red-50 text-red-700 border-red-200', label: 'Critical' },
  high:     { dot: 'bg-orange-500', badge: 'bg-orange-50 text-orange-700 border-orange-200', label: 'High' },
  medium:   { dot: 'bg-yellow-500', badge: 'bg-yellow-50 text-yellow-700 border-yellow-200', label: 'Medium' },
  low:      { dot: 'bg-blue-400', badge: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Low' },
};

export function RecentTickets({ projectKey, newTicketKey }: Props) {
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
            {tickets.map((ticket) => {
              const sev = ticket.severity ? SEVERITY_STYLES[ticket.severity] : null;
              const isNew = ticket.key === newTicketKey;
              return (
                <li
                  key={ticket.id}
                  className={`py-3 first:pt-0 last:pb-0 rounded-md px-2 -mx-2 transition-colors duration-1000 ${isNew ? 'bg-amber-50' : 'bg-transparent'}`}
                >
                  <a
                    href={ticket.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start justify-between gap-3 group"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      {sev && (
                        <span
                          className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${sev.dot}`}
                          title={sev.label}
                        />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-slate-400">{ticket.key}</span>
                          <span className="text-sm font-medium truncate group-hover:text-blue-600">
                            {ticket.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-slate-400">{timeAgo(ticket.createdAt)}</p>
                          {sev && (
                            <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${sev.badge}`}>
                              {sev.label}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 flex-shrink-0 text-slate-400 group-hover:text-blue-600 mt-0.5" />
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
