import React, { useState } from 'react';
import { olts, OltDevice } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search } from 'lucide-react';

export default function OltManagement() {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOlts = olts.filter(olt => 
    olt.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    olt.ip.includes(searchTerm) ||
    olt.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">OLT Management</h1>
          <p className="text-muted-foreground">Manage and monitor Optical Line Terminals.</p>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search OLTs by name, IP, or location..." 
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
              <TableHead>Name</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Ports</TableHead>
              <TableHead>Active ONUs</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Uptime</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOlts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No OLTs found matching your search.
                </TableCell>
              </TableRow>
            ) : (
              filteredOlts.map((olt) => (
                <TableRow key={olt.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">{olt.name}</TableCell>
                  <TableCell className="font-mono text-xs">{olt.ip}</TableCell>
                  <TableCell>{olt.location}</TableCell>
                  <TableCell>{olt.portCount}</TableCell>
                  <TableCell>{olt.activeOnus}</TableCell>
                  <TableCell>
                    <StatusBadge status={olt.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{olt.uptime}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
