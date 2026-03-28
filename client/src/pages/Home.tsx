import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { ArrowRight, Shield, Zap, Globe, Lock, TrendingUp, Send } from "lucide-react";
import { getLoginUrl } from "@/const";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate("/dashboard");
    }
  }, [loading, isAuthenticated, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
              <span className="font-bold text-accent-foreground">Ⓕ</span>
            </div>
            <span className="text-xl font-bold text-foreground">FluxaX</span>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <a href={getLoginUrl()}>Sign In</a>
            </Button>
            <Button asChild>
              <a href={getLoginUrl()}>Get Started</a>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container py-20 md:py-32">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
            The Fastest & Most Private Way to Move Between Crypto and Cash
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Instant crypto ↔ NGN conversion. Multi-chain swaps. Maximum privacy. Built for Nigeria.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild className="gap-2">
              <a href={getLoginUrl()}>
                Start Trading
                <ArrowRight className="w-5 h-5" />
              </a>
            </Button>
            <Button size="lg" variant="outline">
              Learn More
            </Button>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-16 pt-16 border-t border-border">
          <div className="text-center">
            <Shield className="w-8 h-8 text-accent mx-auto mb-3" />
            <h3 className="font-semibold text-foreground mb-1">Privacy First</h3>
            <p className="text-sm text-muted-foreground">Your transactions are private by default</p>
          </div>
          <div className="text-center">
            <Zap className="w-8 h-8 text-accent mx-auto mb-3" />
            <h3 className="font-semibold text-foreground mb-1">Instant Settlement</h3>
            <p className="text-sm text-muted-foreground">Crypto credited instantly to your wallet</p>
          </div>
          <div className="text-center">
            <Lock className="w-8 h-8 text-accent mx-auto mb-3" />
            <h3 className="font-semibold text-foreground mb-1">Secure & Trusted</h3>
            <p className="text-sm text-muted-foreground">Enterprise-grade security for your assets</p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-card border-y border-border">
        <div className="container py-20">
          <h2 className="text-3xl font-bold text-foreground mb-12 text-center">
            Everything You Need for Crypto Trading
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Feature 1 */}
            <div className="space-y-3">
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                <Globe className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Multi-Chain Support</h3>
              <p className="text-muted-foreground">
                Trade across Solana, Base, BSC, TON, and Avalanche with a single interface.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="space-y-3">
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Instant Swaps</h3>
              <p className="text-muted-foreground">
                Swap tokens across chains in one action with real-time exchange rates.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="space-y-3">
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                <Send className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">NGN On-Ramp/Off-Ramp</h3>
              <p className="text-muted-foreground">
                Convert between crypto and Nigerian Naira instantly with bank transfers.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="space-y-3">
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                <Lock className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Private Transactions</h3>
              <p className="text-muted-foreground">
                All transactions are private by default. Only you can see your history.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container py-20">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join thousands of Nigerians trading crypto with confidence and privacy.
          </p>
          <Button size="lg" asChild className="gap-2">
            <a href={getLoginUrl()}>
              Create Your Account
              <ArrowRight className="w-5 h-5" />
            </a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="container py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
                  <span className="font-bold text-accent-foreground text-sm">Ⓕ</span>
                </div>
                <span className="font-bold text-foreground">FluxaX</span>
              </div>
              <p className="text-sm text-muted-foreground">
                The fastest and most private way to move between crypto and cash.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-accent transition">Features</a></li>
                <li><a href="#" className="hover:text-accent transition">Pricing</a></li>
                <li><a href="#" className="hover:text-accent transition">Security</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-accent transition">About</a></li>
                <li><a href="#" className="hover:text-accent transition">Blog</a></li>
                <li><a href="#" className="hover:text-accent transition">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-accent transition">Privacy</a></li>
                <li><a href="#" className="hover:text-accent transition">Terms</a></li>
                <li><a href="#" className="hover:text-accent transition">Compliance</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2026 FluxaX. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
