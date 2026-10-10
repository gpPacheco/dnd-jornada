import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SupabaseService, UserProfile, TimeEntry } from '../../../core/services/supabase';

export interface EnrichedEntry extends TimeEntry {
  userName?: string;
  localTimeFormatted: string;
  dateFormatted: string;
}

export interface EmployeeSummary {
  id: string;
  name: string;
  role: string;
  baseLocation: string;
  totalOctoberHours: number;
  totalWorkedDays: number;
  overtimeDaysCount: number;
  manualAdjustmentsCount: number;
}

@Component({
  selector: 'app-hr-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hr-dashboard.html',
  styleUrls: ['./hr-dashboard.css']
})
export class HrDashboard implements OnInit {
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  profile = signal<UserProfile | null>(null);
  allProfiles = signal<any[]>([]);
  allEntries = signal<EnrichedEntry[]>([]);
  periodClosed = signal(false);
  periodClosingInfo = signal<any>(null);

  loading = signal(false);
  closingLoading = signal(false);
  toastMessage = signal('');
  toastType = signal<'success' | 'error'>('success');

  // Navegação entre Módulos
  activeTab = signal<'SUMMARY' | 'ENTRIES' | 'CLOSING'>('SUMMARY');

  // Filtros da Auditoria
  filterEmployee = signal<string>('ALL');
  filterEventType = signal<string>('ALL');
  searchEntryQuery = signal<string>('');

  // Modal de Justificativa para Auditoria de RH
  selectedJustification = signal<{
    employeeName: string;
    dateFormatted: string;
    localTime: string;
    utcTime: string;
    timezoneId: string;
    eventType: string;
    justification: string;
  } | null>(null);

  openJustification(entry: EnrichedEntry) {
    this.selectedJustification.set({
      employeeName: entry.userName || 'Colaborador',
      dateFormatted: entry.dateFormatted,
      localTime: entry.localTimeFormatted,
      utcTime: entry.timestamp_utc,
      timezoneId: entry.timezone_id,
      eventType: this.eventLabels[entry.event_type] || entry.event_type,
      justification: entry.justification || 'Jornada extrapolou 10h diárias com homologação e ajuste gerencial.'
    });
  }

  closeJustification() {
    this.selectedJustification.set(null);
  }

  roleLabels: Record<string, string> = {
    'EMPLOYEE': 'Colaborador',
    'MANAGER': 'Gestor',
    'HR_ADMIN': 'RH / Admin'
  };

  roleBadgeClasses: Record<string, string> = {
    'EMPLOYEE': 'badge-employee',
    'MANAGER': 'badge-manager',
    'HR_ADMIN': 'badge-hr'
  };

  eventLabels: Record<string, string> = {
    'CLOCK_IN': 'Entrada (Início)',
    'BREAK_START': 'Saída P/ Intervalo',
    'BREAK_END': 'Retorno do Intervalo',
    'CLOCK_OUT': 'Saída (Encerramento)'
  };

  // KPIs de Outubro
  totalCompanyOctoberHours = computed(() => {
    return this.supabase.calculateWorkedHours(this.allEntries());
  });

  totalOvertimeAlertsCount = computed(() => {
    const entries = this.allEntries();
    const daysByUser = new Map<string, TimeEntry[]>();
    for (const e of entries) {
      const key = `${e.user_id}_${e.timestamp_utc.split('T')[0]}`;
      if (!daysByUser.has(key)) daysByUser.set(key, []);
      daysByUser.get(key)!.push(e);
    }
    let count = 0;
    daysByUser.forEach(dayEntries => {
      if (this.supabase.calculateWorkedHours(dayEntries) > 10) count++;
    });
    return count;
  });

  totalInternationalCount = computed(() => {
    return this.allEntries().filter(e => e.timezone_id && !e.timezone_id.includes('Sao_Paulo')).length;
  });

  totalManualAdjustmentsCount = computed(() => {
    return this.allEntries().filter(e => e.is_manual_adjustment).length;
  });

  // Resumo por Colaborador
  employeeSummaries = computed<EmployeeSummary[]>(() => {
    const profiles = this.allProfiles().filter(p => p.role === 'EMPLOYEE');
    const entries = this.allEntries();

    return profiles.map(p => {
      const userEntries = entries.filter(e => e.user_id === p.id);
      const totalHours = this.supabase.calculateWorkedHours(userEntries);

      // Calcular dias com >10h e dias trabalhados
      const daysMap = new Map<string, TimeEntry[]>();
      for (const e of userEntries) {
        const d = e.timestamp_utc.split('T')[0];
        if (!daysMap.has(d)) daysMap.set(d, []);
        daysMap.get(d)!.push(e);
      }

      let overtimeDays = 0;
      daysMap.forEach(dEntries => {
        if (this.supabase.calculateWorkedHours(dEntries) > 10) overtimeDays++;
      });

      const manualCount = userEntries.filter(e => e.is_manual_adjustment).length;

      let baseLocation = '🇧🇷 Brasil';
      if (p.full_name.includes('Lisboa') || p.full_name.includes('Santos')) {
        baseLocation = '🇵🇹 Portugal';
      } else if (p.full_name.includes('Madrid') || p.full_name.includes('Carlos')) {
        baseLocation = '🇪🇸 Espanha';
      }

      return {
        id: p.id,
        name: p.full_name,
        role: p.role,
        baseLocation,
        totalOctoberHours: totalHours,
        totalWorkedDays: daysMap.size,
        overtimeDaysCount: overtimeDays,
        manualAdjustmentsCount: manualCount
      };
    });
  });

  // Batidas Filtradas na Auditoria
  filteredEntries = computed(() => {
    let list = this.allEntries();
    const emp = this.filterEmployee();
    const evt = this.filterEventType();
    const q = this.searchEntryQuery().toLowerCase().trim();

    if (emp !== 'ALL') {
      list = list.filter(e => e.user_id === emp);
    }

    if (evt !== 'ALL') {
      list = list.filter(e => e.event_type === evt);
    }

    if (q) {
      list = list.filter(e => 
        (e.userName && e.userName.toLowerCase().includes(q)) ||
        e.timezone_id.toLowerCase().includes(q) ||
        (e.justification && e.justification.toLowerCase().includes(q)) ||
        e.dateFormatted.includes(q)
      );
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
        this.loadAllData();
      }
    });
  }

  async loadAllData() {
    this.loading.set(true);
    await Promise.all([
      this.loadAllProfiles(),
      this.loadOctoberEntries(),
      this.checkPeriodStatus()
    ]);
    this.loading.set(false);
  }

  async loadAllProfiles() {
    try {
      const { data, error } = await this.supabase.getAllProfiles();
      if (error) throw error;
      this.allProfiles.set(data || []);
    } catch (err) {
      console.error('Error loading profiles', err);
    }
  }

  async loadOctoberEntries() {
    try {
      const start = new Date(2026, 9, 1);
      const end = new Date(2026, 10, 1);

      const { data, error } = await this.supabase.getAllEntriesForPeriod(start, end);
      if (error) throw error;

      const enriched: EnrichedEntry[] = (data || []).map((e: any) => {
        const utcDate = new Date(e.timestamp_utc);
        let localTime = '';
        let localDate = '';
        try {
          localTime = new Intl.DateTimeFormat('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: e.timezone_id
          }).format(utcDate);

          localDate = new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            timeZone: e.timezone_id
          }).format(utcDate);
        } catch {
          localTime = `${String(utcDate.getHours()).padStart(2, '0')}:${String(utcDate.getMinutes()).padStart(2, '0')}`;
          localDate = `${String(utcDate.getDate()).padStart(2, '0')}/${String(utcDate.getMonth() + 1).padStart(2, '0')}`;
        }

        return {
          ...e,
          userName: e.profiles?.full_name || 'Colaborador',
          localTimeFormatted: localTime,
          dateFormatted: localDate
        };
      });

      this.allEntries.set(enriched);
    } catch (err) {
      console.error('Error loading October entries', err);
    }
  }

  async checkPeriodStatus() {
    try {
      const refMonth = new Date(2026, 9, 1);
      const { data } = await this.supabase.getPeriodStatus(refMonth);
      if (data && data.status === 'CLOSED') {
        this.periodClosed.set(true);
        this.periodClosingInfo.set(data);
      } else {
        this.periodClosed.set(false);
      }
    } catch (err) {
      console.error('Error checking period status', err);
    }
  }

  async closePeriod() {
    const refMonth = new Date(2026, 9, 1);

    if (!confirm('Deseja realmente fechar o período de Outubro/2026? Esta ação congela os registros no banco para auditoria contábil.')) {
      return;
    }

    try {
      this.closingLoading.set(true);
      const { error } = await this.supabase.closePeriod(refMonth);
      if (error) throw error;
      this.periodClosed.set(true);
      this.showToast('Período de Outubro/2026 fechado com sucesso!', 'success');
      await this.checkPeriodStatus();
    } catch (err: any) {
      console.error('Error closing period', err);
      this.showToast(err.message || 'Erro ao fechar período.', 'error');
    } finally {
      this.closingLoading.set(false);
    }
  }

  inspectEmployee(empId: string) {
    this.filterEmployee.set(empId);
    this.activeTab.set('ENTRIES');
  }

  formatHours(hours: number): string {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${String(m).padStart(2, '0')}min`;
  }

  showToast(message: string, type: 'success' | 'error') {
    this.toastMessage.set(message);
    this.toastType.set(type);
    setTimeout(() => this.toastMessage.set(''), 4000);
  }

  async logout() {
    await this.supabase.signOut();
    this.router.navigate(['/']);
  }
}
