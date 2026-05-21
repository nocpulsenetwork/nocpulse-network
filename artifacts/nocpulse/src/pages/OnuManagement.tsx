import React, { useState } from 'react';
import { onus, olts } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function OnuManagement() {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOnus = onus.filter(onu => 
    onu.macAddress.toLowerCase().includes(searchTerm.toLowerCase()) || 
    onu.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ONU Management</h1>
          <p className="text-muted-foreground">Monitor customer premises equipment.</p>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by MAC or customer name..." 
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ONU ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>MAC Address</TableHead>
              <TableHead>Parent OLT</TableHead>
              <TableHead>Signal (dBm)</TableHead>
              <TableHead>Bandwidth</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOnus.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No ONUs found matching your search.
                </TableCell>
              </TableRow>
            ) : (
              filteredOnus.map((onu) => {
                const parentOlt = olts.find(o => o.id === onu.oltId);
                const isPoorSignal = onu.signalLevel < -25;
                
                return (
                  <TableRow key={onu.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium text-xs font-mono">{onu.id}</TableCell>
                    <TableCell>{onu.customerName}</TableCell>
                    <TableCell className="font-mono text-xs">{onu.macAddress}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px] bg-secondary">
                        {parentOlt?.name || onu.oltId}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`font-medium ${isPoorSignal ? 'text-destructive' : 'text-green-500'}`}>
                        {onu.signalLevel}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{onu.bandwidth}</TableCell>
                    <TableCell>
                      <StatusBadge status={onu.status} />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
