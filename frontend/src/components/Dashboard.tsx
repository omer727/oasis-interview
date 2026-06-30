import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Header } from './Header';
import { CreateFindingForm } from './CreateFindingForm';
import { RecentTickets } from './RecentTickets';
import { useJiraStatus } from '../hooks/useJiraStatus';
import { useJiraProjects } from '../hooks/useJiraProjects';

export function Dashboard() {
  const { status } = useJiraStatus();
  const { data: projects = [], isLoading: projectsLoading } = useJiraProjects(status.connected);
  const [selectedProjectKey, setSelectedProjectKey] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [newTicketKey, setNewTicketKey] = useState<string | undefined>();

  const handleCreated = (key: string) => {
    setNewTicketKey(key);
    setTimeout(() => setNewTicketKey(undefined), 2500);
  };

  useEffect(() => {
    if (projects.length > 0 && !selectedProjectKey) {
      setSelectedProjectKey(projects[0].key);
    }
  }, [projects, selectedProjectKey]);

  return (
    <div className="min-h-screen bg-[#f5f6fc] flex flex-col">
      <Header />
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8">
        {!status.connected ? (
          <div className="rounded-lg border border-[#c8ccee] bg-[#eaecf8] p-6 text-center space-y-3">
            <p className="font-medium text-[#0d0d19]">Connect your Jira workspace to get started</p>
            <p className="text-sm text-[#504e62]">
              Link your Atlassian account to create and view NHI finding tickets.
            </p>
            <Button
              disabled={isConnecting}
              onClick={() => { setIsConnecting(true); window.location.href = '/api/jira/connect'; }}
            >
              {isConnecting
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Connecting…</>
                : 'Connect Jira'}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-64">
                <Select value={selectedProjectKey} onValueChange={setSelectedProjectKey}>
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder="Select a project…" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.key} value={p.key}>
                        <span className="font-medium">{p.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">({p.key})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <CreateFindingForm
                projects={projects}
                selectedProjectKey={selectedProjectKey}
                onCreated={handleCreated}
              />

              {projectsLoading && (
                <span className="text-sm text-slate-400">Loading projects…</span>
              )}
            </div>

            {selectedProjectKey ? (
              <RecentTickets projectKey={selectedProjectKey} newTicketKey={newTicketKey} />
            ) : (
              <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 text-slate-400 text-sm p-12">
                Select a project to see recent findings
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
