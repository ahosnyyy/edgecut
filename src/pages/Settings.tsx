import { Card, CardContent } from "../components/ui/card";
import { Settings01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

export default function Settings() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <HugeiconsIcon icon={Settings01Icon} size={32} className="text-muted-foreground" />
            <h2 className="text-lg font-semibold">Settings Coming Soon</h2>
            <p className="text-sm text-muted-foreground">
              Preferences, appearance, account, and stock defaults
              will be available in Phase 7.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
