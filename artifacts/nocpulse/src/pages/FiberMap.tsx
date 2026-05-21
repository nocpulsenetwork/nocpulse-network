import React from 'react';
import { Card } from '@/components/ui/card';

export default function FiberMap() {
  return (
    <div className="space-y-6 h-[calc(100vh-8rem)]">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fiber Map</h1>
        <p className="text-muted-foreground">Physical infrastructure visualization</p>
      </div>

      <Card className="w-full h-full relative overflow-hidden bg-[#0a0f18] border-border/50 rounded-xl">
        <div className="absolute inset-0 opacity-20 pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '32px 32px' }}>
        </div>
        
        {/* Simple stylized SVG Map */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice">
          {/* Routes */}
          <path d="M 200,300 L 400,200 L 600,250 L 800,150" fill="none" stroke="hsl(var(--primary))" strokeWidth="4" strokeDasharray="5,5" className="animate-[dash_20s_linear_infinite]" />
          <path d="M 400,200 L 500,450 L 750,400" fill="none" stroke="hsl(var(--primary))" strokeWidth="3" opacity="0.6" />
          <path d="M 200,300 L 300,500 L 500,450" fill="none" stroke="hsl(var(--destructive))" strokeWidth="3" />
          
          {/* Nodes */}
          <g transform="translate(200,300)">
            <circle r="16" fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth="4" />
            <circle r="6" fill="hsl(var(--primary))" className="animate-pulse" />
            <text y="30" textAnchor="middle" fill="hsl(var(--foreground))" fontSize="12" fontWeight="bold">Data Center Alpha</text>
          </g>

          <g transform="translate(400,200)">
            <circle r="12" fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth="3" />
            <text y="-20" textAnchor="middle" fill="hsl(var(--foreground))" fontSize="12" fontWeight="bold">North Hub</text>
          </g>

          <g transform="translate(600,250)">
            <circle r="12" fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth="3" />
            <text y="-20" textAnchor="middle" fill="hsl(var(--foreground))" fontSize="12" fontWeight="bold">Metro Exchange</text>
          </g>

          <g transform="translate(800,150)">
            <circle r="12" fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth="3" />
            <text y="-20" textAnchor="middle" fill="hsl(var(--foreground))" fontSize="12" fontWeight="bold">East Hub</text>
          </g>

          <g transform="translate(500,450)">
            <circle r="12" fill="hsl(var(--card))" stroke="hsl(var(--destructive))" strokeWidth="3" />
            <circle r="6" fill="hsl(var(--destructive))" className="animate-pulse" />
            <text y="25" textAnchor="middle" fill="hsl(var(--foreground))" fontSize="12" fontWeight="bold">West Node (Offline)</text>
          </g>

          <g transform="translate(750,400)">
            <circle r="12" fill="hsl(var(--card))" stroke="hsl(var(--amber-500))" strokeWidth="3" />
            <text y="25" textAnchor="middle" fill="hsl(var(--foreground))" fontSize="12" fontWeight="bold">South Node (Degraded)</text>
          </g>
          
          <g transform="translate(300,500)">
            <rect x="-10" y="-10" width="20" height="20" fill="hsl(var(--card))" stroke="hsl(var(--destructive))" strokeWidth="2" />
            <text y="25" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="10">Fiber Break</text>
          </g>
        </svg>

        <style>{`
          @keyframes dash {
            to { stroke-dashoffset: -1000; }
          }
        `}</style>
      </Card>
    </div>
  );
}
