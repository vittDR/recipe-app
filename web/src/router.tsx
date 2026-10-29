import { createBrowserRouter, Navigate, NavLink, Outlet, useLocation } from 'react-router';
import { Icon } from './components/Icon.tsx';
import { ConfirmHost, Spinner, ToastHost } from './components/ui.tsx';
import { useI18n } from './i18n/index.tsx';
import { useSession } from './lib/session.tsx';
import { AccountScreen } from './screens/onboarding/Account.tsx';
import { GoalsScreen } from './screens/onboarding/Goals.tsx';
import { HouseholdScreen } from './screens/onboarding/Household.tsx';
import { InviteScreen } from './screens/onboarding/Invite.tsx';
import { JoinScreen } from './screens/onboarding/Join.tsx';
import { ProfileScreen } from './screens/onboarding/Profile.tsx';
import { TastesScreen } from './screens/onboarding/Tastes.tsx';
import { WelcomeScreen } from './screens/onboarding/Welcome.tsx';
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

const PUBLIC = ['/welcome', '/signin', '/join'];

const startsWithAny = (path: string, list: string[]) => list.some((p) => path === p || path.startsWith(`${p}/`));

/**
 * Sends people to the first onboarding step they haven't finished. Each state
 * allows the screens around it, so a step can save, refresh and move on
 * without the gate bouncing it somewhere else mid-way.
 */
function Gate() {
  const { loading, session, profile, household, goals } = useSession();
  const { pathname } = useLocation();

  let target: string | null = null;
  if (!loading) {
    if (!session) {
      if (!startsWithAny(pathname, PUBLIC)) target = '/welcome';
    } else if (!profile?.first_name) {
      if (pathname !== '/onboarding/profile') target = '/onboarding/profile';
    } else if (!household) {
      if (!startsWithAny(pathname, ['/onboarding/profile', '/onboarding/household', '/join'])) target = '/onboarding/household';
    } else if (!goals) {
      if (!startsWithAny(pathname, ['/onboarding', '/join'])) target = '/onboarding/goals';
    } else if (startsWithAny(pathname, ['/welcome', '/signin', '/onboarding/profile', '/onboarding/household'])) {
      target = '/';
    }
  }

  return (
    <div className="app">
      {loading ? <Spinner /> : target && target !== pathname ? <Navigate to={target} replace /> : <Outlet />}
      <ToastHost />
      <ConfirmHost />
    </div>
  );
}

function Tabs() {
  const { t } = useI18n();
  const tabs = [
    { to: '/', icon: 'bowl', label: t('tabs.tonight') },
    { to: '/recipes', icon: 'book', label: t('tabs.recipes') },
    { to: '/groceries', icon: 'cart', label: t('tabs.groceries') },
    { to: '/us', icon: 'people', label: t('tabs.us') },
  ] as const;
  return (
    <>
      <Outlet />
      <nav className="tabbar" aria-label="Main">
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.to === '/'}>
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
      { path: '/welcome', element: <WelcomeScreen /> },
      { path: '/signin', element: <AccountScreen /> },
      { path: '/join/:code?', element: <JoinScreen /> },
      { path: '/onboarding/profile', element: <ProfileScreen /> },
      { path: '/onboarding/household', element: <HouseholdScreen /> },
      { path: '/onboarding/invite', element: <InviteScreen /> },
      { path: '/onboarding/goals', element: <GoalsScreen /> },
      { path: '/onboarding/tastes', element: <TastesScreen /> },
      {
        element: <Tabs />,
        children: [
          { path: '/', element: <TonightScreen /> },
          { path: '/recipes', element: <RecipesScreen /> },
          { path: '/groceries', element: <GroceriesScreen /> },
          { path: '/us', element: <UsScreen /> },
        ],
      },
      { path: '/deck/:id', element: <DeckScreen /> },
      { path: '/recipes/new', element: <ImportScreen /> },
      { path: '/recipes/:id', element: <RecipeScreen /> },
      { path: '/recipes/:id/cook', element: <CookingScreen /> },
      { path: '/us/goals', element: <GoalsScreen editing /> },
      { path: '/us/tastes', element: <TastesScreen editing /> },
      { path: '/us/notifications', element: <NotificationsScreen /> },
      { path: '/us/catalog', element: <CatalogScreen /> },
      { path: '/us/profile', element: <ProfileSettingsScreen /> },
      { path: '/us/invite', element: <InviteScreen editing /> },
      { path: '/us/plan', element: <PlanScreen /> },
      { path: '/us/household', element: <SettingsScreen /> },
      // Older addresses, from before these moved under Us.
      { path: '/invite', element: <Navigate to="/us/invite" replace /> },
      { path: '/plan', element: <Navigate to="/us/plan" replace /> },
      { path: '/settings', element: <Navigate to="/us/household" replace /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
