import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { apiFetch, ApiRequestError } from '../api/client';
import type { FindingTicketPayload, FindingTicketResult, JiraProject } from '../../../shared/src/types';

interface Props {
  projects: JiraProject[];
  selectedProjectKey: string;
  onCreated?: (key: string) => void;
}

const SEVERITY_OPTIONS = [
  { value: 'critical', label: 'Critical', color: 'text-red-600' },
  { value: 'high', label: 'High', color: 'text-orange-500' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-500' },
  { value: 'low', label: 'Low', color: 'text-blue-500' },
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

const EMPTY_FORM = {
  title: '',
  description: '',
  severity: 'high' as FindingTicketPayload['severity'],
  findingType: 'stale-credential' as FindingTicketPayload['findingType'],
  identityType: 'service-account' as FindingTicketPayload['identityType'],
};

export function CreateFindingForm({ projects, selectedProjectKey, onCreated }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const selectedProject = projects.find((p) => p.key === selectedProjectKey);

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
      setForm(EMPTY_FORM);
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['jira', 'recent', selectedProjectKey] });
      onCreated?.(result.key);
    },
    onError: (err) => {
      const msg = err instanceof ApiRequestError ? err.message : 'Failed to create ticket';
      toast.error(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    createFinding({ projectKey: selectedProjectKey, ...form });
  };

  const selectedSeverity = SEVERITY_OPTIONS.find((o) => o.value === form.severity);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)} className="flex items-center gap-2">
        <Plus className="h-4 w-4" />
        Create Finding
      </Button>

      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Create NHI Finding
            {selectedProject && (
              <Badge variant="secondary" className="font-mono text-xs">
                {selectedProject.name} · {selectedProject.key}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            File a new Non-Human Identity finding ticket in Jira.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="e.g. Stale Service Account: svc-deploy-prod"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Details about the finding…"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Severity</Label>
              <Select
                value={form.severity}
                onValueChange={(v) => setForm((f) => ({ ...f, severity: v as FindingTicketPayload['severity'] }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {selectedSeverity && (
                      <span className={selectedSeverity.color}>{selectedSeverity.label}</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SEVERITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      <span className={o.color}>{o.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Finding Type</Label>
              <Select
                value={form.findingType}
                onValueChange={(v) => setForm((f) => ({ ...f, findingType: v as FindingTicketPayload['findingType'] }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FINDING_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Identity Type</Label>
            <Select
              value={form.identityType}
              onValueChange={(v) => setForm((f) => ({ ...f, identityType: v as FindingTicketPayload['identityType'] }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IDENTITY_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating…' : 'Create Ticket'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
