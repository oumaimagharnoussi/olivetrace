"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

/** Charge une ressource de l'API ; `recharger` relance l'appel après une modification, `chargeLe` date la dernière réponse. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargeLe, setChargeLe] = useState<Date | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!path) return;
    let annule = false;
    api<T>(path)
      .then((d) => {
        if (annule) return;
        setData(d);
        setChargeLe(new Date());
        setErreur(null);
      })
      .catch((e: Error) => !annule && setErreur(e.message));
    return () => {
      annule = true;
    };
  }, [path, version]);

  const recharger = useCallback(() => setVersion((v) => v + 1), []);
  return { data, erreur, recharger, chargeLe };
}
