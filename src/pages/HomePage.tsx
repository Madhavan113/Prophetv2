
import React from 'react';
import { Link } from 'react-router-dom';
import { Music, TrendingUp, Headphones, Volume2, Database } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const HomePage = () => {
  return (
    <div className="space-y-12 py-8 animate-fadeIn">
      {/* Hero Section */}
      <section className="text-center space-y-6">
        <div className="space-y-4">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tighter">
            <span className="block">The Music Industry</span>
            <span className="block">Needs <span className="text-white underline decoration-white/20">Prophets</span></span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground font-mono max-w-3xl mx-auto">
            Advanced frameworks for predicting tomorrow's music icons.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-4 justify-center">
          <Button asChild size="lg" className="font-mono">
            <Link to="/markets">Explore Markets</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="font-mono">
            <Link to="/leaderboard">View Predictions</Link>
          </Button>
        </div>
      </section>
      
      {/* Ticker */}
      <div className="w-full bg-card/40 border-y border-white/10 py-4 overflow-hidden">
        <div className="ticker-container">
          <div className="ticker-content flex items-center gap-8 font-mono text-sm">
            {Array(10).fill(null).map((_, i) => (
              <React.Fragment key={i}>
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-market-green" />
                  <span>DRAKE +12.4%</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-market-red rotate-180" />
                  <span>LIL NAS X -8.2%</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-market-green" />
                  <span>TAYLOR +21.5%</span>
                </div>
                <div className="flex items-center gap-2">
                  <Music size={16} />
                  <span>NEW: SZA FUTURES</span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
      
      {/* Features Grid */}
      <section>
        <h2 className="text-3xl font-bold mb-8 font-mono">Advanced Frameworks</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="glass-card hover-scale border-white/5">
            <CardContent className="p-6 space-y-4">
              <Headphones size={32} className="mb-2" />
              <h3 className="text-xl font-bold">Sonic Analysis</h3>
              <p className="text-muted-foreground">
                Proprietary algorithms decode streaming patterns to identify rising talents before mainstream recognition.
              </p>
            </CardContent>
          </Card>
          
          <Card className="glass-card hover-scale border-white/5">
            <CardContent className="p-6 space-y-4">
              <Database size={32} className="mb-2" />
              <h3 className="text-xl font-bold">Data Foundation</h3>
              <p className="text-muted-foreground">
                Real-time integration of social metrics, streaming data, and tour analytics for comprehensive market analysis.
              </p>
            </CardContent>
          </Card>
          
          <Card className="glass-card hover-scale border-white/5">
            <CardContent className="p-6 space-y-4">
              <TrendingUp size={32} className="mb-2" />
              <h3 className="text-xl font-bold">Trend Prophecy</h3>
              <p className="text-muted-foreground">
                Predictive modeling identifies market inefficiencies in artist valuation before the industry catches on.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
      
      {/* Quote Section */}
      <section className="py-12 relative">
        <div className="absolute inset-0 opacity-10">
          <div className="shimmer absolute inset-0"></div>
        </div>
        <blockquote className="relative z-10 text-2xl md:text-4xl font-medium italic text-center max-w-4xl mx-auto font-mono">
          "Our predictive frameworks transform music industry forecasting from speculation to science."
          <footer className="mt-4 text-lg not-italic">
            — Madhavan, <span className="text-white/70">Founder</span>
          </footer>
        </blockquote>
      </section>
      
      {/* CTA Section */}
      <section className="text-center space-y-6 py-12 border-t border-white/10">
        <h2 className="text-3xl font-bold">Become a Prophet</h2>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Join the vanguard of music industry forecasters using sophisticated frameworks to predict tomorrow's icons.
        </p>
        <Button size="lg" className="font-mono">Connect Your Wallet</Button>
      </section>
    </div>
  );
};

export default HomePage;
