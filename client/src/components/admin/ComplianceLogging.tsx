import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle, ShieldAlert, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

export function ComplianceLogging() {
  const [alertPage, setAlertPage] = useState(0);
  const [logPage, setLogPage] = useState(0);
  const limit = 10;

  const { data: alerts, isLoading: alertsLoading, refetch: refetchAlerts } = trpc.admin.getRiskAlerts.useQuery({
    limit,
    offset: alertPage * limit,
    includeResolved: true,
  });

  const { data: logs, isLoading: logsLoading } = trpc.admin.getAuditLogs.useQuery({
    limit,
    offset: logPage * limit,
  });

  const resolveAlertMutation = trpc.admin.resolveRiskAlert.useMutation({
    onSuccess: () => {
      toast.success("Alert marked as resolved");
      refetchAlerts();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to resolve alert");
    }
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "high": return <Badge variant="destructive">High</Badge>;
      case "medium": return <Badge variant="default" className="bg-orange-500 hover:bg-orange-600">Medium</Badge>;
      case "low": return <Badge variant="secondary">Low</Badge>;
      default: return <Badge variant="outline">{severity}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compliance & Risk Alerts</CardTitle>
        <CardDescription>Manage flagged transactions and review system audit logs</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="alerts" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="alerts" className="gap-2">
              <ShieldAlert className="w-4 h-4" />
              Risk Alerts
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2">
              <FileText className="w-4 h-4" />
              Audit Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="alerts" className="space-y-4">
            {alertsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : alerts && alerts.length > 0 ? (
              alerts.map((alert) => (
                <Card key={alert.id} className={`bg-card/50 shadow-sm border-l-4 ${alert.resolved ? 'border-l-green-500' : 'border-l-red-500'}`}>
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          {alert.resolved ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold">{alert.flagType.replace(/_/g, ' ').toUpperCase()}</p>
                            {getSeverityBadge(alert.severity)}
                            {alert.resolved && <Badge variant="outline" className="text-green-600 border-green-200">Resolved</Badge>}
                          </div>
                          <p className="text-sm">{alert.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(alert.createdAt), "PP pp")} • User #{alert.userId}
                          </p>
                        </div>
                      </div>
                      
                      {!alert.resolved && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => resolveAlertMutation.mutateAsync({ alertId: alert.id })}
                        >
                          Resolve Alert
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg">
                No risk alerts found.
              </div>
            )}
            
            <div className="flex items-center justify-end gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => setAlertPage(p => Math.max(0, p - 1))} disabled={alertPage === 0 || alertsLoading}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
              </Button>
              <div className="text-sm text-muted-foreground px-2">Page {alertPage + 1}</div>
              <Button variant="outline" size="sm" onClick={() => setAlertPage(p => p + 1)} disabled={!alerts || alerts.length < limit || alertsLoading}>
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            {logsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : logs && logs.length > 0 ? (
              <div className="rounded-md border">
                <div className="grid grid-cols-4 bg-muted/50 p-3 text-sm font-medium">
                  <div>Timestamp</div>
                  <div>Admin ID</div>
                  <div>Action</div>
                  <div>Details</div>
                </div>
                <div className="divide-y">
                  {logs.map((log) => (
                    <div key={log.id} className="grid grid-cols-4 p-3 text-sm items-center hover:bg-muted/30 transition-colors">
                      <div className="text-muted-foreground">
                        {format(new Date(log.createdAt), "MMM d, HH:mm:ss")}
                      </div>
                      <div>#{log.adminId}</div>
                      <div className="font-medium capitalize text-primary">{log.action.replace(/_/g, ' ')}</div>
                      <div className="text-muted-foreground text-xs truncate" title={log.details || ''}>
                        {log.details || "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg">
                No audit logs found.
              </div>
            )}

            <div className="flex items-center justify-end gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => setLogPage(p => Math.max(0, p - 1))} disabled={logPage === 0 || logsLoading}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
              </Button>
              <div className="text-sm text-muted-foreground px-2">Page {logPage + 1}</div>
              <Button variant="outline" size="sm" onClick={() => setLogPage(p => p + 1)} disabled={!logs || logs.length < limit || logsLoading}>
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
