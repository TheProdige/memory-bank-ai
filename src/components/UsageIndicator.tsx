import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Crown, Zap } from "lucide-react";
import { useUsageLimits } from "@/hooks/useUsageLimits";

interface UsageIndicatorProps {
  variant?: 'compact' | 'full';
}

export const UsageIndicator = ({ variant = 'compact' }: UsageIndicatorProps) => {
  const { dailyUsed, dailyLimit, subscriptionTier, loading } = useUsageLimits();

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-muted rounded w-20"></div>
      </div>
    );
  }

  const percentage = (dailyUsed / dailyLimit) * 100;
  const isNearLimit = percentage >= 80;
  const isAtLimit = dailyUsed >= dailyLimit;

  if (variant === 'compact') {
    return (
      <div className="flex items-center space-x-2">
        <Badge 
          variant={subscriptionTier === 'pro' ? 'default' : 'secondary'}
          className={subscriptionTier === 'pro' ? 'bg-accent text-accent-foreground' : ''}
        >
          {subscriptionTier === 'pro' ? (
            <>
              <Crown className="w-3 h-3 mr-1" />
              PRO
            </>
          ) : (
            <>
              <Zap className="w-3 h-3 mr-1" />
              FREE
            </>
          )}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {dailyUsed}/{dailyLimit} aujourd'hui
        </span>
      </div>
    );
  }

  return (
    <Card className="shadow-elegant">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Badge 
              variant={subscriptionTier === 'pro' ? 'default' : 'secondary'}
              className={subscriptionTier === 'pro' ? 'bg-accent text-accent-foreground' : ''}
            >
              {subscriptionTier === 'pro' ? (
                <>
                  <Crown className="w-3 h-3 mr-1" />
                  PRO
                </>
              ) : (
                <>
                  <Zap className="w-3 h-3 mr-1" />
                  GRATUIT
                </>
              )}
            </Badge>
            <span className="text-sm font-medium">
              Usage quotidien
            </span>
          </div>
          <span className="text-sm text-muted-foreground">
            {dailyUsed}/{dailyLimit}
          </span>
        </div>
        
        <Progress 
          value={percentage} 
          className={`h-2 ${isNearLimit ? 'text-destructive' : ''}`}
        />
        
        {isAtLimit && (
          <p className="text-xs text-destructive mt-2">
            Limite quotidienne atteinte. Revenez demain ou passez Pro !
          </p>
        )}
        
        {isNearLimit && !isAtLimit && (
          <p className="text-xs text-orange-500 mt-2">
            Attention, vous approchez de votre limite quotidienne.
          </p>
        )}
      </CardContent>
    </Card>
  );
};