import * as React from "react"

/**
 * useIsMobile
 *
 * Détermine si la fenêtre courante est considérée comme "mobile" selon un point de rupture (breakpoint).
 * Conçu pour être:
 * - Flexible: accepte un breakpoint dynamique (par défaut 768px)
 * - Compatible SSR: retourne false côté serveur (pas d'accès à window)
 * - Performant: met à jour l'état via un listener de resize débouncé
 * - Lisible: logique utilitaire séparée et JSDoc complet
 *
 * @param {number} [breakpoint=768] - Largeur maximale en pixels en-dessous de laquelle on considère l'écran comme mobile
 * @returns {boolean} true si la largeur de la fenêtre est inférieure au breakpoint, false sinon
 *
 * @example
 * const isMobile = useIsMobile(); // breakpoint 768 par défaut
 * const isNarrow = useIsMobile(640); // breakpoint personnalisé
 */
export function useIsMobile(breakpoint: number = 768): boolean {
  // SSR-safe: window peut être indisponible
  const isClient = typeof window !== "undefined"

  // Fonction utilitaire pour calculer l'état mobile courant
  const computeIsMobile = React.useCallback(
    (bp: number) => (isClient ? window.innerWidth < bp : false),
    [isClient]
  )

  // État initial déterminé immédiatement pour éviter le flash de contenu
  const [isMobile, setIsMobile] = React.useState<boolean>(() => computeIsMobile(breakpoint))

  // Mettre à jour si le breakpoint change (rare mais possible)
  React.useEffect(() => {
    setIsMobile(computeIsMobile(breakpoint))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakpoint])

  // Listener de redimensionnement débouncé pour meilleures performances
  React.useEffect(() => {
    if (!isClient) return

    let timeoutId: number | null = null

    const handleResize = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }
      // Debounce ~120ms: fluide tout en limitant les re-renders
      timeoutId = window.setTimeout(() => {
        setIsMobile(computeIsMobile(breakpoint))
      }, 120)
    }

    // Définir la valeur immédiatement au montage
    setIsMobile(computeIsMobile(breakpoint))

    window.addEventListener("resize", handleResize)
    window.addEventListener("orientationchange", handleResize)

    return () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }
      window.removeEventListener("resize", handleResize)
      window.removeEventListener("orientationchange", handleResize)
    }
  }, [breakpoint, computeIsMobile, isClient])

  return isMobile
}
