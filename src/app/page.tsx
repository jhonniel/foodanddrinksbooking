"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Bike, Gift, MapPin, Sparkles, Star, Truck } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { Reveal, Stagger, StaggerItem, fadeUp } from "@/components/motion";
import { useDataStore } from "@/stores/data";
import { formatCurrency } from "@/lib/utils/format";
import { formatPointsEarnRate } from "@/services/loyaltyService";

export default function LandingPage() {
  const reduce = useReducedMotion();
  const products = useDataStore((s) => s.products);
  const categoriesList = useDataStore((s) => s.categories);
  const rewardsList = useDataStore((s) => s.rewards);
  const featured = products.filter((p) => p.is_featured && p.is_available).slice(0, 4);
  const categories = categoriesList
    .filter((c) => c.is_active && c.slug !== "specials")
    .slice(0, 3);
  const REWARDS = rewardsList.filter((r) => r.is_active).slice(0, 4);

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 lg:px-6">
          <Logo size="md" href="/" />
          <nav className="hidden items-center gap-6 text-sm font-medium text-navy/70 md:flex">
            <a href="#menu" className="hover:text-navy">Menu</a>
            <a href="#how" className="hover:text-navy">How it works</a>
            <a href="#rewards" className="hover:text-navy">Rewards</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-navy hover:bg-muted sm:inline-flex"
            >
              Sign in
            </Link>
            <motion.div whileHover={reduce ? undefined : { scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/menu"
                className="inline-flex h-9 items-center rounded-lg bg-green px-4 text-sm font-medium text-white hover:bg-green/90"
              >
                Order Online
              </Link>
            </motion.div>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-light-blue via-surface to-white" />
        {!reduce && (
          <>
            <motion.div
              aria-hidden
              className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-sky/15 blur-3xl"
              animate={{ x: [0, 20, 0], y: [0, 12, 0] }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              aria-hidden
              className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-green/10 blur-3xl"
              animate={{ x: [0, -16, 0], y: [0, -10, 0] }}
              transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            />
          </>
        )}
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-2 lg:px-6 lg:py-24">
          <motion.div
            initial={reduce ? false : "hidden"}
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.08 } },
            }}
          >
            <motion.p
              variants={fadeUp}
              className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-green/10 px-3 py-1 text-xs font-semibold text-green"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Fresh · Cold · Delivered
            </motion.p>
            <motion.h1
              variants={fadeUp}
              className="text-3xl font-extrabold tracking-tight text-navy sm:text-5xl lg:text-6xl"
            >
              COOL DRINKS.
              <br />
              GOOD VIBES.
            </motion.h1>
            <motion.p
              variants={fadeUp}
              className="mt-4 max-w-md text-sm text-muted-foreground sm:text-base sm:text-lg"
            >
              Your favorite soda flavors, iced coffee, and matcha — ordered in taps,
              tracked live, rewarded every time.
            </motion.p>
            <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3">
              <motion.div whileHover={reduce ? undefined : { scale: 1.03, y: -1 }} whileTap={{ scale: 0.97 }}>
                <Link
                  href="/menu"
                  className="inline-flex h-12 items-center gap-2 rounded-lg bg-green px-8 text-base font-medium text-white shadow-lg shadow-green/20 hover:bg-green/90"
                >
                  Order Online
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
              <Link
                href="/menu"
                className="inline-flex h-12 items-center rounded-lg border border-navy/20 bg-white px-8 text-base font-medium text-navy hover:bg-muted"
              >
                View Menu
              </Link>
            </motion.div>
            <motion.div variants={fadeUp} className="mt-8 flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> 4.9 rating
              </span>
              <span className="flex items-center gap-1.5">
                <Truck className="h-4 w-4 text-sky" /> Fast delivery
              </span>
              <span className="flex items-center gap-1.5">
                <Gift className="h-4 w-4 text-green" /> Earn points
              </span>
            </motion.div>
          </motion.div>

          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto aspect-square w-full max-w-md lg:max-w-lg"
          >
            <motion.div
              className="absolute inset-4 rounded-[2rem] bg-gradient-to-br from-navy to-navy/80 shadow-soft"
              animate={reduce ? undefined : { rotate: [0, 1.5, 0] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="relative h-full overflow-hidden rounded-[2rem]">
              <motion.div
                className="absolute inset-0"
                animate={reduce ? undefined : { scale: [1, 1.04, 1] }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
              >
                <Image
                  src="https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=800&h=800&fit=crop"
                  alt="Refreshing Island Coolers beverage"
                  fill
                  priority
                  className="object-cover"
                  sizes="(max-width: 768px) 90vw, 40vw"
                />
              </motion.div>
              <div className="absolute inset-0 bg-gradient-to-t from-navy/40 to-transparent" />
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55, duration: 0.45 }}
                className="absolute bottom-6 left-6 right-6 rounded-2xl bg-white/95 p-4 shadow-soft backdrop-blur"
              >
                <p className="text-sm font-semibold text-navy">Berry Soda</p>
                <p className="text-xs text-muted-foreground">Bestseller · from ₱85</p>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-6xl px-4 py-16 lg:px-6">
        <Reveal className="mb-8 text-center">
          <h2 className="text-2xl font-bold text-navy sm:text-3xl">Our Categories</h2>
          <p className="mt-2 text-muted-foreground">Pick your vibe, we&apos;ll handle the chill.</p>
        </Reveal>
        <Stagger className="grid gap-4 sm:grid-cols-3">
          {categories.map((cat) => (
            <StaggerItem key={cat.id}>
              <Link
                href={`/menu?category=${cat.slug}`}
                className="group relative block aspect-[4/3] overflow-hidden rounded-2xl shadow-card"
              >
                {cat.image_url && (
                  <motion.div
                    className="absolute inset-0"
                    whileHover={reduce ? undefined : { scale: 1.06 }}
                    transition={{ duration: 0.45 }}
                  >
                    <Image
                      src={cat.image_url}
                      alt={cat.name}
                      fill
                      className="object-cover"
                      sizes="33vw"
                    />
                  </motion.div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-navy/70 to-transparent" />
                <div className="absolute bottom-4 left-4">
                  <h3 className="text-lg font-bold text-white">{cat.name}</h3>
                  <p className="text-sm text-white/80">{cat.description}</p>
                </div>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-4 lg:px-6">
          <Reveal className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold text-navy sm:text-3xl">Popular Drinks</h2>
              <p className="mt-1 text-muted-foreground">Crowd favorites, ready to order.</p>
            </div>
            <Link href="/menu" className="hidden text-sm font-semibold text-green sm:block">
              See all →
            </Link>
          </Reveal>
          <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {featured.map((p) => (
              <StaggerItem key={p.id}>
                <Link
                  href={`/menu/${p.slug}`}
                  className="block overflow-hidden rounded-2xl bg-surface shadow-card transition hover:shadow-soft"
                >
                  <div className="relative aspect-square overflow-hidden">
                    <motion.div
                      className="absolute inset-0"
                      whileHover={reduce ? undefined : { scale: 1.06 }}
                      transition={{ duration: 0.4 }}
                    >
                      <Image src={p.image_url!} alt={p.name} fill className="object-cover" sizes="25vw" />
                    </motion.div>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-navy">{p.name}</p>
                    <p className="text-sm font-bold text-green">{formatCurrency(p.base_price)}</p>
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl px-4 py-16 lg:px-6">
        <Reveal className="mb-10 text-center">
          <h2 className="text-2xl font-bold text-navy sm:text-3xl">How It Works</h2>
          <p className="mt-2 text-muted-foreground">Order online in four easy steps.</p>
        </Reveal>
        <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Sparkles, title: "Browse", desc: "Pick soda, coffee, or matcha." },
            { icon: Gift, title: "Customize", desc: "Size, ice, sweetness, add-ons." },
            { icon: MapPin, title: "Checkout", desc: "Delivery or pickup — your call." },
            { icon: Bike, title: "Track & Enjoy", desc: "Live updates until it arrives." },
          ].map(({ icon: Icon, title, desc }, i) => (
            <StaggerItem key={title}>
              <motion.div
                whileHover={reduce ? undefined : { y: -4 }}
                className="rounded-2xl bg-white p-6 text-center shadow-card"
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-light-blue text-sky">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-xs font-bold text-green">STEP {i + 1}</p>
                <h3 className="mt-1 font-semibold text-navy">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
              </motion.div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <section id="rewards" className="bg-navy py-16 text-white">
        <div className="mx-auto max-w-6xl px-4 lg:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <Reveal>
              <h2 className="text-2xl font-bold sm:text-3xl">Earn Points. Get Rewards.</h2>
              <p className="mt-3 text-white/70">
                {formatPointsEarnRate()}. Redeem for discounts and free drinks.
              </p>
              <Link
                href="/rewards"
                className="mt-6 inline-flex h-10 items-center rounded-lg bg-green px-5 text-sm font-medium text-white hover:bg-green/90"
              >
                View Rewards
              </Link>
            </Reveal>
            <Stagger className="grid grid-cols-2 gap-3">
              {REWARDS.map((r) => (
                <StaggerItem key={r.id}>
                  <motion.div
                    whileHover={reduce ? undefined : { scale: 1.03 }}
                    className="rounded-2xl bg-white/10 p-4 backdrop-blur"
                  >
                    <p className="text-lg font-bold">{r.name}</p>
                    <p className="text-sm text-white/60">{r.points_required} pts</p>
                  </motion.div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 lg:px-6">
        <Reveal>
          <h2 className="mb-8 text-center text-2xl font-bold text-navy sm:text-3xl">
            Loved by the island
          </h2>
        </Reveal>
        <Stagger className="grid gap-4 md:grid-cols-3">
          {[
            { name: "Aya M.", quote: "Best matcha latte in Cebu. Ordering is so smooth." },
            { name: "Carlo R.", quote: "Berry Soda hit different. Points make me come back." },
            { name: "Jen L.", quote: "Tracked my delivery live — arrived ice cold." },
          ].map((t) => (
            <StaggerItem key={t.name}>
              <blockquote className="rounded-2xl bg-white p-6 shadow-card">
                <div className="mb-3 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-navy/80">&ldquo;{t.quote}&rdquo;</p>
                <footer className="mt-3 text-xs font-semibold text-muted-foreground">{t.name}</footer>
              </blockquote>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 lg:px-6">
        <Reveal>
          <motion.div
            whileHover={reduce ? undefined : { scale: 1.01 }}
            className="rounded-3xl bg-gradient-to-r from-green to-fresh px-8 py-12 text-center text-white shadow-soft"
          >
            <h2 className="text-2xl font-bold sm:text-3xl">Ready for something cool?</h2>
            <p className="mt-2 text-white/85">Order now and earn points on every drink.</p>
            <Link
              href="/menu"
              className="mt-6 inline-flex h-12 items-center rounded-lg bg-white px-8 text-base font-medium text-green hover:bg-white/90"
            >
              Order Online
            </Link>
          </motion.div>
        </Reveal>
      </section>

      <footer className="border-t bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between lg:px-6">
          <Logo size="sm" />
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Island Coolers</p>
        </div>
      </footer>
    </div>
  );
}
