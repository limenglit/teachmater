import { useLanguage, LANGUAGES } from '@/contexts/LanguageContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe } from 'lucide-react';

export default function LanguageSelector() {
  const { lang, setLang } = useLanguage();
  const current = LANGUAGES.find(l => l.code === lang);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground flex items-center gap-1"
          title="Language"
        >
          <Globe className="w-5 h-5" />
          <span className="text-xs hidden sm:inline">{current?.flag}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        {LANGUAGES.map(l => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => setLang(l.code)}
            className={`flex items-center gap-2 cursor-pointer ${lang === l.code ? 'bg-muted font-medium' : ''}`}
          >
            <span>{l.flag}</span>
            <span>{l.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
