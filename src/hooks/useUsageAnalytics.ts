import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type Trend = "up" | "down" | "stable";

export interface UsageHistoryPoint {
  date: string; // YYYY-MM-DD
  count: number;
}

interface UseUsageAnalyticsOptions {
  enableHistory?: boolean;
  enablePrediction?: boolean;
}

interface UsageAnalyticsResult {
  history: UsageHistoryPoint[];
  averageDaily: number;
  trend: Trend;
  hourlyRate: number; // items/hour since midnight
  peakUsageHour: number | null; // 0-23
  predictedEndOfDay: number | null;
  loading: boolean;
  error?: string;
}

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export const useUsageAnalytics = (
  { enableHistory = true, enablePrediction = true }: UseUsageAnalyticsOptions = {}
): UsageAnalyticsResult => {
  const { user } = useAuth();
  const [history, setHistory] = useState<UsageHistoryPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    const fetchHistory = async () => {
      if (!user || !enableHistory) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(undefined);
      try {
        const todayStart = startOfDay();
        const sevenDaysAgo = new Date(todayStart);
        sevenDaysAgo.setDate(todayStart.getDate() - 6);

        const { data, error } = await supabase
          .from("memories")
          .select("created_at")
          .eq("user_id", user.id)
          .gte("created_at", sevenDaysAgo.toISOString());

        if (error) throw error;

        const buckets = new Map<string, number>();
        // Initialize all 7 days with 0
        for (let i = 0; i < 7; i++) {
          const d = new Date(sevenDaysAgo);
          d.setDate(sevenDaysAgo.getDate() + i);
          buckets.set(formatDate(d), 0);
        }

        const today = formatDate(todayStart);
        let hourHistogram: Record<number, number> = {};

        (data || []).forEach((row: { created_at: string }) => {
          const d = new Date(row.created_at);
          const key = formatDate(d);
          buckets.set(key, (buckets.get(key) || 0) + 1);
          if (key === today) {
            const h = d.getHours();
            hourHistogram[h] = (hourHistogram[h] || 0) + 1;
          }
        });

        const result: UsageHistoryPoint[] = Array.from(buckets.entries())
          .sort((a, b) => (a[0] < b[0] ? -1 : 1))
          .map(([date, count]) => ({ date, count }));

        if (mounted) setHistory(result);
      } catch (e: any) {
        if (mounted) setError(e?.message || "Erreur inconnue");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchHistory();
    return () => {
      mounted = false;
    };
  }, [user, enableHistory]);

  const { averageDaily, trend, hourlyRate, peakUsageHour, predictedEndOfDay } = useMemo(() => {
    if (!history.length) {
      return {
        averageDaily: 0,
        trend: "stable" as Trend,
        hourlyRate: 0,
        peakUsageHour: null,
        predictedEndOfDay: null,
      };
    }

    const counts = history.map((h) => h.count);
    const averageDaily = counts.reduce((a, b) => a + b, 0) / counts.length;

    // Simple trend: compare last 3 days vs previous 3 days
    const last3 = counts.slice(-3);
    const prev3 = counts.slice(-6, -3);
    const lastAvg = last3.length ? last3.reduce((a, b) => a + b, 0) / last3.length : 0;
    const prevAvg = prev3.length ? prev3.reduce((a, b) => a + b, 0) / prev3.length : 0;
    const diff = lastAvg - prevAvg;
    const percent = prevAvg > 0 ? diff / prevAvg : 0;
    let trend: Trend = "stable";
    if (percent > 0.1) trend = "up";
    else if (percent < -0.1) trend = "down";

    // Hourly rate & peak hour estimated from today's data portion in history is not available here directly
    // We estimate hourly rate based on today's count and time since midnight
    const todayStr = formatDate(startOfDay());
    const todayCount = history.find((h) => h.date === todayStr)?.count || 0;
    const msSinceMidnight = Date.now() - startOfDay().getTime();
    const hoursElapsed = Math.max(msSinceMidnight / 3600000, 0.25);
    const hourlyRate = todayCount / hoursElapsed;

    // Peak hour not computed from DB here, leave null (can be extended to fetch per-hour when needed)
    const peakUsageHour: number | null = null;

    // Linear prediction to end of day
    const remainingHours = Math.max(24 - hoursElapsed, 0);
    const basicPrediction = todayCount + hourlyRate * remainingHours;
    const predictedEndOfDay = enablePrediction ? Math.round(basicPrediction) : null;

    return { averageDaily, trend, hourlyRate, peakUsageHour, predictedEndOfDay };
  }, [history, enablePrediction]);

  return {
    history,
    averageDaily,
    trend,
    hourlyRate,
    peakUsageHour,
    predictedEndOfDay,
    loading,
    error,
  };
};

export default useUsageAnalytics;
