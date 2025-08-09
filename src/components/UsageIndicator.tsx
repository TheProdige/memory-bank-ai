import { useMemo, useRef } from "react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Zap, AlertTriangle, TrendingUp, TrendingDown, Activity, Clock } from "lucide-react";
import { useUsageLimits } from "@/hooks/useUsageLimits";
import useUsageAnalytics from "@/hooks/useUsageAnalytics";
import { useToast } from "@/components/ui/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ResponsiveContainer, LineChart, Line } from "recharts";

export interface UsageIndicatorProps {
  variant?: 'compact' | 'full' | 'minimal' | 'dashboard';
  showPrediction?: boolean;
  showHistory?: boolean;
  animated?: boolean;
  showUpgradePrompt?: boolean;
  position?: 'header' | 'sidebar' | 'floating';
  onUpgradeClick?: () => void;
  customColors?: {
    safe: string;
    warning: string;
    danger: string;
    pro: string;
  };
}

const getStatus = (pct: number) => {
  if (pct >= 85) return 'danger';
  if (pct >= 60) return 'warning';
  return 'safe';
};

const circleCircumference = 2 * Math.PI * 18; // r=18 for 40px svg with padding

export const UsageIndicator = ({
  variant = 'compact',
  showPrediction = true,
  showHistory = false,
  animated = true,
  showUpgradePrompt = true,
  position,
  onUpgradeClick,
  customColors,
}: UsageIndicatorProps) => {
  const { dailyUsed, dailyLimit, subscriptionTier, loading } = useUsageLimits();
  const { history, averageDaily, trend, predictedEndOfDay, hourlyRate } = useUsageAnalytics({
    enableHistory: variant === 'full' || variant === 'dashboard' || showHistory,
    enablePrediction: showPrediction,
  });
  const { toast } = useToast();
  const notified75 = useRef(false);
  const notified95 = useRef(false);

  const percentage = useMemo(() => {
    const pct = dailyLimit > 0 ? (dailyUsed / dailyLimit) * 100 : 0;
    return Math.min(100, Math.max(0, Math.round(pct)));
  }, [dailyUsed, dailyLimit]);

  const status = getStatus(percentage);
  const isAtLimit = dailyLimit > 0 && dailyUsed >= dailyLimit;
  const isPro = subscriptionTier === 'pro';

  // Proactive notifications
  if (!loading && !isPro) {
    if (!notified75.current && percentage >= 75 && percentage < 95) {
      notified75.current = true;
      toast({ title: "Attention", description: `Plus que ${Math.max(dailyLimit - dailyUsed, 0)} enregistrements aujourd'hui.` });
    }
    if (!notified95.current && percentage >= 95 && !isAtLimit) {
      notified95.current = true;
      toast({ title: "Limite proche", description: "Vous êtes sur le point d'atteindre votre limite quotidienne." });
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-muted rounded w-24" />
      </div>
    );
  }

  const colorClass =
    status === 'danger' ? 'text-destructive' : status === 'warning' ? 'text-accent' : 'text-primary';
  const barAccentClass =
    status === 'danger' ? 'bg-destructive' : status === 'warning' ? 'bg-accent' : 'bg-primary';

  const tierBadge = (
    <Badge
      variant={isPro ? 'default' : 'secondary'}
      className={isPro ? 'bg-accent text-accent-foreground' : ''}
    >
      {subscriptionTier === 'pro' ? (
        <>
          <Crown className="w-3 h-3 mr-1" /> PRO
        </>
      ) : (
        <>
          <Zap className="w-3 h-3 mr-1" /> FREE
        </>
      )}
    </Badge>
  );

  // Variants
  if (variant === 'minimal') {
    const radius = 18;
    const dash = (percentage / 100) * circleCircumference;
    const strokeClass =
      status === 'danger' ? 'stroke-destructive' : status === 'warning' ? 'stroke-accent' : 'stroke-primary';

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={`relative inline-flex items-center justify-center ${animated ? 'transition-all duration-300' : ''}`}
              aria-label={`Usage quotidien: ${dailyUsed}/${dailyLimit}`}
              role="img"
            >
              <svg width="40" height="40" viewBox="0 0 40 40" className={`${percentage > 95 ? 'animate-pulse' : ''}`}>
                <circle cx="20" cy="20" r={radius} className="stroke-muted fill-none" strokeWidth="4" />
                <circle
                  cx="20"
                  cy="20"
                  r={radius}
                  className={`fill-none ${strokeClass}`}
                  strokeWidth="4"
                  strokeDasharray={`${dash} ${circleCircumference - dash}`}
                  strokeLinecap="round"
                  transform="rotate(-90 20 20)"
                />
                <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" className="text-[10px] fill-foreground">
                  {percentage}%
                </text>
              </svg>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">
              <div className="flex items-center gap-2">{tierBadge}<span>{dailyUsed}/{dailyLimit} aujourd'hui</span></div>
              {showPrediction && predictedEndOfDay != null && (
                <div className="mt-1 text-muted-foreground text-xs">Prédiction: {Math.min(predictedEndOfDay, dailyLimit)} / {dailyLimit}</div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          {tierBadge}
          <span className="text-sm text-muted-foreground">{dailyUsed}/{dailyLimit} aujourd'hui</span>
          {percentage >= 85 && <AlertTriangle className={`w-4 h-4 ${colorClass}`} />}
        </div>
        {percentage > 50 && (
          <div className="mt-1">
            <div className={`h-1 w-40 rounded-full bg-muted overflow-hidden ${animated ? 'transition-all duration-1000' : ''}`}>
              <div className={`h-1 ${barAccentClass}`} style={{ width: `${percentage}%` }} />
            </div>
          </div>
        )}
      </div>
    );
  }

  const containerPositionClass = position === 'floating'
    ? 'fixed bottom-4 right-4 z-40'
    : position === 'sidebar'
      ? 'w-full'
      : '';

  if (variant === 'dashboard') {
    return (
      <div className={containerPositionClass}>
        <Card className="shadow-elegant">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {tierBadge}
                <span className="text-sm font-medium">Usage quotidien</span>
              </div>
              <span className={`text-sm ${colorClass}`}>{percentage}%</span>
            </div>

            <Progress value={percentage} className={`h-2 ${animated ? 'transition-all duration-1000' : ''}`} />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <div className="p-2 rounded bg-muted/40">
                <div className="text-xs text-muted-foreground">Moyenne 7j</div>
                <div className="flex items-center gap-1"><Activity className="w-3 h-3" /><span className="text-sm font-medium">{Math.round(averageDaily)}</span></div>
              </div>
              <div className="p-2 rounded bg-muted/40">
                <div className="text-xs text-muted-foreground">Tendance</div>
                <div className="flex items-center gap-1">
                  {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : trend === 'down' ? <TrendingDown className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  <span className="text-sm font-medium capitalize">{trend}</span>
                </div>
              </div>
              <div className="p-2 rounded bg-muted/40">
                <div className="text-xs text-muted-foreground">Débit (h)</div>
                <div className="text-sm font-medium">{hourlyRate.toFixed(2)}</div>
              </div>
              {showPrediction && (
                <div className="p-2 rounded bg-muted/40">
                  <div className="text-xs text-muted-foreground">Prédiction fin de journée</div>
                  <div className="text-sm font-medium">{Math.min(predictedEndOfDay || 0, dailyLimit)} / {dailyLimit}</div>
                </div>
              )}
            </div>

            {(showHistory || history.length) ? (
              <div className="mt-4 h-16">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
                    <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : null}

            {showUpgradePrompt && !isPro && (
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Besoin de plus d'enregistrements ?</span>
                <Button size="sm" variant="default" onClick={onUpgradeClick}>Passer Pro</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // full
  return (
    <div className={containerPositionClass}>
      <Card className={`shadow-elegant ${animated ? 'transition-all duration-300' : ''} ${isAtLimit ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              {tierBadge}
              <span className="text-sm font-medium">Usage quotidien</span>
            </div>
            <span className={`text-sm ${colorClass}`}>{percentage}%</span>
          </div>

          <Progress value={percentage} className={`h-2 ${animated ? 'transition-all duration-1000' : ''}`} />

          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{dailyUsed}/{dailyLimit} utilisés</span>
            {showPrediction && predictedEndOfDay != null && (
              <span>À ce rythme: {Math.min(predictedEndOfDay, dailyLimit)} / {dailyLimit}</span>
            )}
          </div>

          {(showHistory || history.length) && (
            <div className="mt-4 h-16">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
                  <Line type="monotone" dataKey="count" stroke={status === 'danger' ? 'hsl(var(--destructive))' : status === 'warning' ? 'hsl(var(--accent))' : 'hsl(var(--primary))'} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {isAtLimit && (
            <p className="text-xs text-destructive mt-2">
              Limite quotidienne atteinte. Revenez demain ou passez Pro !
            </p>
          )}

          {!isAtLimit && percentage >= 80 && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <AlertTriangle className={`w-3 h-3 ${colorClass}`} /> Vous approchez de votre limite quotidienne.
            </p>
          )}

          {showUpgradePrompt && !isPro && (
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Débloquez des limites plus élevées avec Pro.</span>
              <Button size="sm" onClick={onUpgradeClick}>Passer Pro</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
