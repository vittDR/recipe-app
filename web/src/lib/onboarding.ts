// Onboarding v2 (design/onboarding/HANDOFF.md): which install screen this
// browser gets, and the setup steps for a creator or a joiner.

import { useNavigate } from 'react-router';
import { isStandalone, pushSupported } from './push.ts';
import { useSession } from './session.tsx';
import { supabase } from './supabase.ts';

/** The four install screens: Safari 26+, Safari 18 and older, Chrome on iOS, anything else (sent to Safari). */
export type InstallVariant = 'safari26' | 'safari18' | 'chrome' | 'other';
export const INSTALL_VARIANTS: InstallVariant[] = ['safari26', 'safari18', 'chrome', 'other'];

/** The address people copy or open in Safari. */
export const APP_HOST = 'dineamite.pages.dev';

/** iPhone, iPod, or an iPad (which reports a Mac user agent but has touch). */
export function isIos(ua = navigator.userAgent, touchPoints = navigator.maxTouchPoints): boolean {
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);
}

/**
 * Which install screen, or null when there's nothing to install: already
 * opened from the Home Screen, or not on iOS (other platforms aren't designed).
 * Safari is read from its `Version/NN` token, not the iOS number: Safari 26
 * freezes "iPhone OS 18_6".
 */
export function installVariant(ua = navigator.userAgent, touchPoints = navigator.maxTouchPoints, standalone = isStandalone()): InstallVariant | null {
  if (standalone || !isIos(ua, touchPoints)) return null;
  if (/CriOS/.test(ua)) return 'chrome';
  if (/FxiOS|EdgiOS|OPiOS|GSA\/|FBAN|FBAV|Instagram|Line\/|Snapchat|WhatsApp|LinkedInApp|Twitter|MicroMessenger|Gmail/.test(ua)) return 'other';
  const version = /Version\/(\d+)/.exec(ua);
  if (/Safari\//.test(ua) && version) return Number(version[1]) >= 26 ? 'safari26' : 'safari18';
  // An in-app web view (no Safari token) can't add to the Home Screen.
  if (!/Safari\//.test(ua)) return 'other';
  return 'safari26';
}

export type SetupStep = 'diet' | 'no-eat' | 'weeknight' | 'goals' | 'week' | 'notifications' | 'quiz';

/**
 * The setup steps in order. Joiners skip the household settings the creator
 * already chose (weeknight, week); notifications need the installed app.
 */
export function setupSteps(creator: boolean, canPush = pushSupported()): SetupStep[] {
  const all: SetupStep[] = ['diet', 'no-eat', 'weeknight', 'goals', 'week', 'notifications', 'quiz'];
  return all.filter((s) => (creator || (s !== 'weeknight' && s !== 'week')) && (canPush || s !== 'notifications'));
}

export const stepPath = (s: SetupStep | 'done') => `/onboarding/${s}`;

/** This person's steps, where `step` sits in them, and how to move on. */
export function useSetup(step: SetupStep) {
  const { userId, household } = useSession();
  const navigate = useNavigate();
  const steps = setupSteps(!!household && household.owner_id === userId);
  const index = Math.max(0, steps.indexOf(step));
  const next = steps[index + 1] ?? 'done';
  return {
    index,
    count: steps.length,
    next: () => navigate(stepPath(next)),
  };
}

/** The last tap of onboarding: from now on the app opens on Ce soir. */
export async function finishOnboarding(userId: string) {
  await supabase.from('profiles').update({ onboarded_at: new Date().toISOString() }).eq('id', userId);
}
