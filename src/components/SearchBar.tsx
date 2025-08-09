import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Calendar } from '@/components/ui/calendar'
import { Slider } from '@/components/ui/slider'
import { useDebounce } from '@/hooks/useDebounce'
import { Search, X, Loader2, Clock, Filter, Tag as TagIcon, ChevronDown } from 'lucide-react'

export interface SearchSuggestion {
  id: string
  text: string
  type: 'memory' | 'tag' | 'category' | 'recent'
  icon?: string
  count?: number
}

export interface SearchFilters {
  dateRange?: [Date, Date]
  emotions?: string[]
  tags?: string[]
  hasAudio?: boolean
  minDuration?: number
}

export interface KeyboardShortcut {
  key: string
  action: 'focus' | 'toggleFilters'
}

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onSearch?: (query: string, filters?: SearchFilters) => void
  placeholder?: string
  className?: string
  suggestions?: SearchSuggestion[]
  recentSearches?: string[]
  showFilters?: boolean
  debounceMs?: number
  minQueryLength?: number
  maxSuggestions?: number
  loading?: boolean
  error?: string
  onClear?: () => void
  shortcuts?: KeyboardShortcut[]
}

export const SearchBar = ({
  value,
  onChange,
  onSearch,
  placeholder = 'Rechercher dans vos mémoires…',
  className = '',
  suggestions = [],
  recentSearches = [],
  showFilters = false,
  debounceMs = 300,
  minQueryLength = 2,
  maxSuggestions = 8,
  loading = false,
  error,
  onClear,
  shortcuts = [
    { key: 'cmd+k', action: 'focus' },
    { key: 'ctrl+k', action: 'focus' },
    { key: 'cmd+/', action: 'toggleFilters' },
    { key: 'ctrl+/', action: 'toggleFilters' },
  ],
}: SearchBarProps) => {
  const [isFocused, setIsFocused] = useState(false)
  const [openFilters, setOpenFilters] = useState(showFilters)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [filters, setFilters] = useState<SearchFilters>({})
  const inputRef = useRef<HTMLInputElement | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  const debouncedQuery = useDebounce(value, debounceMs)

  // Derived suggestions (limit + categories)
  const limitedSuggestions = useMemo(() => suggestions.slice(0, maxSuggestions), [suggestions, maxSuggestions])

  // Fire onSearch with debounce
  useEffect(() => {
    if (!onSearch) return
    if ((debouncedQuery || '').length >= minQueryLength) onSearch(debouncedQuery, filters)
  }, [debouncedQuery, filters, minQueryLength, onSearch])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const combo = `${e.metaKey || e.ctrlKey ? (e.metaKey ? 'cmd' : 'ctrl') : ''}${(e.metaKey || e.ctrlKey) ? '+' : ''}${e.key.toLowerCase()}`
      const match = shortcuts.find((s) => s.key === combo)
      if (!match) return
      e.preventDefault()
      if (match.action === 'focus') inputRef.current?.focus()
      if (match.action === 'toggleFilters') setOpenFilters((v) => !v)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcuts])

  // Click outside for suggestions
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!dropdownRef.current) return
      if (!dropdownRef.current.contains(e.target as Node) && !inputRef.current?.contains(e.target as Node)) {
        setShowSuggestions(false)
        setSelectedIndex(-1)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const handleClear = useCallback(() => {
    onChange('')
    onClear?.()
    setSelectedIndex(-1)
    setShowSuggestions(false)
  }, [onChange, onClear])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showSuggestions) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, limitedSuggestions.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        if (selectedIndex >= 0 && limitedSuggestions[selectedIndex]) {
          onChange(limitedSuggestions[selectedIndex].text)
          setShowSuggestions(false)
          inputRef.current?.blur()
        } else if (value.length >= minQueryLength) {
          onSearch?.(value, filters)
          setShowSuggestions(false)
        }
      } else if (e.key === 'Escape') {
        setShowSuggestions(false)
        setSelectedIndex(-1)
      }
    },
    [showSuggestions, limitedSuggestions, selectedIndex, value, minQueryLength, filters, onChange, onSearch]
  )

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </div>
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            setIsFocused(true)
            if (suggestions.length > 0) setShowSuggestions(true)
          }}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          className={`pl-10 pr-24 transition-all duration-200 ${isFocused ? 'ring-2 ring-accent shadow-lg' : ''}`}
          aria-expanded={showSuggestions}
          role="combobox"
          aria-autocomplete="list"
        />

        {/* Right controls */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpenFilters((v) => !v)}
            className="h-7 px-2 text-muted-foreground hover:text-foreground"
            aria-label="Filtres"
          >
            <Filter className="w-4 h-4" />
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-7 w-7 p-0 hover:bg-muted"
              aria-label="Effacer la recherche"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Suggestions */}
      {showSuggestions && (limitedSuggestions.length > 0 || recentSearches.length > 0) && (
        <div ref={dropdownRef} className="absolute z-20 mt-2 w-full">
          <Card className="shadow-lg">
            <CardContent className="p-2 max-h-[320px] overflow-auto">
              {recentSearches.length > 0 && (
                <div className="mb-1">
                  <div className="px-2 py-1 text-xs text-muted-foreground">Récents</div>
                  {recentSearches.map((q, idx) => (
                    <button
                      key={`r-${idx}`}
                      className={`w-full text-left px-2 py-2 rounded-md hover:bg-muted flex items-center gap-2 ${selectedIndex === idx ? 'bg-muted' : ''}`}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        onChange(q)
                        setShowSuggestions(false)
                      }}
                    >
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="truncate">{q}</span>
                    </button>
                  ))}
                </div>
              )}

              {limitedSuggestions.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-xs text-muted-foreground">Suggestions</div>
                  {limitedSuggestions.map((s, idx) => (
                    <button
                      key={s.id}
                      className={`w-full text-left px-2 py-2 rounded-md hover:bg-muted flex items-center gap-2 ${selectedIndex === idx ? 'bg-muted' : ''}`}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        onChange(s.text)
                        setShowSuggestions(false)
                      }}
                    >
                      {s.type === 'tag' ? (
                        <TagIcon className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Search className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="truncate">{s.text}</span>
                      {typeof s.count === 'number' && (
                        <span className="ml-auto text-xs text-muted-foreground">{s.count}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Collapsible open={openFilters} onOpenChange={setOpenFilters}>
        <CollapsibleTrigger asChild>
          <div className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <ChevronDown className={`w-4 h-4 transition-transform ${openFilters ? 'rotate-180' : ''}`} />
            Afficher les filtres
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="mt-2">
            <CardContent className="p-4 grid gap-4 md:grid-cols-3">
              {/* Date range */}
              <div>
                <div className="text-sm font-medium mb-2">Période</div>
                <Calendar
                  mode="range"
                  selected={filters.dateRange as any}
                  onSelect={(range: any) => setFilters((f) => ({ ...f, dateRange: range } as any))}
                  className="p-3 pointer-events-auto"
                />
              </div>

              {/* Emotions */}
              <div>
                <div className="text-sm font-medium mb-2">Émotions</div>
                <div className="flex flex-wrap gap-2">
                  {['joyeux', 'triste', 'neutre', 'passionné', 'énergique'].map((e) => {
                    const active = filters.emotions?.includes(e)
                    return (
                      <Button
                        key={e}
                        type="button"
                        size="sm"
                        variant={active ? 'default' : 'secondary'}
                        onClick={() =>
                          setFilters((f) => ({
                            ...f,
                            emotions: active
                              ? (f.emotions || []).filter((x) => x !== e)
                              : [...(f.emotions || []), e],
                          }))
                        }
                      >
                        {e}
                      </Button>
                    )
                  })}
                </div>
              </div>

              {/* Duration */}
              <div>
                <div className="text-sm font-medium mb-2">Durée minimum</div>
                <Slider
                  defaultValue={[filters.minDuration || 0]}
                  max={600}
                  step={10}
                  onValueChange={([v]) => setFilters((f) => ({ ...f, minDuration: v }))}
                />
                <div className="mt-1 text-xs text-muted-foreground">{Math.round((filters.minDuration || 0) / 60)} min</div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Helper text */}
      {value && (
        <div className="absolute top-full left-0 right-0 mt-1 text-xs text-muted-foreground">
          Recherche active pour "{value}"
        </div>
      )}
    </div>
  )
}