import { useState, useEffect } from 'react';

export default function usePWADetection() {
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    setIsPWA(
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  }, []);

  return isPWA;
}