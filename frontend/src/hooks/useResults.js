import { useState, useEffect } from 'react';
import { getResultsByStudent, getAllResults } from '../services/resultService';
import useAuth from './useAuth';

/**
 * Hook to fetch results for the currently authenticated user.
 *
 * Faculty → fetches all results.
 * Student → fetches only their own results.
 */
const useResults = () => {
  const { currentUser, role } = useAuth();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchResults = async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const data =
        role === 'faculty'
          ? await getAllResults()
          : await getResultsByStudent(currentUser.uid);
      setResults(data);
    } catch (err) {
      setError(err.message || 'Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, role]);

  return { results, loading, error, refetch: fetchResults };
};

export default useResults;
