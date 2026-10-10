import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

const SUPABASE_URL = environment.supabaseUrl;
const SUPABASE_KEY = environment.supabaseKey;

export type EventType = 'CLOCK_IN' | 'BREAK_START' | 'BREAK_END' | 'CLOCK_OUT';
export type UserRole = 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN';

export interface UserProfile {
  id: string;
  full_name: string;
  role: UserRole;
  manager_id: string | null;
  email?: string;
}

export interface TimeEntry {
  id: string;
  user_id: string;
  event_type: EventType;
  timestamp_utc: string;
  timezone_offset: number;
  timezone_id: string;
  is_manual_adjustment: boolean;
  justification: string | null;
  status: string;
  created_at: string;
}

// Máquina de estados: define a transição válida a partir do último evento
const STATE_MACHINE: Record<EventType | 'NONE', EventType> = {
  'NONE': 'CLOCK_IN',
  'CLOCK_IN': 'BREAK_START',
  'BREAK_START': 'BREAK_END',
  'BREAK_END': 'CLOCK_OUT',
  'CLOCK_OUT': 'CLOCK_IN' // Novo dia
};

const EVENT_LABELS: Record<EventType, string> = {
  'CLOCK_IN': 'Iniciar Jornada',
  'BREAK_START': 'Iniciar Pausa',
  'BREAK_END': 'Retornar da Pausa',
  'CLOCK_OUT': 'Encerrar Jornada'
};

const EVENT_ICONS: Record<EventType, string> = {
  'CLOCK_IN': '☀️',
  'BREAK_START': '☕',
  'BREAK_END': '✅',
  'CLOCK_OUT': '🌙'
};

const EVENT_COLORS: Record<EventType, string> = {
  'CLOCK_IN': 'primary',
  'BREAK_START': 'warning',
  'BREAK_END': 'success',
  'CLOCK_OUT': 'danger'
};

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;
  private _currentUser = new BehaviorSubject<User | null>(null);
  private _profile = new BehaviorSubject<UserProfile | null>(null);

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    this.supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user ?? null;
      this._currentUser.next(user);
      if (user) this.fetchProfileAsync(user.id);
    });

    this.supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      this._currentUser.next(user);
      if (user) {
        this.fetchProfileAsync(user.id);
      } else {
        this._profile.next(null);
      }
    });
  }

  // --- Auth Getters ---
  get currentUser$(): Observable<User | null> { return this._currentUser.asObservable(); }
  get currentUser(): User | null { return this._currentUser.value; }
  get profile$(): Observable<UserProfile | null> { return this._profile.asObservable(); }
  get profile(): UserProfile | null { return this._profile.value; }

  // --- Auth Methods ---
  async getSession() {
    const { data, error } = await this.supabase.auth.getSession();
    return data.session;
  }

  async signIn(email: string, password: string) {
    return this.supabase.auth.signInWithPassword({ email, password });
  }

  async signOut() {
    this._profile.next(null);
    return this.supabase.auth.signOut();
  }

  // --- Profile Methods ---
  getUserRole(user?: User | null): UserRole {
    if (!user) {
      user = this._currentUser.value;
    }
    if (this._profile.value?.role) {
      return this._profile.value.role;
    }
    const roleFromMeta = (user?.app_metadata?.['role'] || user?.user_metadata?.['role']) as UserRole | undefined;
    if (roleFromMeta === 'HR_ADMIN' || roleFromMeta === 'MANAGER' || roleFromMeta === 'EMPLOYEE') {
      return roleFromMeta;
    }
    return 'EMPLOYEE';
  }

  async fetchProfileAsync(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        const profile: UserProfile = {
          ...data,
          email: this._currentUser.value?.email
        };
        this._profile.next(profile);
        return profile;
      }
    } catch (err) {
      console.warn('Tentativa de busca do perfil no banco disparou exceção:', err);
    }

    // Fallback resiliente usando metadata assinado da sessão Auth
    const user = this._currentUser.value;
    if (user && user.id === userId) {
      const role = this.getUserRole(user);
      const fullName = user.user_metadata?.['full_name'] || user.email?.split('@')[0] || 'Usuário';
      const fallbackProfile: UserProfile = {
        id: user.id,
        full_name: fullName,
        role: role,
        manager_id: null,
        email: user.email
      };
      this._profile.next(fallbackProfile);
      return fallbackProfile;
    }
    return null;
  }

  // --- State Machine Helpers (Exportados para uso nos componentes) ---
  static getStateMachine() { return STATE_MACHINE; }
  static getEventLabels() { return EVENT_LABELS; }
  static getEventIcons() { return EVENT_ICONS; }
  static getEventColors() { return EVENT_COLORS; }

  // --- Business Rules ---

  /**
   * Valida se o horário atual está dentro do expediente.
   * Regra: Seg-Sex, 09:00–17:00 (hora local do colaborador).
   */
  isWithinBusinessHours(): { valid: boolean; message: string } {
    const now = new Date();
    const day = now.getDay(); // 0=Dom, 6=Sab
    const hours = now.getHours();

    if (day === 0 || day === 6) {
      return { valid: false, message: 'Registros de ponto não são permitidos aos finais de semana.' };
    }
    if (hours < 9 || hours >= 17) {
      return { valid: false, message: `Fora do horário de trabalho (09:00–17:00). Horário atual: ${String(hours).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}.` };
    }
    return { valid: true, message: '' };
  }

  /**
   * Calcula o total de horas trabalhadas no dia a partir dos eventos.
   * Lógica: soma os intervalos entre CLOCK_IN→BREAK_START e BREAK_END→CLOCK_OUT.
   */
  calculateWorkedHours(entries: TimeEntry[]): number {
    const validEntries = entries
      .filter(e => e.status === 'VALID')
      .sort((a, b) => new Date(a.timestamp_utc).getTime() - new Date(b.timestamp_utc).getTime());

    let totalMs = 0;
    let workStart: Date | null = null;

    for (const entry of validEntries) {
      const ts = new Date(entry.timestamp_utc);
      switch (entry.event_type) {
        case 'CLOCK_IN':
        case 'BREAK_END':
          workStart = ts;
          break;
        case 'BREAK_START':
        case 'CLOCK_OUT':
          if (workStart) {
            totalMs += ts.getTime() - workStart.getTime();
            workStart = null;
          }
          break;
      }
    }

    // Se está trabalhando agora (workStart sem par), conta até agora
    if (workStart) {
      totalMs += Date.now() - workStart.getTime();
    }

    return totalMs / (1000 * 60 * 60); // Retorna em horas decimais
  }

  /**
   * Determina o próximo evento válido baseado no último evento do dia.
   */
  getNextEvent(entries: TimeEntry[]): { type: EventType | null; label: string; icon: string; color: string; dayComplete: boolean } {
    const todayValid = entries.filter(e => e.status === 'VALID');

    if (todayValid.length === 0) {
      return {
        type: 'CLOCK_IN',
        label: EVENT_LABELS['CLOCK_IN'],
        icon: EVENT_ICONS['CLOCK_IN'],
        color: EVENT_COLORS['CLOCK_IN'],
        dayComplete: false
      };
    }

    const lastEntry = todayValid[todayValid.length - 1];
    const lastType = lastEntry.event_type as EventType;

    // Se já bateu CLOCK_OUT, jornada encerrada
    if (lastType === 'CLOCK_OUT') {
      return {
        type: null,
        label: 'Jornada Encerrada',
        icon: '✓',
        color: 'completed',
        dayComplete: true
      };
    }

    const nextType = STATE_MACHINE[lastType];
    return {
      type: nextType,
      label: EVENT_LABELS[nextType],
      icon: EVENT_ICONS[nextType],
      color: EVENT_COLORS[nextType],
      dayComplete: false
    };
  }

  // --- Data Methods ---

  async recordTimeEntry(userId: string, eventType: EventType) {
    const timezoneId = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timezoneOffset = new Date().getTimezoneOffset();

    return this.supabase.from('time_entries').insert({
      user_id: userId,
      event_type: eventType,
      timestamp_utc: new Date().toISOString(),
      timezone_id: timezoneId,
      timezone_offset: timezoneOffset
    }).select();
  }

  async getTodayEntries(userId: string) {
    // Calcula o início do dia LOCAL do usuário convertido para UTC
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    return this.supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'VALID')
      .gte('timestamp_utc', startOfDay.toISOString())
      .order('timestamp_utc', { ascending: true });
  }

  async getWeekEntries(userId: string, weekStartDate: Date) {
    const weekEnd = new Date(weekStartDate);
    weekEnd.setDate(weekEnd.getDate() + 7);

    return this.supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'VALID')
      .gte('timestamp_utc', weekStartDate.toISOString())
      .lt('timestamp_utc', weekEnd.toISOString())
      .order('timestamp_utc', { ascending: true });
  }

  // --- Manager Methods ---
  async getTeamProfiles() {
    return this.supabase
      .from('profiles')
      .select('*')
      .eq('manager_id', this.currentUser?.id);
  }

  async getTeamEntries(userIds: string[], weekStartDate: Date) {
    const weekEnd = new Date(weekStartDate);
    weekEnd.setDate(weekEnd.getDate() + 7);

    return this.supabase
      .from('time_entries')
      .select('*, profiles!inner(full_name)')
      .in('user_id', userIds)
      .eq('status', 'VALID')
      .gte('timestamp_utc', weekStartDate.toISOString())
      .lt('timestamp_utc', weekEnd.toISOString())
      .order('timestamp_utc', { ascending: true });
  }

  // --- HR Methods ---
  async getAllProfiles() {
    return this.supabase.from('profiles').select('*');
  }

  async getAllEntriesForPeriod(startDate: Date, endDate: Date) {
    return this.supabase
      .from('time_entries')
      .select('*, profiles!inner(full_name)')
      .eq('status', 'VALID')
      .gte('timestamp_utc', startDate.toISOString())
      .lt('timestamp_utc', endDate.toISOString())
      .order('timestamp_utc', { ascending: true });
  }

  async getPeriodStatus(referenceMonth: Date) {
    const monthStr = referenceMonth.toISOString().split('T')[0];
    return this.supabase
      .from('closing_periods')
      .select('*')
      .eq('reference_month', monthStr)
      .maybeSingle();
  }

  async closePeriod(referenceMonth: Date) {
    return this.supabase.from('closing_periods').insert({
      reference_month: referenceMonth.toISOString().split('T')[0],
      status: 'CLOSED',
      closed_by: this.currentUser?.id,
      closed_at: new Date().toISOString()
    });
  }
}
