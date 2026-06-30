import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';

const FEATURES = [
  { label: 'Stale credentials', desc: 'Service accounts and API keys unused for 90+ days' },
  { label: 'Overprivileged identities', desc: 'Machine accounts with more access than they need' },
  { label: 'Expiring secrets', desc: 'Tokens and certificates approaching rotation deadlines' },
];

export function LoginPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        background: 'linear-gradient(160deg, #ffffff 0%, #eaecf8 45%, #c8ccee 100%)',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #0d0d1915 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      <Card className="w-full max-w-md relative shadow-lg border-[#e2e4f3]">
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center mb-3">
            <img src="/oasis-logo.svg" alt="Oasis" className="h-5" style={{ color: '#0d0d19' }} />
          </div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-2xl font-bold text-[#0d0d19]">Identity</span>
            <span className="text-2xl font-bold text-[#4f5cd6]">Hub</span>
          </div>
          <CardDescription className="text-sm leading-relaxed text-[#504e62]">
            Non-Human Identity security findings — surface risks from machine accounts,
            API keys, service principals, and OAuth apps, then file them directly as Jira tickets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ul className="space-y-2.5">
            {FEATURES.map((f) => (
              <li key={f.label} className="flex items-start gap-2.5 text-sm">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#4f5cd6] flex-shrink-0" />
                <span>
                  <span className="font-medium text-[#0d0d19]">{f.label}</span>
                  <span className="text-[#504e62]"> — {f.desc}</span>
                </span>
              </li>
            ))}
          </ul>

          <Button
            className="w-full bg-[#4f5cd6] hover:bg-[#3743b8] text-white font-medium rounded-lg"
            onClick={() => { window.location.href = '/api/auth/google'; }}
          >
            Sign in with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
