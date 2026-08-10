"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { History, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageTransition, Stagger, StaggerItem } from "@/components/motion";
import {
  getRewards,
  getNextRewardProgress,
  canRedeem,
} from "@/services/loyaltyService";
import { useAuthStore } from "@/stores/auth";
import { useDataStore } from "@/stores/data";
import {
  formatCurrency,
  formatPoints,
  relativeTime,
} from "@/lib/utils/format";
import { PointsMembershipCard } from "@/components/customer/PointsMembershipCard";
import { cn } from "@/lib/utils";
import type { PointsTransaction, Reward } from "@/types";

type PointsPayload = {
  pointsBalance: number;
  lifetimePoints: number;
  pointsLedger: PointsTransaction[];
  summary: {
    earnedFromOrders: number;
    redeemedTotal: number;
    deliveredOrders: number;
  };
};

export default function RewardsPage() {
  const reduce = useReducedMotion();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const storeRewards = useDataStore((s) => s.rewards);

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [pointsLoading, setPointsLoading] = useState(true);
  const [pointsBalance, setPointsBalance] = useState(
    user?.points_balance ?? 0
  );
  const [ledger, setLedger] = useState<PointsTransaction[]>([]);

  const refreshPoints = useCallback(async () => {
    if (!user?.id) {
      setPointsLoading(false);
      return;
    }
    setPointsLoading(true);
    try {
      const res = await fetch("/api/me/points", {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as
        | PointsPayload
        | { error?: string }
        | null;
      if (!res.ok || !data || !("pointsBalance" in data)) {
        setPointsBalance(user.points_balance ?? 0);
        return;
      }
      setPointsBalance(data.pointsBalance);
      setLedger(data.pointsLedger ?? []);
      updateUser({
        points_balance: data.pointsBalance,
        lifetime_points: data.lifetimePoints,
      });
    } catch {
      setPointsBalance(user.points_balance ?? 0);
    } finally {
      setPointsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh on auth id only
  }, [user?.id]);

  useEffect(() => {
    getRewards().then((r) => {
      setRewards(r);
      setLoading(false);
    });
  }, [storeRewards]);

  useEffect(() => {
    void refreshPoints();
  }, [refreshPoints]);

  const progress = getNextRewardProgress(pointsBalance, rewards);

  const handleRedeem = (reward: Reward) => {
    const check = canRedeem(pointsBalance, reward);
    if (!check.ok) {
      toast.error(check.reason);
      return;
    }
    const next = pointsBalance - reward.points_required;
    setPointsBalance(next);
    updateUser({ points_balance: next });
    toast.success(`Redeemed ${reward.name}! Use it on your next order.`);
  };

  return (
    <PageTransition className="mx-auto max-w-lg space-y-6 pb-4">
      <div>
        <h1 className="text-2xl font-bold text-navy">Rewards</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Earn points from completed orders and redeem exclusive perks.
        </p>
      </div>

      <PointsMembershipCard
        points={pointsBalance}
        memberName={user?.full_name}
        loading={pointsLoading}
        ready={!pointsLoading && !loading}
      />

      {progress.reward && (
        <div className="rounded-2xl bg-white p-4 shadow-card">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-sky" />
              <p className="text-sm font-semibold text-navy">Next Reward</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatPoints(progress.next)} pts
            </p>
          </div>
          <Progress value={progress.percent} className="h-2" />
          <p className="mt-2 text-sm text-muted-foreground">
            {progress.percent >= 100
              ? "You can redeem this reward!"
              : `${formatPoints(progress.next - pointsBalance)} more points to unlock ${progress.reward.name}`}
          </p>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-bold text-navy">Redeem Rewards</h2>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : rewards.length === 0 ? (
          <div className="rounded-2xl bg-white px-4 py-10 text-center shadow-card">
            <p className="text-sm text-muted-foreground">
              No rewards available right now.
            </p>
          </div>
        ) : (
          <Stagger className="space-y-3">
            {rewards.map((reward) => {
              const ok = canRedeem(pointsBalance, reward).ok;
              return (
                <StaggerItem key={reward.id}>
                  <motion.div
                    whileHover={reduce ? undefined : { y: -2 }}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-card"
                  >
                    <div>
                      <p className="font-semibold text-navy">{reward.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {reward.description}
                      </p>
                      <p className="mt-1 text-xs font-medium text-sky">
                        {formatPoints(reward.points_required)} pts
                        {reward.discount_value
                          ? ` · ${formatCurrency(reward.discount_value)} value`
                          : ""}
                      </p>
                    </div>
                    <motion.div whileTap={{ scale: 0.95 }}>
                      <Button
                        disabled={!ok}
                        onClick={() => handleRedeem(reward)}
                        className="bg-green hover:bg-green/90 disabled:opacity-40"
                      >
                        Redeem
                      </Button>
                    </motion.div>
                  </motion.div>
                </StaggerItem>
              );
            })}
          </Stagger>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-bold text-navy">Points History</h2>
        </div>
        {pointsLoading ? (
          <div className="space-y-2 rounded-2xl bg-white p-4 shadow-card">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : ledger.length === 0 ? (
          <div className="rounded-2xl bg-white px-4 py-10 text-center shadow-card">
            <p className="text-sm text-muted-foreground">
              Points from completed orders will show up here.
            </p>
          </div>
        ) : (
          <Stagger className="space-y-2" fast>
            {ledger.map((tx) => (
              <StaggerItem key={tx.id}>
                <div className="flex items-start justify-between gap-3 rounded-2xl bg-white p-3.5 shadow-card">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-navy">
                      {tx.description || tx.type}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {tx.type === "EARNED"
                        ? "Completed order"
                        : tx.type.toLowerCase()}{" "}
                      · {relativeTime(tx.created_at)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-bold tabular-nums",
                      tx.points >= 0 ? "text-green" : "text-red-600"
                    )}
                  >
                    {tx.points >= 0 ? "+" : ""}
                    {formatPoints(tx.points)}
                  </span>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </div>
    </PageTransition>
  );
}
