import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '../hooks/useAuth';
import { useJiraStatus } from '../hooks/useJiraStatus';
import { apiFetch } from '../api/client';
import { useQueryClient } from '@tanstack/react-query';

export function Header() {
  const { user } = useAuth();
  const { status, disconnect, isDisconnecting } = useJiraStatus();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const handleLogout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    queryClient.clear();
    window.location.href = '/login';
  };

  return (
    <header className="border-b border-[#e2e4f3] bg-white px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold tracking-tight">
          <span className="text-[#0d0d19]">Identity</span>
          <span className="text-[#4f5cd6]">Hub</span>
        </h1>
        <Badge className="bg-[#eaecf8] text-[#4f5cd6] border-[#c8ccee] hover:bg-[#eaecf8]">NHI Findings</Badge>
      </div>

      <div className="flex items-center gap-4">
        {status.connected ? (
          <div className="flex items-center gap-2 text-sm text-[#504e62]">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            <span>{status.baseUrl?.replace('https://', '')}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDisconnect(true)}
              disabled={isDisconnecting}
              className="text-[#504e62] hover:text-[#0d0d19]"
            >
              Disconnect
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            disabled={isConnecting}
            onClick={() => { setIsConnecting(true); window.location.href = '/api/jira/connect'; }}
            className="bg-[#4f5cd6] hover:bg-[#3743b8] text-white rounded-lg"
          >
            {isConnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Connect Jira'}
          </Button>
        )}

        <div className="flex items-center gap-2 text-sm">
          {user?.avatarUrl && (
            <img src={user.avatarUrl} alt="" className="w-7 h-7 rounded-full" />
          )}
          <span className="text-[#0d0d19]">{user?.displayName}</span>
          <span className="w-px h-4 bg-[#e2e4f3]" />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-[#504e62] hover:text-red-600 hover:bg-red-50"
          >
            Sign out
          </Button>
        </div>
      </div>

      <Dialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Disconnect Jira?</DialogTitle>
            <DialogDescription>
              You'll need to reconnect and re-authorise to create or view findings again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDisconnect(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isDisconnecting}
              onClick={() => { disconnect(); setConfirmDisconnect(false); }}
            >
              {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Disconnect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
