import React, { useState, useEffect, useMemo } from 'react';
import { olts } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export default function OltManagement() {
  const searchParams = new URLSearchParams(window.location.search);
  const initialStatus = searchParams.get('status');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(
    initialStatus ? initialStatus.charAt(0).toUpperCase() + initialStatus.slice(1) : 'All Status'
  );

  useEffect(() => {
    if (initialStatus) {
      setStatusFilter(initialStatus.charAt(0).toUpperCase() + initialStatus.slice(1));
    }
  }, [initialStatus]);

  const filteredOlts = useMemo(() => {
    return olts.filter(olt => {
      const matchesSearch = 
        olt.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        olt.ip.includes(searchTerm) ||
        olt.location.toLowerCase().includes(searchTerm.toLowerCase());
        
      const matchesStatus = statusFilter === 'All Status' || olt.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">OLT Management</h1>
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            Manage and monitor Optical Line Terminals
            <Badge variant="secondary" className="ml-2">Showing {filteredOlts.length} of {olts.length} OLTs</Badge>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search OLTs by name, IP, or location..." 
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Status">All Status</SelectItem>
            <SelectItem value="Online">Online</SelectItem>
            <SelectItem value="Offline">Offline</SelectItem>
            <SelectItem value="Degraded">Degraded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border/60 overflow-hidden backdrop-blur-sm bg-card/80 shadow-lg">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/60">
              <TableHead className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">Name</TableHead>
              <TableHead className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">IP Address</TableHead>
              <TableHead className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">Location</TableHead>
              <TableHead className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">Ports</TableHead>
              <TableHead className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">Active ONUs</TableHead>
              <TableHead className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">Status</TableHead>
              <TableHead className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground">Uptime</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOlts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  No OLTs found matching your search.
                </TableCell>
              </TableRow>
            ) : (
              filteredOlts.map((olt) => (
                <TableRow key={olt.id} className="hover:bg-primary/5 transition-colors duration-150 border-b border-border/40 cursor-pointer group">
                  <TableCell className="font-medium">{olt.name}</TableCell>
                  <TableCell className="font-mono text-xs">{olt.ip}</TableCell>
                  <TableCell>{olt.location}</TableCell>
                  <TableCell>{olt.portCount}</TableCell>
                  <TableCell>{olt.activeOnus}</TableCell>
                  <TableCell>
                    <StatusBadge status={olt.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{olt.uptime}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
