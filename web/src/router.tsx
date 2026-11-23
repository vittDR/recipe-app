import { useRef } from 'react';
import { createBrowserRouter, Navigate, NavLink, Outlet, useLocation } from 'react-router';
import { Icon } from './components/Icon.tsx';
import { ConfirmHost, Spinner, ToastHost } from './components/ui.tsx';
import { useI18n } from './i18n/index.tsx';
import { enableNavMotion, useNavDirection } from './lib/navMotion.ts';
import { useScrollMemory } from './lib/scrollMemory.ts';
import { useSession } from './lib/session.tsx';
import { AccountScreen } from './screens/onboarding/Account.tsx';
import { DietScreen } from './screens/onboarding/Diet.tsx';
import { DoneScreen } from './screens/onboarding/Done.tsx';
import { EquipmentScreen } from './screens/onboarding/Equipment.tsx';
import { GoalsScreen } from './screens/onboarding/Goals.tsx';
import { HouseholdScreen } from './screens/onboarding/Household.tsx';
import { HouseholdNameScreen } from './screens/onboarding/HouseholdName.tsx';
import { InstallScreen } from './screens/onboarding/Install.tsx';
import { InviteScreen } from './screens/onboarding/Invite.tsx';
import { JoinScreen } from './screens/onboarding/Join.tsx';
import { LandingScreen } from './screens/onboarding/Landing.tsx';
import { NoEatScreen } from './screens/onboarding/NoEat.tsx';
import { NotifyScreen } from './screens/onboarding/Notify.tsx';
import { ProfileScreen } from './screens/onboarding/Profile.tsx';
import { TasteQuizScreen } from './screens/onboarding/TasteQuiz.tsx';
import { TastesScreen } from './screens/onboarding/Tastes.tsx';
import { WeekScreen } from './screens/onboarding/Week.tsx';
import { WeeknightScreen } from './screens/onboarding/Weeknight.tsx';
import { DeckScreen } from './screens/deck/Deck.tsx';
import { GroceriesScreen } from './screens/Groceries.tsx';
import { ImportScreen } from './screens/recipes/Import.tsx';
import { CookingScreen } from './screens/recipes/Cooking.tsx';
import { RecipeScreen } from './screens/recipes/Recipe.tsx';
import { RecipesScreen } from './screens/recipes/Recipes.tsx';
import { CatalogScreen } from './screens/Catalog.tsx';
import { NotificationsScreen } from './screens/Notifications.tsx';
import { PlanScreen } from './screens/Plan.tsx';
import { ProfileSettingsScreen } from './screens/ProfileSettings.tsx';
import { SettingsScreen } from './screens/Settings.tsx';
import { TonightScreen } from './screens/Tonight.tsx';
import { UsScreen } from './screens/Us.tsx';

const PUBLIC = ['/welcome', '/install', '/signin', '/join'];

const startsWithAny = (path: string, list: string[]) => list.some((p) => path === p || path.startsWith(`${p}/`));

/**
 * Sends people to the first onboarding step they haven't finished
 * (design/onboarding/HANDOFF.md): landing and install signed out, then a
 * first name if the account came without one, a household, and the setup
 * steps until Done stamps profiles.onboarded_at. Each state allows the screens
 * around it, so a step can save, refresh and move on (or go back) without the
 * gate bouncing it somewhere else mid-way.
 */
function Gate() {
  const { loading, session, profile, household } = useSession();
  const { pathname } = useLocation();
  const scroller = useRef<HTMLDivElement>(null);
  useNavDirection();
  useScrollMemory(scroller);

  let target: string | null = null;
  if (!loading) {
    if (!session) {
      if (!startsWithAny(pathname, PUBLIC)) target = '/welcome';
    } else if (!profile?.first_name) {
      if (pathname !== '/onboarding/profile') target = '/onboarding/profile';
    } else if (!household) {
      if (!startsWithAny(pathname, ['/onboarding/profile', '/onboarding/household', '/join'])) target = '/onboarding/household';
    } else if (!profile.onboarded_at) {
      // A returning user with a household skips to Ce soir; anyone else finishes setting up.
      if (!startsWithAny(pathname, ['/onboarding', '/join'])) target = '/onboarding/diet';
    } else if (startsWithAny(pathname, ['/welcome', '/install', '/signin', '/onboarding', '/join'])) {
      target = '/';
    }
  }

  return (
    <div className="scroller" ref={scroller}>
      <div className="app">
        {loading ? <Spinner /> : target && target !== pathname ? <Navigate to={target} replace /> : <Outlet />}
        <ToastHost />
        <ConfirmHost />
      </div>
    </div>
  );
}

function Tabs() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const tabs = [
    { to: '/', icon: 'bowlSteam', label: t('tabs.tonight') },
    { to: '/recipes', icon: 'book', label: t('tabs.recipes') },
    { to: '/groceries', icon: 'basket', label: t('tabs.groceries') },
    { to: '/us', icon: 'people', label: t('tabs.us') },
  ] as const;
  return (
    <>
      <Outlet />
      <nav className="tabbar" aria-label="Main">
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.to === '/'}
            className={({ isActive }) => (isActive || (tab.to === '/' && pathname.startsWith('/deck/')) ? 'active' : undefined)}>
            <Icon name={tab.icon} />
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}

export const router = createBrowserRouter([
  {
    element: <Gate />,
    children: [
      { path: '/welcome', element: <LandingScreen /> },
      { path: '/install', element: <InstallScreen /> },
      { path: '/signin', element: <AccountScreen /> },
      { path: '/join/:code?', element: <JoinScreen /> },
      { path: '/onboarding/profile', element: <ProfileScreen /> },
      { path: '/onboarding/household', element: <HouseholdScreen /> },
      { path: '/onboarding/household/name', element: <HouseholdNameScreen /> },
      { path: '/onboarding/invite', element: <InviteScreen /> },
      { path: '/onboarding/diet', element: <DietScreen /> },
      { path: '/onboarding/no-eat', element: <NoEatScreen /> },
      { path: '/onboarding/weeknight', element: <WeeknightScreen /> },
      { path: '/onboarding/goals', element: <GoalsScreen /> },
      { path: '/onboarding/week', element: <WeekScreen /> },
      { path: '/onboarding/notifications', element: <NotifyScreen /> },
      { path: '/onboarding/equipment', element: <EquipmentScreen /> },
      { path: '/onboarding/quiz', element: <TasteQuizScreen /> },
      { path: '/onboarding/done', element: <DoneScreen /> },
      { path: '/onboarding/tastes', element: <Navigate to="/onboarding/diet" replace /> },
      {
        element: <Tabs />,
        children: [
          { path: '/', element: <TonightScreen /> },
          { path: '/recipes', element: <RecipesScreen /> },
          { path: '/groceries', element: <GroceriesScreen /> },
          { path: '/us', element: <UsScreen /> },
          // Swiping keeps the tab bar; moments (match, tie-break) hide it.
          { path: '/deck/:id', element: <DeckScreen /> },
        ],
      },
      { path: '/recipes/new', element: <ImportScreen /> },
      { path: '/recipes/:id', element: <RecipeScreen /> },
      { path: '/recipes/:id/cook', element: <CookingScreen /> },
      { path: '/us/preferences', element: <UsScreen view="preferences" /> },
      { path: '/us/goals', element: <GoalsScreen editing /> },
      { path: '/us/tastes', element: <TastesScreen editing /> },
      { path: '/us/quiz', element: <TasteQuizScreen editing /> },
      { path: '/us/notifications', element: <NotificationsScreen /> },
      { path: '/us/catalog', element: <CatalogScreen /> },
      { path: '/us/profile', element: <ProfileSettingsScreen /> },
      { path: '/us/invite', element: <InviteScreen editing /> },
      { path: '/us/plan', element: <PlanScreen /> },
      { path: '/us/household', element: <SettingsScreen /> },
      // Older addresses, from before these moved under Us.
      { path: '/invite', element: <Navigate to="/us/invite" replace /> },
      { path: '/plan', element: <Navigate to="/" replace /> },
      { path: '/settings', element: <Navigate to="/us/household" replace /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

enableNavMotion(router);
