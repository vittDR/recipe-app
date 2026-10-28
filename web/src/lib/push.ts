// Web Push: on iOS this works only once the app is added to the Home Screen.
import { supabase } from './supabase.ts';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIosBrowserTab(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) && !isStandalone();
}

export type PushState = 'unsupported' | 'denied' | 'off' | 'on';

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!VAPID_PUBLIC_KEY;
}

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Asks permission (must be called from a tap) and stores the subscription. */
export async function enablePush(userId: string): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
  await subscribe(userId);
  return 'on';
}

/**
 * On app start, for a phone that already allowed notifications: re-subscribes
 * when the subscription was made with another VAPID key (pushes to it would be
 * rejected), and stores it again in case the server dropped it.
 */
export async function syncPush(userId: string): Promise<void> {
  if (!pushSupported() || Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker.ready;
  if (!(await reg.pushManager.getSubscription())) return;
  await subscribe(userId);
}

async function subscribe(userId: string): Promise<void> {
  const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY!);
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub.options.applicationServerKey, key)) {
    await sub.unsubscribe();
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  const json = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert({
    endpoint: sub.endpoint,
    user_id: userId,
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
    user_agent: navigator.userAgent.slice(0, 200),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

function sameKey(a: ArrayBuffer | null, b: Uint8Array): boolean {
  if (!a) return true; // browser doesn't expose it: assume unchanged
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
}
