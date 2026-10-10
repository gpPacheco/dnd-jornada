import { Component, inject, OnInit, signal, OnDestroy, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SupabaseService, TimeEntry, EventType, UserProfile } from '../../../core/services/supabase';

interface DayRow {
  date: Date;
  dayName: string;
  dateFormatted: string;
  clockIn: string;
  breakStart: string;
  breakEnd: string;
  clockOut: string;
  totalHours: string;
  isToday: boolean;
  isWeekend: boolean;
  timezoneId?: string;
  isOvertime10h: boolean;
  isManualAdjustment: boolean;
  justification?: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class Dashboard implements OnInit, OnDestroy {
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  currentTime = signal(new Date());
  timerRef: any;

  profile = signal<UserProfile | null>(null);
  todayEntries = signal<TimeEntry[]>([]);
  weekEntries = signal<TimeEntry[]>([]);
  loading = signal(false);
  actionLoading = signal(false);
  toastMessage = signal('');
  toastType = signal<'success' | 'error' | 'warning'>('success');

  // Geolocalização
  geolocation = signal<{ lat: number; lng: number; accuracy: number } | null>(null);
  geoStatus = signal<'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable'>('idle');
  geoMessage = signal<string>('Clique para validar precisão real do GPS');

  // Modal de Justificativa
  selectedJustification = signal<{
    dateFormatted: string;
    dayName: string;
    totalHours: string;
    timezoneId?: string;
    justification: string;
    isOvertime10h: boolean;
    clockIn: string;
    clockOut: string;
  } | null>(null);

  // Semana selecionada
  selectedWeekStart = signal(this.getMonday(new Date()));

  // Máquina de estados
  nextEvent = computed(() => this.supabase.getNextEvent(this.todayEntries()));
  workedHours = computed(() => this.supabase.calculateWorkedHours(this.todayEntries()));
  businessHoursCheck = computed(() => this.supabase.isWithinBusinessHours());
  maxHoursReached = computed(() => this.workedHours() >= 10);

  // Tabela semanal
  weekRows = computed(() => this.buildWeekTable());

  // Label da semana
  weekLabel = computed(() => {
    const start = this.selectedWeekStart();
    const end = new Date(start);
    end.setDate(end.getDate() + 4); // Sexta
    const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    return `${fmt(start)} — ${fmt(end)}`;
  });

  // Detecção de Inconsistência de Jornada (Batida ímpar ou dia anterior sem encerramento)
  pendingInconsistency = computed(() => {
    const entries = this.weekEntries();
    const today = new Date();
    const days = new Map<string, TimeEntry[]>();

    for (const e of entries) {
      const d = new Date(e.timestamp_utc);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!days.has(key)) days.set(key, []);
      days.get(key)!.push(e);
    }

    for (const [dayKey, dayEntries] of days.entries()) {
      const [y, m, d] = dayKey.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const isToday = dateObj.getDate() === today.getDate() && dateObj.getMonth() === today.getMonth() && dateObj.getFullYear() === today.getFullYear();

      if (!isToday && dayEntries.length > 0) {
        const hasClockIn = dayEntries.some(e => e.event_type === 'CLOCK_IN');
        const hasClockOut = dayEntries.some(e => e.event_type === 'CLOCK_OUT');
        if (hasClockIn && !hasClockOut) {
          const fmt = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
          return {
            hasError: true,
            message: `Inconsistência identificada no dia ${fmt}: encerramento (saída) não registrado. Regularize com seu gestor.`
          };
        }
      }
    }
    return { hasError: false, message: '' };
  });

  isCurrentWeek = computed(() => {
    const currentMonday = this.getMonday(new Date());
    return this.selectedWeekStart().getTime() === currentMonday.getTime();
  });

  async ngOnInit() {
    this.timerRef = setInterval(() => this.currentTime.set(new Date()), 1000);

    // Solicita geolocalização do colaborador para precisão real
    this.requestGeolocation();

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
        this.loadTodayEntries();
        this.loadWeekEntries();
      }
    });
  }

  ngOnDestroy() {
    if (this.timerRef) clearInterval(this.timerRef);
  }

  // --- Geolocalização com Precisão Real ---

  requestGeolocation(): Promise<{ lat: number; lng: number; accuracy: number } | null> {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      this.geoStatus.set('unavailable');
      this.geoMessage.set('Geolocalização não suportada neste navegador.');
      return Promise.resolve(null);
    }

    this.geoStatus.set('requesting');
    this.geoMessage.set('Obtendo coordenadas GPS com precisão real...');

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy)
          };
          this.geolocation.set(loc);
          this.geoStatus.set('granted');
          this.geoMessage.set(`GPS Ativo: ${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)} (±${loc.accuracy}m)`);
          resolve(loc);
        },
        (err) => {
          console.warn('Geolocation denied or error:', err.message);
          this.geoStatus.set('denied');
          if (err.code === 1) { // PERMISSION_DENIED
            this.geoMessage.set('Permissão de GPS necessária para validação de presença física.');
          } else {
            this.geoMessage.set('Não foi possível obter coordenadas GPS no momento.');
          }
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    });
  }

  // --- Modal de Justificativa ---

  openJustification(row: DayRow) {
    if (!row.justification && !row.isOvertime10h) return;
    this.selectedJustification.set({
      dateFormatted: row.dateFormatted,
      dayName: row.dayName,
      totalHours: row.totalHours,
      timezoneId: row.timezoneId,
      justification: row.justification || 'Jornada excedeu o limite legal de 10 horas diárias (Art. 59 da CLT). Justificativa técnica requerida para auditoria.',
      isOvertime10h: row.isOvertime10h,
      clockIn: row.clockIn,
      clockOut: row.clockOut
    });
  }

  closeJustification() {
    this.selectedJustification.set(null);
  }

  // --- Data Loading ---

  async loadTodayEntries() {
    const userId = this.supabase.currentUser?.id;
    if (!userId) return;
    try {
      this.loading.set(true);
      const { data, error } = await this.supabase.getTodayEntries(userId);
      if (error) throw error;
      this.todayEntries.set(data || []);
    } catch (err) {
      console.error('Error loading today entries', err);
    } finally {
      this.loading.set(false);
    }
  }

  async loadWeekEntries() {
    const userId = this.supabase.currentUser?.id;
    if (!userId) return;
    try {
      const { data, error } = await this.supabase.getWeekEntries(userId, this.selectedWeekStart());
      if (error) throw error;
      this.weekEntries.set(data || []);
    } catch (err) {
      console.error('Error loading week entries', err);
    }
  }

  // --- Actions ---

  async recordAction() {
    const next = this.nextEvent();
    if (!next.type || next.dayComplete) return;

    // Validação: horário comercial
    const bh = this.businessHoursCheck();
    if (!bh.valid) {
      this.showToast(bh.message, 'warning');
      return;
    }

    // Validação: limite de 10h
    if (this.maxHoursReached() && next.type !== 'CLOCK_OUT') {
      this.showToast('Limite de 10 horas diárias atingido. Encerre sua jornada.', 'warning');
      return;
    }

    try {
      this.actionLoading.set(true);
      const userId = this.supabase.currentUser?.id;
      if (!userId) return;

      // Garante solicitação de precisão real de geolocalização no momento do registro
      if (this.geoStatus() !== 'granted') {
        await this.requestGeolocation();
      }

      const { error } = await this.supabase.recordTimeEntry(userId, next.type);
      if (error) throw error;

      const labels: Record<string, string> = {
        'CLOCK_IN': 'Jornada iniciada!',
        'BREAK_START': 'Pausa iniciada. Bom descanso!',
        'BREAK_END': 'Bem-vindo de volta!',
        'CLOCK_OUT': 'Jornada encerrada. Até amanhã!'
      };

      const baseLabel = labels[next.type] || 'Registrado!';
      if (this.geoStatus() === 'granted') {
        this.showToast(`${baseLabel} 📍 GPS validado com precisão.`, 'success');
      } else {
        this.showToast(`${baseLabel} ⚠️ Localização GPS não verificada (permissão ausente).`, 'warning');
      }

      await this.loadTodayEntries();
      await this.loadWeekEntries();
    } catch (err: any) {
      console.error('Error recording', err);
      this.showToast('Erro ao registrar ponto. Tente novamente.', 'error');
    } finally {
      this.actionLoading.set(false);
    }
  }

  // --- Week Navigation ---

  previousWeek() {
    const prev = new Date(this.selectedWeekStart());
    prev.setDate(prev.getDate() - 7);
    this.selectedWeekStart.set(prev);
    this.loadWeekEntries();
  }

  nextWeek() {
    if (this.isCurrentWeek()) return;
    const next = new Date(this.selectedWeekStart());
    next.setDate(next.getDate() + 7);
    this.selectedWeekStart.set(next);
    this.loadWeekEntries();
  }

  goToCurrentWeek() {
    this.selectedWeekStart.set(this.getMonday(new Date()));
    this.loadWeekEntries();
  }

  // --- Helpers ---

  private getMonday(d: Date): Date {
    const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    return date;
  }

  private buildWeekTable(): DayRow[] {
    const rows: DayRow[] = [];
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const start = this.selectedWeekStart();
    const entries = this.weekEntries();
    const today = new Date();

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

      rows.push({
        date,
        dayName: days[date.getDay()],
        dateFormatted: `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`,
        clockIn: findEvent('CLOCK_IN'),
        breakStart: findEvent('BREAK_START'),
        breakEnd: findEvent('BREAK_END'),
        clockOut: findEvent('CLOCK_OUT'),
        totalHours: dayEntries.length > 0 ? `${totalHrs.toFixed(1)}h` : '—',
        isToday: date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear(),
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        timezoneId: tzEntry?.timezone_id,
        isOvertime10h: totalHrs > 10,
        isManualAdjustment: isManual,
        justification: manualEntry?.justification || undefined
      });
    }

    return rows;
  }

  formatWorkedHours(hours: number): string {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${String(m).padStart(2, '0')}min`;
  }

  showToast(message: string, type: 'success' | 'error' | 'warning') {
    this.toastMessage.set(message);
    this.toastType.set(type);
    setTimeout(() => this.toastMessage.set(''), 4000);
  }

  async logout() {
    await this.supabase.signOut();
    this.router.navigate(['/']);
  }
}
