import type { Session } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";

import { supabase } from "@/src/lib/supabase";
import type { Profile } from "@/src/types";

WebBrowser.maybeCompleteAuthSession();

interface AuthCtx {
  session: Session | null;
  loading: boolean;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}
const Ctx = createContext<AuthCtx>({} as AuthCtx);
export const useAuth = () => useContext(Ctx);

/** Parse access/refresh tokens from a Supabase OAuth redirect URL. */
function tokensFromUrl(url: string): { access_token?: string; refresh_token?: string } {
  const out: Record<string, string> = {};
  const push = (raw: string) => {
    for (const part of raw.replace(/^[?#]/, "").split("&")) {
      const i = part.indexOf("=");
      if (i < 0) continue;
      out[decodeURIComponent(part.slice(0, i))] = decodeURIComponent(part.slice(i + 1));
    }
  };
  const q = url.indexOf("?");
  const h = url.indexOf("#");
  if (q >= 0) push(url.slice(q, h >= 0 ? h : undefined));
  if (h >= 0) push(url.slice(h));
  return { access_token: out.access_token, refresh_token: out.refresh_token };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  const applySessionFromUrl = useCallback(async (url: string | null | undefined) => {
    if (!url) return;
    const { access_token, refresh_token } = tokensFromUrl(url);
    if (!access_token || !refresh_token) return;
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) throw error;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const initial = Platform.OS === "web" ? (typeof window !== "undefined" ? window.location.href : null) : await Linking.getInitialURL();
        await applySessionFromUrl(initial);
      } catch (e) {
        console.warn("oauth session restore failed", e);
      }
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setLoading(false);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    const linkSub = Linking.addEventListener("url", ({ url }) => {
      applySessionFromUrl(url).catch((e) => console.warn(e));
    });
    return () => {
      sub.subscription.unsubscribe();
      linkSub.remove();
    };
  }, [applySessionFromUrl]);

  const refreshProfile = useCallback(async () => {
    const uid = session?.user.id;
    if (!uid) {
      setProfile(null);
      return;
    }
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    setProfile((data as Profile) ?? null);
  }, [session?.user.id]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = Platform.OS === "web" ? `${window.location.origin}/` : Linking.createURL("/");
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (!data.url) throw new Error("Brak URL logowania Google (włącz provider w Supabase).");

    if (Platform.OS === "web") {
      window.location.href = data.url;
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === "success") await applySessionFromUrl(result.url);
  }, [applySessionFromUrl]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  return (
    <Ctx.Provider value={{ session, loading, profile, refreshProfile, signInWithGoogle, signOut }}>
      {children}
    </Ctx.Provider>
  );
}
