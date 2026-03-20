import { useState, useCallback } from 'react';
import * as Location from 'expo-location';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface Coordinates {
  latitude: number;
  longitude: number;
}

interface LocationResult {
  coords: Coordinates;
  address: string | null;
}

interface UseLocationReturn {
  location: Coordinates | null;
  address: string | null;
  loading: boolean;
  error: string | null;
  requestLocation: () => Promise<LocationResult | null>;
}

// ──────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────

export function useLocation(): UseLocationReturn {
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(async (): Promise<LocationResult | null> => {
    setLoading(true);
    setError(null);

    try {
      // Request foreground permission
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setError(
          'Permissao de localizacao negada. Habilite nas configuracoes do dispositivo.',
        );
        setLoading(false);
        return null;
      }

      // Get current position
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const coords: Coordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      setLocation(coords);

      // Reverse geocode to get a human-readable address
      let resolvedAddress: string | null = null;
      try {
        const [geo] = await Location.reverseGeocodeAsync(coords);

        if (geo) {
          const parts = [
            geo.street,
            geo.streetNumber,
            geo.district,
            geo.city,
            geo.region,
          ].filter(Boolean);

          resolvedAddress = parts.join(', ');
          setAddress(resolvedAddress);
        }
      } catch {
        // Reverse geocoding failed – coordinates are still available
        setAddress(null);
      }

      return { coords, address: resolvedAddress };
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Erro ao obter localizacao. Tente novamente.';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { location, address, loading, error, requestLocation };
}
