import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useBlockchainEvents } from '@/hooks/useBlockchainEvents';

const EventsDebug: React.FC = () => {
  const { 
    buyEvents, 
    sellEvents, 
    tokenCreatedEvents, 
    priceData, 
    userStats, 
    isLoading 
  } = useBlockchainEvents();

  return (
    <Card className="glass-card border-white/10">
      <CardHeader>
        <CardTitle>Blockchain Events Debug</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{buyEvents.length}</p>
              <p className="text-sm text-muted-foreground">Buy Events</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{sellEvents.length}</p>
              <p className="text-sm text-muted-foreground">Sell Events</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{tokenCreatedEvents.length}</p>
              <p className="text-sm text-muted-foreground">Tokens Created</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{priceData.length}</p>
              <p className="text-sm text-muted-foreground">Price Data</p>
            </div>
          </div>

          <div>
            <Badge variant={isLoading ? "secondary" : "default"}>
              {isLoading ? "Loading..." : "Ready"}
            </Badge>
          </div>

          {tokenCreatedEvents.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Recent Token Creations:</h4>
              <div className="space-y-2">
                {tokenCreatedEvents.slice(0, 3).map((event, index) => (
                  <div key={index} className="p-2 bg-card/30 rounded text-sm">
                    <p><strong>{event.artistName}</strong></p>
                    <p className="text-muted-foreground">
                      {event.artistTokenAddress.slice(0, 10)}...{event.artistTokenAddress.slice(-8)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(buyEvents.length > 0 || sellEvents.length > 0) && (
            <div>
              <h4 className="font-semibold mb-2">Recent Trades:</h4>
              <div className="space-y-2">
                {[...buyEvents.slice(0, 2), ...sellEvents.slice(0, 2)]
                  .sort((a, b) => b.blockNumber - a.blockNumber)
                  .slice(0, 3)
                  .map((event, index) => (
                    <div key={index} className="p-2 bg-card/30 rounded text-sm">
                      <Badge variant={'buyer' in event ? 'default' : 'secondary'}>
                        {'buyer' in event ? 'Buy' : 'Sell'}
                      </Badge>
                      <p className="text-muted-foreground mt-1">
                        Block #{event.blockNumber}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default EventsDebug; 