"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { History, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageTransition, Stagger, StaggerItem } from "@/components/motion";
import { getRewards, getNextRewardProgress, canRedeem } from "@/services/loyaltyService";
import { useAuthStore } from "@/stores/auth";
import { useDataStore } from "@/stores/data";
import { formatCurrency, formatPoints } from "@/lib/utils/format";
import type { Reward } from "@/types";

export default function RewardsPage() {
  const reduce = useReducedMotion();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const storeRewards = useDataStore((s) => s.rewards);

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);

  const points = user?.points_balance ?? 0;

  useEffect(() => {
    getRewards().then((r) => {
      setRewards(r);
      setLoading(false);
    });
  }, [storeRewards]);

  const progress = getNextRewardProgress(points, rewards);

  const handleRedeem = (reward: Reward) => {
    const check = canRedeem(points, reward);
    if (!check.ok) {
      toast.error(check.reason);
      return;
    }
    updateUser({ points_balance: points - reward.points_required });
    toast.success(`Redeemed ${reward.name}! Use it on your next order.`);
  };

  return (
    <PageTransition className="mx-auto max-w-lg space-y-6 pb-4">
      <div>
        <h1 className="text-2xl font-bold text-navy">Rewards</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Redeem exclusive perks. Your points balance is on{" "}
          <Link href="/profile" className="font-semibold text-green hover:underline">
            Profile
          </Link>
          .
        </p>
      </div>

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
              : `${formatPoints(progress.next - points)} more points to unlock ${progress.reward.name}`}
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
        ) : (
          <Stagger className="space-y-3">
            {rewards.map((reward) => {
              const ok = canRedeem(points, reward).ok;
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
        <div className="space-y-2 rounded-2xl bg-white p-4 shadow-card">
          <p className="py-6 text-center text-sm text-muted-foreground">
            Points activity from your orders will show up here.
          </p>
        </div>
      </div>
    </PageTransition>
  );
}
