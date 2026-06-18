import { useApp, ACTIONS } from '../../context/AppContext';
import { Sun01Icon, MoonIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Button } from '../ui/button';

export default function Header() {
  const { state, dispatch } = useApp();
  const { theme } = state.settings;
  const isDark = theme === 'dark';

  const toggleTheme = () => {
    dispatch({ type: ACTIONS.SET_THEME, payload: isDark ? 'light' : 'dark' });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 no-print">
      <div className="flex h-12 items-center justify-between px-4">
        {/* Brand */}
        <img src="/logo.svg" alt="Edgecut logo" className="h-5 w-auto" />
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          onClick={toggleTheme}
          title={isDark ? 'Switch to light' : 'Switch to dark'}
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {isDark ? <HugeiconsIcon icon={Sun01Icon} size={16} /> : <HugeiconsIcon icon={MoonIcon} size={16} />}
        </Button>
      </div>
    </header>
  );
}
