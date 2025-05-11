
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { ChartBar, User, TrendingUp, Lambda, Globe, Music } from 'lucide-react';

const Navbar: React.FC = () => {
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const handleConnect = () => {
    toast({
      title: "Connection Required",
      description: "Connect functionality will be implemented here.",
    });
  };

  return (
    <header className="bg-card border-b border-border sticky top-0 z-50">
      <div className="container flex h-16 items-center px-4 sm:px-8">
        <div className="mr-4 flex">
          <Link to="/" className="flex items-center space-x-2">
            <Lambda className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg hidden sm:inline-block">PROPHET</span>
          </Link>
        </div>
        
        <nav className="flex-1">
          <ul className="flex space-x-4">
            <li>
              <Link 
                to="/" 
                className="px-3 py-2 text-sm font-medium hover:text-primary transition-colors"
              >
                {isMobile ? <Music size={20} /> : "Home"}
              </Link>
            </li>
            <li>
              <Link 
                to="/leaderboard" 
                className="px-3 py-2 text-sm font-medium hover:text-primary transition-colors"
              >
                {isMobile ? <TrendingUp size={20} /> : "Leaderboard"}
              </Link>
            </li>
            <li>
              <Link 
                to="/markets" 
                className="px-3 py-2 text-sm font-medium hover:text-primary transition-colors"
              >
                {isMobile ? <ChartBar size={20} /> : "Markets"}
              </Link>
            </li>
            <li>
              <Link 
                to="/portfolio" 
                className="px-3 py-2 text-sm font-medium hover:text-primary transition-colors"
              >
                {isMobile ? <User size={20} /> : "Portfolio"}
              </Link>
            </li>
          </ul>
        </nav>
        
        <div>
          <Button onClick={handleConnect} className="flex items-center gap-2">
            <Globe size={16} />
            <span className="hidden sm:inline">Connect</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
