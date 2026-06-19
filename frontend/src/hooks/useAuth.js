import { useAuthContext } from '../contexts/AuthContext';

/**
 * Convenient hook that exposes auth state from AuthContext.
 *
 * Usage:
 *   const { currentUser, role, userProfile, loading } = useAuth();
 */
const useAuth = () => useAuthContext();

export default useAuth;
