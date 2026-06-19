/**
 * Timer.jsx
 *
 * ─── ROOT CAUSE OF BUG-04 ────────────────────────────────────────────────────
 *
 * The previous implementation had a single useEffect with this dependency array:
 *
 *   useEffect(() => { ... setInterval ... }, [isRunning, onTimeUp]);
 *
 * The problem is `onTimeUp` in the dependency array.
 *
 * `onTimeUp` is the prop passed from ExamPage:
 *
 *   const handleTimeUp = () => confirmSubmit();   // defined inline in ExamPage
 *   <Timer duration={exam.duration} onTimeUp={handleTimeUp} />
 *
 * Because `handleTimeUp` was a plain arrow function defined in the ExamPage
 * function body — not wrapped in useCallback — it was recreated as a NEW
 * function object on every single render of ExamPage.
 *
 * ExamPage re-renders every time the student:
 *   - selects an answer      (setAnswers → re-render)
 *   - navigates a question   (setCurrentQuestion → re-render)
 *   - clicks the palette     (setCurrentQuestion → re-render)
 *
 * Each re-render produces a new `handleTimeUp` reference.
 * React compares prop references, sees onTimeUp changed, re-renders Timer.
 * Timer's useEffect sees onTimeUp in its dep array changed, so it:
 *   1. Runs the cleanup: clearInterval(timer)   ← CANCELS the running timer
 *   2. Runs the effect again: setInterval(...)  ← RESTARTS from current timeLeft
 *
 * Result: the displayed time does NOT reset (timeLeft state is preserved),
 * but the underlying interval is cancelled and restarted. This causes:
 *   - A ~1-second hiccup/pause each time the student answers a question
 *   - The timer effectively loses one tick per answer because the old interval
 *     is cancelled mid-tick and the new one starts fresh
 *   - On slow machines, multiple rapid answers could stack restarts into a
 *     noticeable freeze or delay in the countdown
 *
 * ─── THE FIX ─────────────────────────────────────────────────────────────────
 *
 * Two changes, working together:
 *
 * 1. In ExamPage.jsx (the caller):
 *    Wrap handleTimeUp / confirmSubmit in useCallback so its reference is stable
 *    across renders. The interval is never recreated unless truly necessary.
 *
 * 2. In Timer.jsx (this file):
 *    Remove `onTimeUp` from the useEffect dependency array entirely.
 *    Instead, store onTimeUp in a ref (onTimeUpRef). The interval callback
 *    always reads from the ref, so it always sees the latest version of the
 *    function without the effect needing to re-run when the prop changes.
 *
 *    This is the standard React pattern for "use the latest version of a
 *    callback inside an effect without restarting the effect":
 *
 *      const callbackRef = useRef(callback);
 *      useLayoutEffect(() => { callbackRef.current = callback; });
 *      // interval reads callbackRef.current — always fresh, never stale
 *
 * 3. Guard against double-fire:
 *    Use a `hasCalledTimeUp` ref so onTimeUp is called at most once,
 *    even if the component re-renders at the exact moment timeLeft hits 0.
 *
 * ─── INTERVAL STABILITY GUARANTEE ───────────────────────────────────────────
 *
 * After this fix, the setInterval is created exactly ONCE (when isRunning
 * first becomes true) and cleared exactly ONCE (when the component unmounts,
 * or isRunning becomes false). It is NOT affected by:
 *   - Student answering a question
 *   - Student changing question
 *   - Student clicking the palette
 *   - Parent component re-rendering for any reason
 */

import React, {
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
} from 'react';
import { Box, Chip } from '@mui/material';
import { AccessTime, Alarm } from '@mui/icons-material';

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Countdown timer that calls onTimeUp exactly once when it reaches zero.
 *
 * @param {object}   props
 * @param {number}   props.duration    Exam duration in MINUTES
 * @param {Function} props.onTimeUp    Called once when time expires
 * @param {boolean}  [props.isRunning] Pass false to pause. Defaults to true.
 */
const Timer = ({ duration, onTimeUp, isRunning = true }) => {
  const [timeLeft, setTimeLeft] = useState(duration * 60); // seconds
  const [isWarning, setIsWarning] = useState(false);

  // ── Stable ref for the callback ──────────────────────────────────────────
  // Always holds the latest onTimeUp without the interval depending on it.
  // useLayoutEffect (not useEffect) ensures the ref is updated synchronously
  // before any effects run, so the interval never reads a stale value.
  const onTimeUpRef = useRef(onTimeUp);
  useLayoutEffect(() => {
    onTimeUpRef.current = onTimeUp;
  });

  // ── Guard: fire onTimeUp at most once ────────────────────────────────────
  // Prevents double-submit if the component re-renders exactly on timeLeft=0.
  const hasCalledTimeUp = useRef(false);

  // ── Countdown interval ───────────────────────────────────────────────────
  // Dependency array: [isRunning] ONLY.
  // onTimeUp is intentionally absent — the ref pattern handles it.
  useEffect(() => {
    if (!isRunning) return;

    const intervalId = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalId);

          // Call onTimeUp exactly once via the ref
          if (!hasCalledTimeUp.current) {
            hasCalledTimeUp.current = true;
            // Schedule outside the setState callback to avoid calling
            // a side-effect inside a state updater function
            setTimeout(() => onTimeUpRef.current?.(), 0);
          }

          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Cleanup: clear the interval when isRunning changes or component unmounts.
    // This is the ONLY time the interval is ever cleared.
    return () => clearInterval(intervalId);
  }, [isRunning]); // ← onTimeUp deliberately NOT here

  // ── Warning threshold ────────────────────────────────────────────────────
  // Separate effect so it doesn't interfere with the interval logic.
  useEffect(() => {
    if (timeLeft <= 300 && timeLeft > 0) {
      setIsWarning(true);
    }
  }, [timeLeft]);

  // ── Formatting ───────────────────────────────────────────────────────────
  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const pad = (n) => String(n).padStart(2, '0');

    return h > 0
      ? `${pad(h)}:${pad(m)}:${pad(s)}`
      : `${pad(m)}:${pad(s)}`;
  };

  const timerColor = timeLeft === 0 ? 'error' : isWarning ? 'warning' : 'success';

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Chip
        icon={timeLeft <= 300 ? <Alarm /> : <AccessTime />}
        label={formatTime(timeLeft)}
        color={timerColor}
        variant={isWarning ? 'filled' : 'outlined'}
        sx={{
          fontSize: '1.2rem',
          fontWeight: 'bold',
          px: 2,
          py: 1,
          '& .MuiChip-icon': { fontSize: '1.5rem' },
        }}
      />
    </Box>
  );
};

export default Timer;
