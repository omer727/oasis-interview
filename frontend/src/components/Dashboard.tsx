import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Header } from './Header';
import { CreateFindingForm } from './CreateFindingForm';
import { RecentTickets } from './RecentTickets';
import { useJiraStatus } from '../hooks/useJiraStatus';
import { useJiraProjects } from '../hooks/useJiraProjects';

export function Dashboard() {
  const { status } = useJiraStatus();
  const { data: projects = [], isLoading: projectsLoading } = useJiraProjects(status.connected);
  const [selectedProjectKey, setSelectedProjectKey] = useState('');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8">
        {!status.connected ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center space-y-3">
            <p className="font-medium text-amber-800">Connect your Jira workspace to get started</p>
            <p className="text-sm text-amber-700">
              Link your Atlassian account to create and view NHI finding tickets.
            </p>
            <Button onClick={() => { window.location.href = '/api/jira/connect'; }}>
              Connect Jira
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CreateFindingForm
              projects={projects}
              selectedProjectKey={selectedProjectKey}
              onProjectChange={setSelectedProjectKey}
            />
            {selectedProjectKey ? (
              <RecentTickets projectKey={selectedProjectKey} />
            ) : (
              <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 text-slate-400 text-sm p-8">
                Select a project to see recent findings
              </div>
            )}
          </div>
        )}
        {projectsLoading && status.connected && (
          <p className="text-center text-sm text-slate-400 mt-4">Loading projects...</p>
        )}
      </main>
    </div>
  );
}
