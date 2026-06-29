import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">IdentityHub</CardTitle>
          <CardDescription>
            Report NHI findings directly to your Jira workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            onClick={() => { window.location.href = '/api/auth/google'; }}
          >
            Sign in with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
