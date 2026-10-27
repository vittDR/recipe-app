// Who is signed in, their profile, household and fellow members. Everything
// below the onboarding gate can assume all of these exist.

import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n/index.tsx';
import { supabase } from './supabase.ts';
import type { Household, Member, MemberGoals, Profile } from './types.ts';

interface SessionState {
  loading: boolean;
  session: Session | null;
  userId: string | null;
  profile: Profile | null;
  household: Household | null;
  members: Member[];
  goals: MemberGoals | null;
  /** Other members of the household. */
  partners: Member[];
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  memberName: (userId: string | null | undefined) => string;
  memberColor: (userId: string | null | undefined) => string;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [goals, setGoals] = useState<MemberGoals | null>(null);

  const userId = session?.user.id ?? null;

  const load = useCallback(async (uid: string | null) => {
    if (!uid) {
      setProfile(null);
      setHousehold(null);
      setMembers([]);
      setGoals(null);
      return;
    }
    const [p, m, g] = await Promise.all([
      supabase.from('profiles').select('id, first_name, color, locale').eq('id', uid).maybeSingle(),
      supabase.from('household_members').select('household_id').eq('user_id', uid).maybeSingle(),
      supabase.from('member_goals').select('*').eq('user_id', uid).maybeSingle(),
    ]);
    setProfile(p.data as Profile | null);
    setGoals(g.data as MemberGoals | null);

    const householdId = m.data?.household_id as string | undefined;
    if (!householdId) {
      setHousehold(null);
      setMembers([]);
      return;
    }
    const [h, ms] = await Promise.all([
      supabase.from('households').select('id, name, owner_id, timezone, store_name, prompt_time, reminder_time')
        .eq('id', householdId).single(),
      supabase.from('household_members').select('user_id, role, joined_at, profile:profiles(id, first_name, color, locale)')
        .eq('household_id', householdId).order('joined_at'),
    ]);
    setHousehold(h.data as Household | null);
    setMembers((ms.data ?? []) as unknown as Member[]);
  }, []);

  // Pushes are written in the profile's language: keep it in step with the app.
  useEffect(() => {
    if (profile && profile.locale !== locale) {
      void supabase.from('profiles').update({ locale }).eq('id', profile.id)
        .then(() => setProfile({ ...profile, locale }));
    }
  }, [profile, locale]);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await load(data.session?.user.id ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') void load(s?.user.id ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [load]);

  // Membership changes (partner joins, someone leaves) update live.
  useEffect(() => {
    if (!household) return;
    const channel = supabase
      .channel(`members:${household.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'household_members', filter: `household_id=eq.${household.id}` },
        () => void load(userId))
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [household, userId, load]);

  const value = useMemo<SessionState>(() => {
    const byId = new Map(members.map((m) => [m.user_id, m.profile]));
    return {
      loading,
      session,
      userId,
      profile,
      household,
      members,
      goals,
      partners: members.filter((m) => m.user_id !== userId),
      refresh: () => load(userId),
      signOut: async () => {
        await supabase.auth.signOut();
      },
      memberName: (id) => (id ? byId.get(id)?.first_name ?? '' : ''),
      memberColor: (id) => (id ? byId.get(id)?.color ?? 'var(--c-muted)' : 'var(--c-muted)'),
    };
  }, [loading, session, userId, profile, household, members, goals, load]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession outside SessionProvider');
  return ctx;
}
