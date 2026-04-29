import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const { userId } = await auth();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Your Cases</h1>
        <p className="text-gray-500 mt-1">Manage and track your legal matters.</p>
      </div>

      {/* Empty state */}
      <Card className="border-dashed">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-lg">No cases yet</CardTitle>
          <CardDescription>
            Start by creating your first case. Vera will help you organize everything.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pt-2 pb-6">
          <Button asChild>
            <Link href="/cases/new">+ Start a new case</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
