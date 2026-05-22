import React, { useState, useEffect, useMemo } from 'react';
import { onus, olts } from '@/data/mockData';
import { StatusBadge } from '@/components/StatusBadge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, WifiOff, MoreHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useLocation } from 'wouter';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from 'sonner';

export default function OnuManagement() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialStatus = searchParams.get('status');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus ? initialStatus.charAt(0).toUpperCase() + initialStatus.slice(1) : 'All Status');
  const [oltFilter, setOltFilter] = useState<string>('All OLTs');
  const [ponFilter, setPonFilter] = useState<string>('All PONs');

  const [page, setPage] = useState(1);
  const [editingOnu, setEditingOnu] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    if (initialStatus) {
      setStatusFilter(initialStatus.charAt(0).toUpperCase() + initialStatus.slice(1));
    }
  }, [initialStatus]);

  const filteredOnus = useMemo(() => {
    return onus.filter(onu => {
      const matchesSearch = 
        onu.onuNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        onu.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        onu.macAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
        onu.clientMac.toLowerCase().includes(searchTerm.toLowerCase()) ||
        onu.customerName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'All Status' || onu.status === statusFilter;
      const matchesOlt = oltFilter === 'All OLTs' || onu.oltId === oltFilter;
      const matchesPon = ponFilter === 'All PONs' || onu.ponPort === ponFilter;

      return matchesSearch && matchesStatus && matchesOlt && matchesPon;
    });
  }, [searchTerm, statusFilter, oltFilter, ponFilter]);

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'All Status' || oltFilter !== 'All OLTs' || ponFilter !== 'All PONs';

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('All Status');
    setOltFilter('All OLTs');
    setPonFilter('All PONs');
    setPage(1);
  };

  const paginatedOnus = filteredOnus.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredOnus.length / ITEMS_PER_PAGE);

  const getPowerColor = (power: number) => {
    if (power > -25) return 'text-green-500';
    if (power >= -28) return 'text-amber-500';
    return 'text-red-500';
  };

  const getReasonBadgeColor = (reason: string) => {
    switch (reason) {
      case 'Power Loss': return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'Signal Lost': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'Admin Reboot': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ONU Management</h1>
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            Monitor and manage customer premises equipment <Badge variant="secondary" className="ml-2">Total: {filteredOnus.length} ONUs</Badge>
          </div>
        </div>
        <Button variant="outline" disabled className="opacity-50 cursor-not-allowed">Export CSV</Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative w-full sm:w-[280px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search ONUs..." 
            className="pl-8"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
          />
        </div>
        
        <Select value={oltFilter} onValueChange={(v) => { setOltFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All OLTs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All OLTs">All OLTs</SelectItem>
            {olts.map(o => (
              <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={ponFilter} onValueChange={(v) => { setPonFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All PONs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All PONs">All PONs</SelectItem>
            <SelectItem value="PON-1">PON-1</SelectItem>
            <SelectItem value="PON-2">PON-2</SelectItem>
            <SelectItem value="PON-3">PON-3</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Status">All Status</SelectItem>
            <SelectItem value="Online">Online</SelectItem>
            <SelectItem value="Offline">Offline</SelectItem>
            <SelectItem value="Degraded">Degraded</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" onClick={clearFilters} className="text-muted-foreground">
            Clear filters
          </Button>
        )}
      </div>

      <div className="rounded-md border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto w-full">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="whitespace-nowrap">ONU No</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right whitespace-nowrap">Distance</TableHead>
                <TableHead>ONU MAC</TableHead>
                <TableHead>Client MAC</TableHead>
                <TableHead className="whitespace-nowrap">RX Power</TableHead>
                <TableHead className="whitespace-nowrap">TX Power</TableHead>
                <TableHead className="whitespace-nowrap">Last Logout Time</TableHead>
                <TableHead className="whitespace-nowrap">Last Logout Reason</TableHead>
                <TableHead className="whitespace-nowrap">Online Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedOnus.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <WifiOff className="h-10 w-10 mb-4 opacity-20" />
                      <p className="text-lg font-medium text-foreground">No ONUs found</p>
                      <p className="text-sm mb-4">Try adjusting your filters or search term</p>
                      {hasActiveFilters && (
                        <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedOnus.map((onu) => (
                  <TableRow 
                    key={onu.id} 
                    className="hover:bg-muted/50 cursor-pointer group"
                    onClick={(e) => {
                      if (!(e.target as HTMLElement).closest('.action-btn')) {
                        setLocation(`/onus/${onu.id}`);
                      }
                    }}
                  >
                    <TableCell className="font-mono font-medium text-xs whitespace-nowrap">{onu.onuNo}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={onu.description}>{onu.description}</TableCell>
                    <TableCell className="text-right text-muted-foreground whitespace-nowrap">{onu.distance}</TableCell>
                    <TableCell className="font-mono text-[10px] uppercase text-muted-foreground whitespace-nowrap">{onu.macAddress}</TableCell>
                    <TableCell className="font-mono text-[10px] uppercase text-muted-foreground whitespace-nowrap">{onu.clientMac}</TableCell>
                    <TableCell className={`font-medium whitespace-nowrap ${getPowerColor(onu.signalLevel)}`}>
                      {onu.signalLevel} dBm
                    </TableCell>
                    <TableCell className={`font-medium whitespace-nowrap ${getPowerColor(onu.txPower)}`}>
                      {onu.txPower} dBm
                    </TableCell>
                    <TableCell className={`whitespace-nowrap text-xs ${onu.lastLogoutTime === 'N/A' ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                      {onu.lastLogoutTime}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant="outline" className={`text-[10px] ${getReasonBadgeColor(onu.lastLogoutReason)}`}>
                        {onu.lastLogoutReason}
                      </Badge>
                    </TableCell>
                    <TableCell className={`whitespace-nowrap text-xs ${onu.status === 'Online' ? 'text-green-500' : 'text-muted-foreground'}`}>
                      {onu.onlineDuration}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={onu.status} />
                    </TableCell>
                    <TableCell className="action-btn" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setLocation(`/onus/${onu.id}`)}>
                            View ONU
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.success(`Reboot command sent to ${onu.description}`)}>
                            Reboot ONU
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => toast.success(`ONU ${onu.description} disabled`)} className="text-red-500">
                            Disable ONU
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.success(`ONU ${onu.description} enabled`)}>
                            Enable ONU
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => {
                            setEditingOnu(onu.id);
                            setEditDesc(onu.description);
                          }}>
                            Edit Description
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * ITEMS_PER_PAGE + 1}-{Math.min(page * ITEMS_PER_PAGE, filteredOnus.length)} of {filteredOnus.length} ONUs
          </p>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!editingOnu} onOpenChange={(open) => !open && setEditingOnu(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Description</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input 
              value={editDesc} 
              onChange={(e) => setEditDesc(e.target.value)} 
              placeholder="Enter new description"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOnu(null)}>Cancel</Button>
            <Button onClick={() => {
              toast.success("Description updated successfully");
              setEditingOnu(null);
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}