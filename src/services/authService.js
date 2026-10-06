import { supabase, unwrap } from '../lib/supabase'

export const getSession = async () => (await supabase.auth.getSession()).data.session
export const onAuth = cb => supabase.auth.onAuthStateChange((_e, s) => cb(s)).data.subscription
export const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password }).then(unwrap)
export const signUp = (email, password) => supabase.auth.signUp({ email, password }).then(unwrap)
export const signOut = () => supabase.auth.signOut()
