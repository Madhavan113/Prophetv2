
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Search } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Mock data for markets
const artistMarkets = [
  { 
    id: 1, 
    name: "KAWS", 
    price: 1458.92, 
    change: 12.5, 
    volume: 92500,
    description: "Brian Donnelly, known professionally as KAWS, is an American artist and designer.",
    chartData: [
      { date: "May 1", price: 1248 },
      { date: "May 2", price: 1320 },
      { date: "May 3", price: 1285 },
      { date: "May 4", price: 1352 },
      { date: "May 5", price: 1372 },
      { date: "May 6", price: 1395 },
      { date: "May 7", price: 1458 },
    ]
  },
  { 
    id: 2, 
    name: "Banksy", 
    price: 2893.41, 
    change: -3.2, 
    volume: 143200,
    description: "Banksy is a pseudonymous England-based street artist, political activist, and film director.",
    chartData: [
      { date: "May 1", price: 3103 },
      { date: "May 2", price: 3050 },
      { date: "May 3", price: 2980 },
      { date: "May 4", price: 2910 },
      { date: "May 5", price: 2875 },
      { date: "May 6", price: 2905 },
      { date: "May 7", price: 2893 },
    ]
  },
  { 
    id: 3, 
    name: "Yayoi Kusama", 
    price: 1782.35, 
    change: 8.7, 
    volume: 87600,
    description: "Yayoi Kusama is a Japanese contemporary artist who works primarily in sculpture and installation.",
    chartData: [
      { date: "May 1", price: 1650 },
      { date: "May 2", price: 1672 },
      { date: "May 3", price: 1695 },
      { date: "May 4", price: 1712 },
      { date: "May 5", price: 1740 },
      { date: "May 6", price: 1765 },
      { date: "May 7", price: 1782 },
    ]
  },
  { 
    id: 4, 
    name: "Takashi Murakami", 
    price: 934.28, 
    change: 5.1, 
    volume: 65800,
    description: "Takashi Murakami is a Japanese contemporary artist who works in fine arts media and commercial media.",
    chartData: [
      { date: "May 1", price: 890 },
      { date: "May 2", price: 895 },
      { date: "May 3", price: 910 },
      { date: "May 4", price: 905 },
      { date: "May 5", price: 918 },
      { date: "May 6", price: 925 },
      { date: "May 7", price: 934 },
    ]
  },
  { 
    id: 5, 
    name: "Damien Hirst", 
    price: 1243.87, 
    change: -1.8, 
    volume: 72400,
    description: "Damien Hirst is an English artist, entrepreneur, and art collector who dominated the art scene in the UK during the 1990s.",
    chartData: [
      { date: "May 1", price: 1270 },
      { date: "May 2", price: 1275 },
      { date: "May 3", price: 1268 },
      { date: "May 4", price: 1255 },
      { date: "May 5", price: 1248 },
      { date: "May 6", price: 1240 },
      { date: "May 7", price: 1243 },
    ]
  },
];

const MarketsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState('all');
  
  // Filter artists based on search term and selected tab
  const filteredArtists = artistMarkets.filter(artist => {
    const matchesSearch = artist.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = selectedTab === 'all' || 
                      (selectedTab === 'gainers' && artist.change > 0) ||
                      (selectedTab === 'losers' && artist.change < 0);
    return matchesSearch && matchesTab;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <h1 className="text-2xl font-bold">Artist Markets</h1>
        
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search artists..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Tabs defaultValue="all" onValueChange={setSelectedTab}>
        <TabsList className="grid grid-cols-3 w-full sm:w-[400px]">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="gainers">Gainers</TabsTrigger>
          <TabsTrigger value="losers">Losers</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="mt-6">
          <div className="grid gap-6 grid-cols-1">
            {filteredArtists.map(artist => (
              <ArtistMarketCard key={artist.id} artist={artist} />
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="gainers" className="mt-6">
          <div className="grid gap-6 grid-cols-1">
            {filteredArtists.map(artist => (
              <ArtistMarketCard key={artist.id} artist={artist} />
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="losers" className="mt-6">
          <div className="grid gap-6 grid-cols-1">
            {filteredArtists.map(artist => (
              <ArtistMarketCard key={artist.id} artist={artist} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

interface ArtistMarketCardProps {
  artist: typeof artistMarkets[0];
}

const ArtistMarketCard: React.FC<ArtistMarketCardProps> = ({ artist }) => {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold">{artist.name}</h3>
                <p className="text-sm text-muted-foreground">{artist.description}</p>
              </div>
              <div className={`flex items-center font-semibold ${artist.change >= 0 ? 'text-market-green' : 'text-market-red'}`}>
                {artist.change >= 0 ? <TrendingUp className="mr-1" size={18} /> : <TrendingDown className="mr-1" size={18} />}
                <span>{artist.change >= 0 ? '+' : ''}{artist.change}%</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Current Price</span>
                <span className="font-medium">${artist.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">24h Volume</span>
                <span>${(artist.volume / 1000).toFixed(1)}K</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button className="flex-1 bg-market-green hover:bg-market-green/80">Buy</Button>
              <Button variant="outline" className="flex-1 text-market-red border-market-red hover:bg-market-red/10 hover:text-market-red">Sell</Button>
            </div>
          </div>

          <div className="lg:col-span-2 h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={artist.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: 'hsl(var(--muted-foreground))' }} 
                  axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }} 
                />
                <YAxis 
                  domain={['auto', 'auto']} 
                  tick={{ fill: 'hsl(var(--muted-foreground))' }} 
                  axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }} 
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip 
                  formatter={(value) => [`$${value}`, 'Price']}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="price" 
                  stroke={artist.change >= 0 ? '#10B981' : '#EF4444'} 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MarketsPage;
