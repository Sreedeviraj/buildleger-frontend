import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { buttonClass } from './Button';

export type MenuItem =
  | { label: string; icon?: LucideIcon; to: string; external?: boolean; danger?: boolean }
  | { label: string; icon?: LucideIcon; onSelect: () => void; danger?: boolean };

/** Small dropdown menu (Add ▾, Actions ▾). Closes on outside click and Escape. */
export function Menu({ label, items, variant = 'secondary', icon }: { label: ReactNode; items: MenuItem[]; variant?: 'primary' | 'secondary'; icon?: LucideIcon }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const Icon = icon;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const itemClass = (danger?: boolean) =>
    `flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-slate-50 ${danger ? 'text-red-700' : 'text-slate-800'}`;

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} className={buttonClass(variant, 'md', 'min-h-9')}>
        {Icon && <Icon className="size-4" aria-hidden />}
        {label}
        <ChevronDown className="size-4 opacity-70" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-1 min-w-52 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {items.map((item) => {
            const ItemIcon = item.icon;
            const content = (
              <>
                {ItemIcon && <ItemIcon className="size-4 shrink-0 text-slate-500" aria-hidden />}
                {item.label}
              </>
            );
            if ('to' in item) {
              return item.external ? (
                <a key={item.label} role="menuitem" href={item.to} target="_blank" rel="noreferrer" className={itemClass(item.danger)} onClick={() => setOpen(false)}>
                  {content}
                </a>
              ) : (
                <Link key={item.label} role="menuitem" to={item.to} className={itemClass(item.danger)} onClick={() => setOpen(false)}>
                  {content}
                </Link>
              );
            }
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={itemClass(item.danger)}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
