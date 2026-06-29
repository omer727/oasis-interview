import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '../hooks/useAuth';
import { useJiraStatus } from '../hooks/useJiraStatus';
import { apiFetch } from '../api/client';
import { useQueryClient } from '@tanstack/react-query';

export function Header() {
  const { user } = useAuth();
  const { status, disconnect, isDisconnecting } = useJiraStatus();
  const queryClient = useQueryClient();

  const handleLogout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    queryClient.clear();
    window.location.href = '/login';
  };

  return (
    <header className="border-b bg-white px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold">IdentityHub</h1>
        <Badge variant="secondary">NHI Findings</Badge>
      </div>

      <div className="flex items-center gap-4">
        {status.connected ? (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            <span>{status.baseUrl?.replace('https://', '')}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => disconnect()}
              disabled={isDisconnecting}
            >
              Disconnect
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => { window.location.href = '/api/jira/connect'; }}
          >
            Connect Jira
          </Button>
        )}

        <div className="flex items-center gap-2 text-sm">
          {user?.avatarUrl && (
            <img src={user.avatarUrl} alt="" className="w-7 h-7 rounded-full" />
          )}
          <span className="text-slate-700">{user?.displayName}</span>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
