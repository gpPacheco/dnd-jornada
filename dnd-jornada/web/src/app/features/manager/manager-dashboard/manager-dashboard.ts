import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SupabaseService, UserProfile, TimeEntry, EventType } from '../../../core/services/supabase';

export interface TeamMemberDay {
  date: Date;
  dateFormatted: string;
  dayName: string;
  clockIn: string;
  breakStart: string;
  breakEnd: string;
  clockOut: string;
  totalHours: string;
  totalHoursNum: number;
  timezoneId?: string;
  isOvertime10h: boolean;
  isManualAdjustment: boolean;
  justification?: string;
}

export interface TeamMember {
  profile: UserProfile;
  weekEntries: TimeEntry[];
  totalHours: number;
  days: TeamMemberDay[];
  hasOvertimeAlert: boolean;
  hasInternationalTz: boolean;
  baseLocation: string;
}

@Component({
  selector: 'app-manager-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './manager-dashboard.html',
  styleUrls: ['./manager-dashboard.css']
})
export class ManagerDashboard implements OnInit {
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  profile = signal<UserProfile | null>(null);
  team = signal<TeamMember[]>([]);
  loading = signal(false);
  selectedWeekStart = signal(this.getMonday(new Date()));

  // Filtros e Interatividade
  searchQuery = signal('');
  filterStatus = signal<'ALL' | 'ALERTS' | 'INTL'>('ALL');
  expandedMembers = signal<Set<string>>(new Set<string>());

  // KPIs da Equipe
  totalTeamHours = computed(() => {
    return this.team().reduce((acc, m) => acc + m.totalHours, 0);
  });

  overtimeAlertsCount = computed(() => {
    return this.team().reduce((acc, m) => {
      const count = m.days.filter(d => d.isOvertime10h).length;
      return acc + count;
    }, 0);
  });

  internationalCount = computed(() => {
    return this.team().reduce((acc, m) => {
      const count = m.days.filter(d => d.timezoneId && !d.timezoneId.includes('Sao_Paulo')).length;
      return acc + count;
    }, 0);
  });

  weekLabel = computed(() => {
    const start = this.selectedWeekStart();
    const end = new Date(start);
    end.setDate(end.getDate() + 4);
    const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    return `${fmt(start)} — ${fmt(end)}`;
  });

  // Lista Filtrada de Colaboradores
  filteredTeam = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const filter = this.filterStatus();
    let list = this.team();

    if (q) {
      list = list.filter(m => 
        m.profile.full_name.toLowerCase().includes(q) ||
        (m.profile.email && m.profile.email.toLowerCase().includes(q))
      );
    }

    if (filter === 'ALERTS') {
      list = list.filter(m => m.hasOvertimeAlert);
    } else if (filter === 'INTL') {
      list = list.filter(m => m.hasInternationalTz);
    }

    return list;
  });

  async ngOnInit() {
    const session = await this.supabase.getSession();
    if (!session?.user) {
      this.router.navigate(['/']);
      return;
    }
    if (!this.supabase.profile) {
      await this.supabase.fetchProfileAsync(session.user.id);
    }
    this.supabase.profile$.subscribe(p => {
      if (p) {
        this.profile.set(p);
        this.loadTeam();
      }
    });
  }

  async loadTeam() {
    try {
      this.loading.set(true);
      const { data: profiles, error: pError } = await this.supabase.getTeamProfiles();
      if (pError) throw pError;
      if (!profiles || profiles.length === 0) {
        this.team.set([]);
        return;
      }

      const ids = profiles.map((p: any) => p.id);
      const { data: entries, error: eError } = await this.supabase.getTeamEntries(ids, this.selectedWeekStart());
      if (eError) throw eError;

      const teamMembers: TeamMember[] = profiles.map((p: any) => {
        const memberEntries = (entries || []).filter((e: any) => e.user_id === p.id);
        const days = this.buildMemberDays(memberEntries);
        const hasOvertimeAlert = days.some(d => d.isOvertime10h);
        const hasInternationalTz = days.some(d => d.timezoneId && !d.timezoneId.includes('Sao_Paulo'));

        // Determinar localização base do colaborador
        let baseLocation = '🇧🇷 Brasil';
        if (p.full_name.includes('Lisboa') || p.full_name.includes('Santos')) {
          baseLocation = '🇵🇹 Lisboa';
        } else if (p.full_name.includes('Madrid') || p.full_name.includes('Carlos')) {
          baseLocation = '🇪🇸 Madri';
        }

        return {
          profile: p,
          weekEntries: memberEntries,
          totalHours: this.supabase.calculateWorkedHours(memberEntries),
          days,
          hasOvertimeAlert,
          hasInternationalTz,
          baseLocation
        };
      });

      this.team.set(teamMembers);

      // Por padrão, expande todos os membros para visualização imediata clara
      const expandedSet = new Set<string>();
      teamMembers.forEach(m => expandedSet.add(m.profile.id));
      this.expandedMembers.set(expandedSet);
    } catch (err) {
      console.error('Error loading team', err);
    } finally {
      this.loading.set(false);
    }
  }

  toggleExpand(memberId: string) {
    const nextSet = new Set(this.expandedMembers());
    if (nextSet.has(memberId)) {
      nextSet.delete(memberId);
    } else {
      nextSet.add(memberId);
    }
    this.expandedMembers.set(nextSet);
  }

  expandAll() {
    const all = new Set<string>();
    this.team().forEach(m => all.add(m.profile.id));
    this.expandedMembers.set(all);
  }

  collapseAll() {
    this.expandedMembers.set(new Set<string>());
  }

  private buildMemberDays(entries: TimeEntry[]): TeamMemberDay[] {
    const daysArr: TeamMemberDay[] = [];
    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const start = this.selectedWeekStart();

    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);

      const dayEntries = entries.filter(e => {
        const entryDate = new Date(e.timestamp_utc);
        return entryDate.getFullYear() === date.getFullYear() &&
               entryDate.getMonth() === date.getMonth() &&
               entryDate.getDate() === date.getDate();
      });

      const findEvent = (type: EventType) => {
        const entry = dayEntries.find(e => e.event_type === type);
        if (!entry) return '—';
        const d = new Date(entry.timestamp_utc);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      };

      const totalHrs = this.supabase.calculateWorkedHours(dayEntries);
      const tzEntry = dayEntries.find(e => e.timezone_id);
      const isManual = dayEntries.some(e => e.is_manual_adjustment);
      const manualEntry = dayEntries.find(e => e.is_manual_adjustment && e.justification);

      daysArr.push({
        date,
        dayName: dayNames[date.getDay()],
        dateFormatted: `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`,
        clockIn: findEvent('CLOCK_IN'),
        breakStart: findEvent('BREAK_START'),
        breakEnd: findEvent('BREAK_END'),
        clockOut: findEvent('CLOCK_OUT'),
        totalHours: dayEntries.length > 0 ? `${totalHrs.toFixed(1)}h` : '—',
        totalHoursNum: totalHrs,
        timezoneId: tzEntry?.timezone_id,
        isOvertime10h: totalHrs > 10,
        isManualAdjustment: isManual,
        justification: manualEntry?.justification || undefined
      });
    }

    return daysArr;
  }

  previousWeek() {
    const prev = new Date(this.selectedWeekStart());
    prev.setDate(prev.getDate() - 7);
    this.selectedWeekStart.set(prev);
    this.loadTeam();
  }

  nextWeek() {
    const currentMonday = this.getMonday(new Date());
    if (this.selectedWeekStart().getTime() >= currentMonday.getTime()) return;
    const next = new Date(this.selectedWeekStart());
    next.setDate(next.getDate() + 7);
    this.selectedWeekStart.set(next);
    this.loadTeam();
  }

  private getMonday(d: Date): Date {
    const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    return date;
  }

  formatHours(hours: number): string {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${String(m).padStart(2, '0')}min`;
  }

  async logout() {
    await this.supabase.signOut();
    this.router.navigate(['/']);
  }
}
