import { Sun, Moon, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme } from '@/context/ThemeContext'
import { THEMES } from '@/lib/theme'

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()

  const Icon =
    theme === 'system'
      ? Monitor
      : resolvedTheme === 'dark'
        ? Moon
        : Sun

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Toggle theme">
          <Icon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEMES.map((t) => {
          const ItemIcon =
            t.value === 'light' ? Sun : t.value === 'dark' ? Moon : Monitor
          return (
            <DropdownMenuItem
              key={t.value}
              onClick={() => setTheme(t.value)}
              className={theme === t.value ? 'bg-accent' : undefined}
            >
              <ItemIcon className="h-4 w-4" />
              {t.label}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
