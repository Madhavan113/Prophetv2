
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, ChevronUp, ChevronDown, PieChart } from 'lucide-react';
import { ChartContainer, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// Mock data for leaderboard
const artistData = [
  { id: 1, name: "KAWS", price: 1458.92, change: 12.5, volume: 92500 },
  { id: 2, name: "Banksy", price: 2893.41, change: -3.2, volume: 143200 },
  { id: 3, name: "Yayoi Kusama", price: 1782.35, change: 8.7, volume: 87600 },
  { id: 4, name: "Takashi Murakami", price: 934.28, change: 5.1, volume: 65800 },
  { id: 5, name: "Damien Hirst", price: 1243.87, change: -1.8, volume: 72400 },
  { id: 6, name: "Jeff Koons", price: 3214.59, change: 0.9, volume: 118900 },
  { id: 7, name: "Jean-Michel Basquiat", price: 4582.16, change: 7.3, volume: 165400 },
  { id: 8, name: "Ai Weiwei", price: 876.34, change: -4.5, volume: 58700 },
  { id: 9, name: "Marina Abramović", price: 723.91, change: 15.2, volume: 47800 },
  { id: 10, name: "Olafur Eliasson", price: 1156.72, change: -2.7, volume: 63900 },
];

// Trending artists for ticker
const trendingArtists = [
  "KAWS +12.5%",
  "Marina Abramović +15.2%",
  "Yayoi Kusama +8.7%",
  "Jean-Michel Basquiat +7.3%",
  "Takashi Murakami +5.1%",
];

// Volume data for chart
const volumeData = artistData
  .sort((a, b) => b.volume - a.volume)
  .slice(0, 5)
  .map(artist => ({
    name: artist.name,
    volume: artist.volume / 1000,
  }));

const chartConfig = {
  white: {
    color: "#FFFFFF"
  },
  gray: {
    color: "#888888"
  }
};

const LeaderboardPage: React.FC = () => {
  const [sortBy, setSortBy] = useState<'price' | 'change' | 'volume'>('change');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [visibleItems, setVisibleItems] = useState<number[]>([]);

  useEffect(() => {
    // Staggered animation for table rows
    const timer = setTimeout(() => {
      const ids = artistData.map(artist => artist.id);
      setVisibleItems(ids);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const sortedArtists = [...artistData].sort((a, b) => {
    if (sortOrder === 'asc') {
      return a[sortBy] - b[sortBy];
    } else {
      return b[sortBy] - a[sortBy];
    }
  });

  const handleSort = (key: 'price' | 'change' | 'volume') => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('desc');
    }
  };

  return (
    <div className="space-y-6">
      <div className="overflow-hidden bg-card rounded-lg py-2 mb-6 ticker-container border border-white/10">
        <div className="ticker-content whitespace-nowrap inline-block">
          {[...trendingArtists, ...trendingArtists, ...trendingArtists].map((artist, index) => (
            <span key={index} className="mx-6 text-primary font-medium">
              {artist}
            </span>
          ))}
        </div>
      </div>
      
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <Card className="glass-card hover-scale shadow-lg animate-fadeIn border border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp size={20} className="text-white" /> Top Performer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">Marina Abramović</h3>
                <p className="text-muted-foreground">$723.91</p>
              </div>
              <div className="text-white flex items-center font-semibold">
                <TrendingUp className="mr-1" size={20} />
                <span className="animate-pulse-slow">+15.2%</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card hover-scale shadow-lg animate-fadeIn border border-white/10" style={{ animationDelay: "150ms" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChart size={20} className="text-white" /> Highest Volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">Jean-Michel Basquiat</h3>
                <p className="text-muted-foreground">$4,582.16</p>
              </div>
              <div className="text-white flex items-center font-semibold">
                <span className="shimmer px-2 py-1 rounded">165.4K</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card hover-scale shadow-lg animate-fadeIn md:col-span-2 lg:col-span-1 border border-white/10" style={{ animationDelay: "300ms" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Market Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Market Cap</span>
                <span className="font-mono">$189.7M</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">24h Volume</span>
                <span className="font-mono">$12.5M</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active Artists</span>
                <span className="font-mono">512</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <ChartContainer 
        className="glass-card border border-white/10 p-4 rounded-lg mt-6 shadow-lg animate-fadeIn" 
        config={chartConfig}
        style={{ animationDelay: "450ms", height: "250px" }}
      >
        <BarChart data={volumeData}>
          <XAxis dataKey="name" stroke="#FFFFFF" />
          <YAxis stroke="#FFFFFF" />
          <Tooltip 
            contentStyle={{ 
              background: 'rgba(0, 0, 0, 0.8)', 
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '4px',
              color: 'white'
            }} 
          />
          <Bar dataKey="volume" fill="#FFFFFF" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartContainer>

      <Card className="glass-card shadow-2xl animate-fadeIn border border-white/10" style={{ animationDelay: "600ms" }}>
        <CardHeader>
          <CardTitle className="text-xl">Artist Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4">#</th>
                  <th className="text-left py-3 px-4">Artist</th>
                  <th 
                    className="text-right py-3 px-4 cursor-pointer hover:text-primary" 
                    onClick={() => handleSort('price')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Price
                      {sortBy === 'price' && (
                        sortOrder === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                      )}
                    </div>
                  </th>
                  <th 
                    className="text-right py-3 px-4 cursor-pointer hover:text-primary" 
                    onClick={() => handleSort('change')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      24h Change
                      {sortBy === 'change' && (
                        sortOrder === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                      )}
                    </div>
                  </th>
                  <th 
                    className="text-right py-3 px-4 cursor-pointer hover:text-primary" 
                    onClick={() => handleSort('volume')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Volume
                      {sortBy === 'volume' && (
                        sortOrder === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedArtists.map((artist, index) => (
                  <tr 
                    key={artist.id} 
                    className={`border-b border-white/5 hover:bg-white/5 transition-all ${visibleItems.includes(artist.id) ? 'opacity-100' : 'opacity-0'}`}
                    style={{ 
                      transition: 'all 0.3s ease', 
                      transitionDelay: `${index * 100}ms`
                    }}
                  >
                    <td className="py-3 px-4">{index + 1}</td>
                    <td className="py-3 px-4 font-medium">{artist.name}</td>
                    <td className="text-right py-3 px-4 font-mono">${artist.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className={`text-right py-3 px-4 font-mono ${artist.change >= 0 ? 'text-white' : 'text-white/70'} flex items-center justify-end`}>
                      {artist.change >= 0 ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />}
                      {artist.change >= 0 ? '+' : ''}{artist.change}%
                    </td>
                    <td className="text-right py-3 px-4 font-mono">{(artist.volume / 1000).toFixed(1)}K</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LeaderboardPage;
