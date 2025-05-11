
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Link as LinkIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

// Mock data for portfolio
const portfolioData = {
  totalValue: 15874.32,
  changePercentage: 8.7,
  changeAmount: 1272.54,
  holdings: [
    { id: 1, name: "KAWS", value: 5890.45, allocation: 37.1, change: 12.5, price: 1458.92, quantity: 4.04 },
    { id: 2, name: "Banksy", value: 4340.11, allocation: 27.3, change: -3.2, price: 2893.41, quantity: 1.5 },
    { id: 3, name: "Yayoi Kusama", value: 3564.70, allocation: 22.5, change: 8.7, price: 1782.35, quantity: 2 },
    { id: 4, name: "Takashi Murakami", value: 1867.56, allocation: 11.8, change: 5.1, price: 934.28, quantity: 2 },
    { id: 5, name: "Jean-Michel Basquiat", value: 211.50, allocation: 1.3, change: 7.3, price: 4582.16, quantity: 0.046 },
  ],
  transactionHistory: [
    { id: 1, date: "May 10, 2025", artist: "KAWS", action: "buy", price: 1420.35, quantity: 1, total: 1420.35 },
    { id: 2, date: "May 8, 2025", artist: "Banksy", action: "sell", price: 2950.12, quantity: 0.5, total: 1475.06 },
    { id: 3, date: "May 5, 2025", artist: "Yayoi Kusama", action: "buy", price: 1722.80, quantity: 1, total: 1722.80 },
    { id: 4, date: "May 3, 2025", artist: "KAWS", action: "buy", price: 1350.47, quantity: 2, total: 2700.94 },
    { id: 5, date: "May 1, 2025", artist: "Takashi Murakami", action: "buy", price: 910.25, quantity: 2, total: 1820.50 },
  ]
};

// COLORS for pie chart
const COLORS = ['#8B5CF6', '#10B981', '#3B82F6', '#F59E0B', '#EC4899'];

const PortfolioPage: React.FC = () => {
  const { toast } = useToast();

  const handleConnect = () => {
    toast({
      title: "Connection Required",
      description: "Connect functionality will be implemented here.",
    });
  };

  // Format holdings data for pie chart
  const chartData = portfolioData.holdings.map(item => ({
    name: item.name,
    value: item.allocation
  }));

  const isConnected = false; // Mock state for connection

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] animate-fade-in">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Connect Wallet</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <p className="text-muted-foreground">
              Connect your wallet to view your artist token portfolio.
            </p>
            <Button onClick={handleConnect} className="w-full flex items-center justify-center gap-2">
              <LinkIcon size={18} />
              Connect
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">Your Portfolio</h1>
      
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold">${portfolioData.totalValue.toLocaleString()}</span>
              <div className={`flex items-center mb-0.5 ${portfolioData.changePercentage >= 0 ? 'text-market-green' : 'text-market-red'}`}>
                {portfolioData.changePercentage >= 0 ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />}
                <span className="text-sm font-semibold">
                  {portfolioData.changePercentage >= 0 ? '+' : ''}{portfolioData.changePercentage}%
                </span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {portfolioData.changePercentage >= 0 ? '+' : '-'}${Math.abs(portfolioData.changeAmount).toLocaleString()} today
            </p>
          </CardContent>
        </Card>
        
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [`${value}%`, 'Allocation']}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Artist</th>
                  <th className="text-right py-3 px-4">Quantity</th>
                  <th className="text-right py-3 px-4">Price</th>
                  <th className="text-right py-3 px-4">Value</th>
                  <th className="text-right py-3 px-4">Allocation</th>
                  <th className="text-right py-3 px-4">24h</th>
                  <th className="text-right py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {portfolioData.holdings.map((holding) => (
                  <tr key={holding.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4">
                      <div className="font-medium">{holding.name}</div>
                    </td>
                    <td className="text-right py-3 px-4">
                      {holding.quantity.toLocaleString(undefined, { minimumFractionDigits: holding.quantity < 1 ? 3 : 2, maximumFractionDigits: holding.quantity < 1 ? 3 : 2 })}
                    </td>
                    <td className="text-right py-3 px-4">
                      ${holding.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="text-right py-3 px-4">
                      ${holding.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="text-right py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <Progress value={holding.allocation} className="w-16" />
                        <span>{holding.allocation}%</span>
                      </div>
                    </td>
                    <td className={`text-right py-3 px-4 ${holding.change >= 0 ? 'text-market-green' : 'text-market-red'}`}>
                      <div className="flex items-center justify-end">
                        {holding.change >= 0 ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />}
                        <span>{holding.change >= 0 ? '+' : ''}{holding.change}%</span>
                      </div>
                    </td>
                    <td className="text-right py-3 px-4">
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" className="h-7 px-2 bg-market-green hover:bg-market-green/80">Buy</Button>
                        <Button size="sm" className="h-7 px-2" variant="outline">Sell</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Date</th>
                  <th className="text-left py-3 px-4">Artist</th>
                  <th className="text-left py-3 px-4">Action</th>
                  <th className="text-right py-3 px-4">Price</th>
                  <th className="text-right py-3 px-4">Quantity</th>
                  <th className="text-right py-3 px-4">Total</th>
                </tr>
              </thead>
              <tbody>
                {portfolioData.transactionHistory.map((transaction) => (
                  <tr key={transaction.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4 text-muted-foreground">{transaction.date}</td>
                    <td className="py-3 px-4 font-medium">{transaction.artist}</td>
                    <td className="py-3 px-4">
                      <Badge variant={transaction.action === 'buy' ? 'default' : 'secondary'}>
                        {transaction.action.charAt(0).toUpperCase() + transaction.action.slice(1)}
                      </Badge>
                    </td>
                    <td className="text-right py-3 px-4">
                      ${transaction.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="text-right py-3 px-4">{transaction.quantity}</td>
                    <td className="text-right py-3 px-4">
                      ${transaction.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
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

export default PortfolioPage;
