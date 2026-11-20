import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api, getToken, setToken } from "../services/api";

const AuthContext = createContext(null);

/** Keeps the signed-in user for the whole app. Wrap the app in <AuthProvider>. */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) return;
    api
      .me()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onSignedOut = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener("reprocare:signed-out", onSignedOut);
    return () =>
      window.removeEventListener("reprocare:signed-out", onSignedOut);
  }, []);

  // email or kenyan phone number
  const signIn = useCallback(async (identifier, password) => {
    const { token, user: signedIn } = await api.login({ identifier, password });
    setToken(token);
    setUser(signedIn);
    return signedIn;
  }, []);

  const register = useCallback(async (details) => {
    const { token, user: created } = await api.register(details);
    setToken(token);
    setUser(created);
    return created;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* already signed out on the server */
    }
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, register, signOut, setUser }),
    [user, loading, signIn, register, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Where each role lands after signing in. */
export function dashboardHome(user) {
  if (!user) return "/sign-in";
  return (
    {
      patient: "/dashboard",
      facility_staff: "/dashboard/facility",
      admin: "/dashboard/admin",
    }[user.role] || "/"
  );
}
