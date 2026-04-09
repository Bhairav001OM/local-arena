import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../../utils/supabase"; 

interface AuthContextType {
  session: Session | null;
  user: User | null;
  signInWithGoogle: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);

  // --- NEW: The Auto-Profile Builder ---
  const ensureProfileExists = async (currentUser: User) => {
    try {
      // 1. Check if they already have a profile in the new database table
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", currentUser.id)
        .single();

      // 2. PGRST116 means "No rows found" (They are a brand new user!)
      if (error && error.code === 'PGRST116') {
        console.log("New player detected! Building Master Profile...");
        
        // Grab their Google Name and Picture
        const displayName = currentUser.user_metadata?.full_name || "New Challenger";
        const avatarUrl = currentUser.user_metadata?.avatar_url || "";

        // Insert them into your profiles table
        await supabase.from("profiles").insert([
          {
            id: currentUser.id,
            display_name: displayName,
            avatar_url: avatarUrl,
            host_strikes: 0 // Everyone starts with a clean record
          }
        ]);
      }
    } catch (err) {
      console.error("Error ensuring profile exists:", err);
    }
  };

  useEffect(() => {
    // Get current session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        ensureProfileExists(session.user); // Check profile on initial load
      }
    });

    // Listen for logins and logouts
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user && _event === 'SIGNED_IN') {
        ensureProfileExists(session.user); // Check profile right after they log in
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      }
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};