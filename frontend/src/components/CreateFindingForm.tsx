import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch, ApiRequestError } from '../api/client';
import type { FindingTicketPayload, FindingTicketResult, JiraProject } from '../../../shared/src/types';

interface Props {
  projects: JiraProject[];
  selectedProjectKey: string;
  onProjectChange: (key: string) => void;
}

const SEVERITY_OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const FINDING_TYPE_OPTIONS = [
  { value: 'stale-credential', label: 'Stale Credential' },
  { value: 'overprivileged', label: 'Overprivileged' },
  { value: 'expiring-credential', label: 'Expiring Credential' },
  { value: 'misconfigured', label: 'Misconfigured' },
];

const IDENTITY_TYPE_OPTIONS = [
  { value: 'service-account', label: 'Service Account' },
  { value: 'api-key', label: 'API Key' },
  { value: 'service-principal', label: 'Service Principal' },
  { value: 'oauth-app', label: 'OAuth App' },
];

export function CreateFindingForm({ projects, selectedProjectKey, onProjectChange }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: '',
    description: '',
    severity: 'high' as FindingTicketPayload['severity'],
    findingType: 'stale-credential' as FindingTicketPayload['findingType'],
    identityType: 'service-account' as FindingTicketPayload['identityType'],
  });

  const { mutate: createFinding, isPending } = useMutation({
    mutationFn: (payload: FindingTicketPayload) =>
      apiFetch<FindingTicketResult>('/api/jira/findings', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (result) => {
      toast.success(
        <span>
          Ticket{' '}
          <a href={result.url} target="_blank" rel="noopener noreferrer" className="underline font-medium">
            {result.key}
          </a>{' '}
          created
        </span>
      );
      setForm({ title: '', description: '', severity: 'high', findingType: 'stale-credential', identityType: 'service-account' });
      queryClient.invalidateQueries({ queryKey: ['jira', 'recent', selectedProjectKey] });
    },
    onError: (err) => {
      const msg = err instanceof ApiRequestError ? err.message : 'Failed to create ticket';
      toast.error(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectKey) { toast.error('Select a Jira project first'); return; }
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    createFinding({ projectKey: selectedProjectKey, ...form });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create NHI Finding</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Project</Label>
            <Select value={selectedProjectKey} onValueChange={onProjectChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a project..." />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.name} ({p.key})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="e.g. Stale Service Account: svc-deploy-prod"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Details about the finding..."
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Severity</Label>
              <Select value={form.severity} onValueChange={(v) => setForm((f) => ({ ...f, severity: v as FindingTicketPayload['severity'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEVERITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Finding Type</Label>
              <Select value={form.findingType} onValueChange={(v) => setForm((f) => ({ ...f, findingType: v as FindingTicketPayload['findingType'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FINDING_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Identity Type</Label>
              <Select value={form.identityType} onValueChange={(v) => setForm((f) => ({ ...f, identityType: v as FindingTicketPayload['identityType'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {IDENTITY_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isPending || !selectedProjectKey}>
            {isPending ? 'Creating...' : 'Create Finding Ticket'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
