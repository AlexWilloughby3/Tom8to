import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { focusSessionService, categoryService } from '../api/services';
import type { Category } from '../types';
import {
  playNotificationSound,
  playCompletionSound,
  notifyWorkPeriodComplete,
  notifyBreakPeriodComplete,
  notifyAllCyclesComplete
} from '../utils/soundNotifications';
import { mergeShortStretches, totalSeconds, type Stretch } from '../utils/stretches';

interface PomodoroContextType {
  categories: Category[];
  reloadCategories: () => Promise<void>;
  // Pomodoro state
  pomodoroRunning: boolean;
  pomodoroSeconds: number;
  workDuration: number | '';
  breakDuration: number | '';
  cycles: number | '';
  currentCycle: number;
  isBreak: boolean;
  totalWorkTime: number;
  pomodoroCategory: string;
  pomodoroCustomCategory: string;
  showPomodoroCustom: boolean;
  pomodoroMessage: string;
  pomodoroError: string;

  // Stopwatch state
  stopwatchRunning: boolean;
  stopwatchSeconds: number;
  stopwatchCategory: string;
  stopwatchCustomCategory: string;
  showStopwatchCustom: boolean;
  stopwatchMessage: string;
  stopwatchError: string;

  // Setters
  setWorkDuration: (duration: number | '') => void;
  setBreakDuration: (duration: number | '') => void;
  setCycles: (cycles: number | '') => void;
  setPomodoroCustomCategory: (category: string) => void;
  setStopwatchCustomCategory: (category: string) => void;

  // Actions
  handlePomodoroStart: () => void;
  handlePomodoroPause: () => void;
  handlePomodoroResume: () => void;
  handlePomodoroReset: () => void;
  handlePomodoroSave: () => void;
  handlePomodoroCategoryChange: (value: string) => void;
  handleStopwatchCategoryChange: (value: string) => void;
  handleStopwatchStart: () => void;
  handleStopwatchPause: () => void;
  handleStopwatchReset: () => void;
  handleStopwatchSave: () => Promise<void>;

  // Helpers
  getWorkDuration: () => number;
  getBreakDuration: () => number;
  getCycles: () => number;
}

const PomodoroContext = createContext<PomodoroContextType | undefined>(undefined);

export function PomodoroProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [pomodoroRunning, setPomodoroRunning] = useState(false);
  const [pomodoroSeconds, setPomodoroSeconds] = useState(0);
  const [workDuration, setWorkDuration] = useState<number | ''>(25);
  const [breakDuration, setBreakDuration] = useState<number | ''>(5);
  const [cycles, setCycles] = useState<number | ''>(4);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [isBreak, setIsBreak] = useState(false);
  const [totalWorkTime, setTotalWorkTime] = useState(0);
  const [pomodoroCategory, setPomodoroCategory] = useState('');
  const [pomodoroCustomCategory, setPomodoroCustomCategory] = useState('');
  const [showPomodoroCustom, setShowPomodoroCustom] = useState(false);
  const [pomodoroMessage, setPomodoroMessage] = useState('');
  const [pomodoroError, setPomodoroError] = useState('');
  const pomodoroIntervalRef = useRef<number | null>(null);
  // Finished work stretches awaiting save, and the countdown value at which
  // the current work stretch began (null while paused or on a break)
  const pomodoroStretchesRef = useRef<Stretch[]>([]);
  const pomodoroStretchOpenAtRef = useRef<number | null>(null);

  // Stopwatch state
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [stopwatchSeconds, setStopwatchSeconds] = useState(0);
  const [stopwatchCategory, setStopwatchCategory] = useState('');
  const [stopwatchCustomCategory, setStopwatchCustomCategory] = useState('');
  const [showStopwatchCustom, setShowStopwatchCustom] = useState(false);
  const [stopwatchMessage, setStopwatchMessage] = useState('');
  const [stopwatchError, setStopwatchError] = useState('');
  const stopwatchIntervalRef = useRef<number | null>(null);
  // Same as the Pomodoro refs, but openAt is the elapsed value at start/resume
  const stopwatchStretchesRef = useRef<Stretch[]>([]);
  const stopwatchStretchOpenAtRef = useRef<number | null>(null);

  // Load categories when user changes
  useEffect(() => {
    if (user) {
      loadCategories();
    }
  }, [user]);

  const loadCategories = async () => {
    if (!user) return;
    try {
      const data = await categoryService.getCategories(user.email);
      setCategories(data);
      // Set default category to first available if current is empty
      if (!pomodoroCategory && data.length > 0) {
        setPomodoroCategory(data[0].category);
      }
      if (!stopwatchCategory && data.length > 0) {
        setStopwatchCategory(data[0].category);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  // Helper functions to get actual values with defaults
  const getWorkDuration = () => (typeof workDuration === 'number' ? workDuration : 25);
  const getBreakDuration = () => (typeof breakDuration === 'number' ? breakDuration : 5);
  const getCycles = () => (typeof cycles === 'number' ? cycles : 4);

  // Saves one session per stretch, oldest first. Each stretch is removed once
  // saved, so a retry after a failure only sends what's left.
  const saveStretches = async (
    email: string,
    category: string,
    stretchesRef: { current: Stretch[] }
  ) => {
    stretchesRef.current = mergeShortStretches(stretchesRef.current);
    while (stretchesRef.current.length > 0) {
      const stretch = stretchesRef.current[0];
      await focusSessionService.createSessionWithTime(email, {
        category,
        focus_time_seconds: stretch.seconds,
        time: new Date(stretch.end).toISOString(),
      });
      stretchesRef.current = stretchesRef.current.slice(1);
    }
  };

  const closePomodoroStretch = (secondsRemaining: number) => {
    const openAt = pomodoroStretchOpenAtRef.current;
    if (openAt === null) return;
    pomodoroStretchOpenAtRef.current = null;
    if (openAt - secondsRemaining > 0) {
      pomodoroStretchesRef.current.push({ end: Date.now(), seconds: openAt - secondsRemaining });
    }
  };

  const closeStopwatchStretch = () => {
    const openAt = stopwatchStretchOpenAtRef.current;
    if (openAt === null) return;
    stopwatchStretchOpenAtRef.current = null;
    if (stopwatchSeconds - openAt > 0) {
      stopwatchStretchesRef.current.push({ end: Date.now(), seconds: stopwatchSeconds - openAt });
    }
  };

  // Pomodoro timer effect
  useEffect(() => {
    if (pomodoroRunning && pomodoroSeconds > 0) {
      pomodoroIntervalRef.current = window.setInterval(() => {
        setPomodoroSeconds((s) => {
          if (s <= 1) {
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else {
      if (pomodoroIntervalRef.current) {
        clearInterval(pomodoroIntervalRef.current);
        pomodoroIntervalRef.current = null;
      }
    }

    return () => {
      if (pomodoroIntervalRef.current) {
        clearInterval(pomodoroIntervalRef.current);
      }
    };
  }, [pomodoroRunning, pomodoroSeconds]);

  // Handle timer completion
  useEffect(() => {
    if (pomodoroRunning && pomodoroSeconds === 0) {
      handlePomodoroComplete();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pomodoroSeconds, pomodoroRunning]);

  const handlePomodoroComplete = () => {
    if (isBreak) {
      // Break finished, start next work cycle or finish
      if (currentCycle < getCycles()) {
        // Transitioning from break to work
        playNotificationSound();
        notifyBreakPeriodComplete();
        setCurrentCycle(currentCycle + 1);
        setIsBreak(false);
        setPomodoroSeconds(getWorkDuration() * 60);
        pomodoroStretchOpenAtRef.current = getWorkDuration() * 60;
      } else {
        // All cycles complete, save session
        playCompletionSound();
        notifyAllCyclesComplete();
        handlePomodoroSave();
      }
    } else {
      // Work period finished
      closePomodoroStretch(0);
      setTotalWorkTime(totalWorkTime + getWorkDuration() * 60);

      if (currentCycle < getCycles()) {
        // Start break - transitioning from work to break
        playNotificationSound();
        notifyWorkPeriodComplete();
        setIsBreak(true);
        setPomodoroSeconds(getBreakDuration() * 60);
      } else {
        // Last cycle done, save
        playCompletionSound();
        notifyAllCyclesComplete();
        handlePomodoroSave();
      }
    }
  };

  const handlePomodoroSave = async () => {
    setPomodoroRunning(false);
    // Close the work stretch in progress, if any; each stretch is saved as its
    // own session so breaks and pauses aren't counted as focus time
    closePomodoroStretch(pomodoroSeconds);

    if (!user) return;

    const selectedCategory = showPomodoroCustom ? pomodoroCustomCategory : pomodoroCategory;

    if (!selectedCategory) {
      setPomodoroError('Please select or enter a category');
      return;
    }

    const finalWorkTime = totalSeconds(pomodoroStretchesRef.current);

    try {
      await saveStretches(user.email, selectedCategory, pomodoroStretchesRef);

      setPomodoroMessage(`Pomodoro complete! ${formatTime(finalWorkTime)} in ${selectedCategory}`);

      // Reload categories in case a new custom category was created
      await loadCategories();

      handlePomodoroReset();
    } catch (err) {
      setPomodoroError('Failed to save focus session. Please try again.');
      console.error(err);
    }
  };

  const handlePomodoroStart = () => {
    setPomodoroMessage('');
    setPomodoroError('');
    setPomodoroRunning(true);
    setCurrentCycle(1);
    setIsBreak(false);
    setTotalWorkTime(0);
    setPomodoroSeconds(getWorkDuration() * 60);
    pomodoroStretchesRef.current = [];
    pomodoroStretchOpenAtRef.current = getWorkDuration() * 60;
  };

  const handlePomodoroPause = () => {
    setPomodoroRunning(false);
    closePomodoroStretch(pomodoroSeconds);
  };

  const handlePomodoroResume = () => {
    setPomodoroRunning(true);
    if (!isBreak) {
      pomodoroStretchOpenAtRef.current = pomodoroSeconds;
    }
  };

  const handlePomodoroReset = () => {
    setPomodoroRunning(false);
    setPomodoroSeconds(0);
    setCurrentCycle(1);
    setIsBreak(false);
    setTotalWorkTime(0);
    pomodoroStretchesRef.current = [];
    pomodoroStretchOpenAtRef.current = null;
  };

  const handlePomodoroCategoryChange = (value: string) => {
    if (value === 'Custom') {
      setShowPomodoroCustom(true);
      setPomodoroCategory(categories.length > 0 ? categories[0].category : '');
    } else {
      setShowPomodoroCustom(false);
      setPomodoroCategory(value);
    }
  };

  const handleStopwatchCategoryChange = (value: string) => {
    if (value === 'Custom') {
      setShowStopwatchCustom(true);
      setStopwatchCategory(categories.length > 0 ? categories[0].category : '');
    } else {
      setShowStopwatchCustom(false);
      setStopwatchCategory(value);
    }
  };

  // Stopwatch timer effect
  useEffect(() => {
    if (stopwatchRunning) {
      stopwatchIntervalRef.current = window.setInterval(() => {
        setStopwatchSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (stopwatchIntervalRef.current) {
        clearInterval(stopwatchIntervalRef.current);
        stopwatchIntervalRef.current = null;
      }
    }

    return () => {
      if (stopwatchIntervalRef.current) {
        clearInterval(stopwatchIntervalRef.current);
      }
    };
  }, [stopwatchRunning]);

  const handleStopwatchStart = () => {
    setStopwatchRunning(true);
    setStopwatchMessage('');
    setStopwatchError('');
    stopwatchStretchOpenAtRef.current = stopwatchSeconds;
  };

  const handleStopwatchPause = () => {
    setStopwatchRunning(false);
    closeStopwatchStretch();
  };

  const handleStopwatchReset = () => {
    setStopwatchRunning(false);
    setStopwatchSeconds(0);
    setStopwatchMessage('');
    setStopwatchError('');
    stopwatchStretchesRef.current = [];
    stopwatchStretchOpenAtRef.current = null;
  };

  const handleStopwatchSave = async () => {
    setStopwatchRunning(false);
    closeStopwatchStretch();

    if (stopwatchSeconds === 0) {
      setStopwatchError('Timer must run for at least 1 second');
      return;
    }

    if (!user) return;

    const selectedCategory = showStopwatchCustom ? stopwatchCustomCategory : stopwatchCategory;

    if (!selectedCategory) {
      setStopwatchError('Please select or enter a category');
      return;
    }

    const savedSeconds = totalSeconds(stopwatchStretchesRef.current);

    try {
      await saveStretches(user.email, selectedCategory, stopwatchStretchesRef);

      setStopwatchMessage(`Focus session saved! ${formatTime(savedSeconds)} in ${selectedCategory}`);
      setStopwatchSeconds(0);
      setStopwatchError('');

      // Reload categories in case a new custom category was created
      await loadCategories();
    } catch (err) {
      // Stretches saved before the failure are already logged; keep only the
      // unsaved time on the clock so a retry doesn't double-count
      setStopwatchSeconds(totalSeconds(stopwatchStretchesRef.current));
      setStopwatchError('Failed to save focus session. Please try again.');
      console.error(err);
    }
  };

  // Helper to format time (duplicated from utils for context independence)
  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const value: PomodoroContextType = {
    categories,
    reloadCategories: loadCategories,
    pomodoroRunning,
    pomodoroSeconds,
    workDuration,
    breakDuration,
    cycles,
    currentCycle,
    isBreak,
    totalWorkTime,
    pomodoroCategory,
    pomodoroCustomCategory,
    showPomodoroCustom,
    pomodoroMessage,
    pomodoroError,
    stopwatchRunning,
    stopwatchSeconds,
    stopwatchCategory,
    stopwatchCustomCategory,
    showStopwatchCustom,
    stopwatchMessage,
    stopwatchError,
    setWorkDuration,
    setBreakDuration,
    setCycles,
    setPomodoroCustomCategory,
    setStopwatchCustomCategory,
    handlePomodoroStart,
    handlePomodoroPause,
    handlePomodoroResume,
    handlePomodoroReset,
    handlePomodoroSave,
    handlePomodoroCategoryChange,
    handleStopwatchCategoryChange,
    handleStopwatchStart,
    handleStopwatchPause,
    handleStopwatchReset,
    handleStopwatchSave,
    getWorkDuration,
    getBreakDuration,
    getCycles,
  };

  return (
    <PomodoroContext.Provider value={value}>
      {children}
    </PomodoroContext.Provider>
  );
}

export function usePomodoro() {
  const context = useContext(PomodoroContext);
  if (context === undefined) {
    throw new Error('usePomodoro must be used within a PomodoroProvider');
  }
  return context;
}
