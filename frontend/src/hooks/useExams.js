import { useState, useEffect } from 'react';
import { getAllExams, getAvailableExams } from '../services/examService';

/**
 * Hook to fetch and cache the exam list.
 *
 * @param {'all'|'available'} mode
 */
const useExams = (mode = 'available') => {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchExams = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = mode === 'all' ? await getAllExams() : await getAvailableExams();
      setExams(data);
    } catch (err) {
      setError(err.message || 'Failed to load exams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  return { exams, loading, error, refetch: fetchExams };
};

export default useExams;
