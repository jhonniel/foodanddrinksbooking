"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { History, Sparkles, Ticket, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { PageTransition, Stagger, StaggerItem } from "@/components/motion";
import {
  getRewards,
  getNextRewardProgress,
  canRedeem,
} from "@/services/loyaltyService";
import { validatePromoCode } from "@/services/productService";
import { useAuthStore } from "@/stores/auth";
import { useDataStore } from "@/stores/data";
import { useCartStore } from "@/stores/cart";
import { isClaimRedemption } from "@/lib/vouchers/redemptionMode";
import {
  formatCurrency,
  formatDate,
  formatPoints,
  relativeTime,
} from "@/lib/utils/format";
import { PointsMembershipCard } from "@/components/customer/PointsMembershipCard";
import { cn } from "@/lib/utils";
import type {
  PointsTransaction,
  Promotion,
  Reward,
  VoucherClaim,
} from "@/types";

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

function discountLabel(v: Promotion) {
  if (v.type === "PERCENTAGE") return `${v.discount_value}% off`;
  return `${formatCurrency(v.discount_value)} off`;
}

export default function RewardsPage() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const storeRewards = useDataStore((s) => s.rewards);
  const setPromo = useCartStore((s) => s.setPromo);
  const subtotal = useCartStore((s) => s.subtotal());

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [pointsLoading, setPointsLoading] = useState(true);
  const [pointsBalance, setPointsBalance] = useState(
    user?.points_balance ?? 0
  );
  const [ledger, setLedger] = useState<PointsTransaction[]>([]);
  const [availableVouchers, setAvailableVouchers] = useState<Promotion[]>([]);
  const [claimedVouchers, setClaimedVouchers] = useState<VoucherClaim[]>([]);
  const [vouchersLoading, setVouchersLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [applyingCode, setApplyingCode] = useState(false);

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

  const refreshVouchers = useCallback(async () => {
    if (!user?.id) {
      setVouchersLoading(false);
      setAvailableVouchers([]);
      setClaimedVouchers([]);
      return;
    }
    setVouchersLoading(true);
    try {
      const res = await fetch("/api/me/vouchers", {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as {
        available?: Promotion[];
        claimed?: VoucherClaim[];
      } | null;
      if (res.ok) {
        setAvailableVouchers(data?.available ?? []);
        setClaimedVouchers(data?.claimed ?? []);
      }
    } catch {
      setAvailableVouchers([]);
      setClaimedVouchers([]);
    } finally {
      setVouchersLoading(false);
    }
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

  useEffect(() => {
    void refreshVouchers();
  }, [refreshVouchers]);

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

  const handleClaim = async (voucher: Promotion) => {
    setClaimingId(voucher.id);
    try {
      const res = await fetch("/api/me/vouchers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promotionId: voucher.id }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        voucher?: Promotion;
      } | null;
      if (!res.ok) {
        toast.error(data?.error || "Could not claim voucher.");
        return;
      }
      toast.success(`Claimed ${data?.voucher?.promo_code ?? voucher.promo_code}!`);
      await refreshVouchers();
    } catch {
      toast.error("Could not claim voucher.");
    } finally {
      setClaimingId(null);
    }
  };

  const useVoucher = async (promo: Promotion) => {
    const code = promo.promo_code;
    if (!code) return;
    const normalized = code.toUpperCase();
    const result = await validatePromoCode(normalized, subtotal);
    if (result.valid) {
      setPromo(normalized, result.discount);
      toast.success(`${normalized} is active — pick items from the menu.`);
    } else if (result.error?.includes("Minimum order")) {
      setPromo(normalized, 0);
      toast.success(`${normalized} selected — add items to apply the discount.`);
    } else {
      toast.error(result.error ?? "Could not use voucher.");
      return;
    }
    router.push("/menu");
  };

  const handleApplyManualCode = async () => {
    const code = manualCode.trim().toUpperCase();
    if (!code) return;
    setApplyingCode(true);
    try {
      const res = await fetch("/api/me/vouchers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        voucher?: Promotion;
      } | null;
      if (!res.ok) {
        toast.error(data?.error || "Could not redeem voucher.");
        return;
      }
      setManualCode("");
      toast.success(
        `${data?.voucher?.name ?? "Voucher"} saved! Tap Use when you order.`
      );
      await refreshVouchers();
    } catch {
      toast.error("Could not redeem voucher.");
    } finally {
      setApplyingCode(false);
    }
  };

  const claimableOnly = availableVouchers.filter(isClaimRedemption);
  const myVouchers = claimedVouchers.filter((c) => c.promotion);

  return (
    <PageTransition className="mx-auto max-w-lg space-y-6 pb-4">
      <div>
        <h1 className="text-2xl font-bold text-navy">Rewards</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Claim vouchers or redeem a code — saved vouchers appear below for use at checkout.
        </p>
      </div>

      <PointsMembershipCard
        points={pointsBalance}
        memberName={user?.full_name}
        loading={pointsLoading}
        ready={!pointsLoading && !loading}
      />

      <div>
        <div className="mb-3 flex items-center gap-2">
          <Ticket className="h-4 w-4 text-sky" />
          <h2 className="text-lg font-bold text-navy">Vouchers</h2>
        </div>

        <div className="mb-3 rounded-2xl bg-white p-4 shadow-card">
          <p className="mb-2 text-sm font-semibold text-navy">Redeem a code</p>
          <div className="flex gap-2">
            <Input
              placeholder="Enter promo code"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter" && manualCode.trim() && !applyingCode) {
                  void handleApplyManualCode();
                }
              }}
              className="h-11 rounded-xl font-mono uppercase"
            />
            <Button
              onClick={() => void handleApplyManualCode()}
              disabled={applyingCode || !manualCode.trim()}
              className="h-11 shrink-0 rounded-xl bg-green hover:bg-green/90"
            >
              {applyingCode ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Redeem"
              )}
            </Button>
          </div>
        </div>

        {vouchersLoading ? (
          <div className="flex justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {claimableOnly.length === 0 && myVouchers.length === 0 ? (
              <div className="rounded-2xl bg-white px-4 py-8 text-center shadow-card">
                <p className="text-sm text-muted-foreground">
                  No vouchers available to claim right now.
                </p>
              </div>
            ) : null}

            {claimableOnly.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-card"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-navy">{v.name}</p>
                  {v.description ? (
                    <p className="text-sm text-muted-foreground">{v.description}</p>
                  ) : null}
                  <p className="mt-1 text-xs font-medium text-green">
                    {discountLabel(v)}
                    {v.min_order_amount > 0
                      ? ` · min ${formatCurrency(v.min_order_amount)}`
                      : ""}
                    {v.ends_at
                      ? ` · expires ${formatDate(v.ends_at)}`
                      : " · never expires"}
                  </p>
                </div>
                <Button
                  disabled={claimingId === v.id}
                  onClick={() => void handleClaim(v)}
                  className="shrink-0 bg-green hover:bg-green/90"
                >
                  {claimingId === v.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Claim"
                  )}
                </Button>
              </div>
            ))}

            {myVouchers.map((c) => {
              const v = c.promotion;
              if (!v) return null;
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-green/20 bg-green/5 p-4"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-navy">{v.name}</p>
                    <p className="mt-0.5 font-mono text-sm font-bold text-green">
                      {v.promo_code}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Saved to your vouchers
                      {v.ends_at
                        ? ` · expires ${formatDate(v.ends_at)}`
                        : " · never expires"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 rounded-xl border-green text-green hover:bg-green/5"
                    onClick={() => void useVoucher(v)}
                  >
                    Use
                  </Button>
                </div>
              );
            })}
          </div>
        )}
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
